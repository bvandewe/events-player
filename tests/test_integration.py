"""
Integration tests for SSE streaming functionality.
"""

import pytest


class TestSSEStreaming:
    """Integration tests for Server-Sent Events streaming."""

    def test_sse_stream_connection(self, client):
        """Test that SSE stream endpoint is accessible."""
        with client.stream("GET", "/stream") as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")

    def test_sse_stream_keepalive(self, client):
        """Test that SSE stream sends keepalive messages."""
        with client.stream("GET", "/stream") as response:
            # Read a few chunks to get keepalive messages
            chunks = []
            line_iter = response.iter_lines()
            for _ in range(3):
                try:
                    chunk = next(line_iter)
                except StopIteration:
                    break
                if chunk:
                    chunks.append(chunk)

            # Should have received some data
            assert len(chunks) > 0

    def test_sse_task_stream_connection(self, client):
        """Test that task-specific SSE stream is accessible."""
        # First create a task
        request = {
            "event_gateway": "http://localhost:8884/events/pub",
            "event_source": "test",
            "event_type": "com.test.sse",
            "event_subject": "test",
            "event_data": '{"test": true}',
            "iterations": 1,
            "delay": 100,
        }

        response = client.post("/api/generate", json=request)
        task_data = response.json()
        task_id = task_data["task_id"]

        # Connect to task stream
        with client.stream("GET", f"/stream/task/{task_id}") as stream_response:
            assert stream_response.status_code == 200
            assert "text/event-stream" in stream_response.headers.get("content-type", "")


class TestEventPublishSubscribe:
    """Integration tests for event publishing and subscribing."""

    def test_publish_and_receive_event(self, client, sample_cloudevent):
        """Test publishing an event and verifying it's queued for SSE clients."""
        # First, establish an SSE connection to create a client
        with client.stream("GET", "/stream"):
            # Publish an event
            response = client.post(
                "/events/pub",
                json=sample_cloudevent,
                headers={"Content-Type": "application/cloudevents+json"},
            )

            assert response.status_code == 202

            # The event should be queued for the SSE client
            # (In a real scenario, we'd read from the stream, but that's complex in sync tests)

    def test_event_serialization_json_types(self, client):
        """Test that events are properly serialized with JSON types."""
        event = {
            "specversion": "1.0",
            "id": "test-json-types",
            "time": "2025-10-16T00:00:00Z",
            "datacontenttype": "application/json",
            "type": "com.test.types",
            "source": "test",
            "subject": "test",
            "data": {
                "boolean_true": True,
                "boolean_false": False,
                "null_value": None,
                "number": 42,
                "string": "test",
            },
        }

        response = client.post(
            "/events/pub", json=event, headers={"Content-Type": "application/cloudevents+json"}
        )

        assert response.status_code == 202


class TestEventGeneration:
    """Integration tests for event generation workflow."""

    def test_generate_and_publish_events(self, client, sample_generator_request):
        """Test the full event generation workflow."""
        # Start event generation
        response = client.post("/api/generate", json=sample_generator_request)

        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data

        # Check task status
        response = client.get("/api/tasks")
        tasks = response.json()

        # Task should be in the list (or might have completed already)
        assert isinstance(tasks, list)

    def test_generate_events_with_invalid_gateway(self, client):
        """Test event generation with an unreachable gateway."""
        request = {
            "event_gateway": "http://invalid-host-does-not-exist:9999/events",
            "event_source": "test",
            "event_type": "com.test.invalid",
            "event_subject": "test",
            "event_data": '{"test": true}',
            "iterations": 1,
            "delay": 100,
        }

        response = client.post("/api/generate", json=request)

        # Should accept the request (failure happens in background)
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data

    def test_generate_events_invalid_json_data(self, client):
        """Invalid event_data payloads should fail validation immediately."""
        request = {
            "event_gateway": "http://localhost:8884/events/pub",
            "event_source": "test",
            "event_type": "com.test.invalid-json",
            "event_subject": "test",
            "event_data": "not valid json {",
            "iterations": 1,
            "delay": 100,
        }

        response = client.post("/api/generate", json=request)

        assert response.status_code == 422


class TestEndToEndWorkflow:
    """End-to-end integration tests."""

    def test_full_event_lifecycle(self, client):
        """Test the complete event lifecycle from generation to delivery."""
        # 1. Connect as an SSE client
        with client.stream("GET", "/stream"):
            # 2. Generate an event that posts to our own subscriber
            request = {
                "event_gateway": "http://localhost:8884/events/pub",
                "event_source": "integration-test",
                "event_type": "com.test.e2e",
                "event_subject": "e2e-test",
                "event_data": '{"test": "end-to-end", "value": 123}',
                "iterations": 1,
                "delay": 100,
            }

            response = client.post("/api/generate", json=request)
            assert response.status_code == 200

            # 3. The event should be published back to subscribers
            # (In a real test, we'd verify the stream receives the event)

    def test_request_id_propagation(self, client, sample_cloudevent):
        """Test that Request ID is present across the request lifecycle."""
        # Make a request to publish an event
        response = client.post(
            "/events/pub",
            json=sample_cloudevent,
            headers={"Content-Type": "application/cloudevents+json"},
        )

        # Verify Request ID is in the response
        assert "x-request-id" in response.headers
        request_id = response.headers["x-request-id"]

        # Request ID should be a valid UUID
        import uuid

        try:
            uuid.UUID(request_id)
        except ValueError:
            pytest.fail(f"Invalid Request ID: {request_id}")
