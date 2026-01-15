"""
Unit tests for API routes and endpoints.
"""


class TestHealthEndpoint:
    """Test suite for the health check endpoint."""

    def test_health_endpoint_status(self, client):
        """Test that health endpoint returns 200 OK."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_endpoint_response_structure(self, client):
        """Test that health endpoint returns expected JSON structure."""
        response = client.get("/health")
        data = response.json()

        assert "status" in data
        assert "timestamp" in data
        assert "active_tasks" in data
        assert "active_clients" in data
        assert "version" in data

    def test_health_endpoint_status_value(self, client):
        """Test that health status is 'healthy'."""
        response = client.get("/health")
        data = response.json()

        assert data["status"] == "healthy"

    def test_health_endpoint_version(self, client):
        """Test that version is present and not empty."""
        response = client.get("/health")
        data = response.json()

        assert data["version"]
        assert isinstance(data["version"], str)


class TestUIEndpoint:
    """Test suite for the UI endpoint."""

    def test_ui_endpoint_status(self, client):
        """Test that UI endpoint returns 200 OK."""
        response = client.get("/")
        assert response.status_code == 200

    def test_ui_endpoint_content_type(self, client):
        """Test that UI endpoint returns HTML."""
        response = client.get("/")
        assert "text/html" in response.headers.get("content-type", "")


class TestCloudEventSubscriber:
    """Test suite for CloudEvent subscriber endpoint."""

    def test_receive_cloudevent(self, client, sample_cloudevent):
        """Test receiving a valid CloudEvent."""
        response = client.post(
            "/events/pub",
            json=sample_cloudevent,
            headers={"Content-Type": "application/cloudevents+json"},
        )

        assert response.status_code == 202  # Accepted

    def test_receive_cloudevent_with_booleans(self, client):
        """Test receiving CloudEvent with boolean and null values."""
        event = {
            "specversion": "1.0",
            "id": "test-bool-event",
            "time": "2025-10-16T00:00:00Z",
            "datacontenttype": "application/json",
            "type": "com.test.bool",
            "source": "test",
            "subject": "test",
            "data": {"active": True, "inactive": False, "empty": None, "count": 42},
        }

        response = client.post(
            "/events/pub",
            json=event,
            headers={"Content-Type": "application/cloudevents+json"},
        )

        assert response.status_code == 202

    def test_receive_invalid_cloudevent(self, client):
        """Test receiving an invalid CloudEvent (missing required fields)."""
        invalid_event = {
            "id": "test-invalid",
            # Missing required fields: specversion, type, source
        }

        response = client.post(
            "/events/pub",
            json=invalid_event,
            headers={"Content-Type": "application/cloudevents+json"},
        )

        # Should fail validation
        assert response.status_code in [400, 422, 500]

    def test_receive_cloudevent_without_subject(self, client):
        """Test receiving a valid CloudEvent without subject field (optional per spec)."""
        event = {
            "specversion": "1.0",
            "id": "test-no-subject-event",
            "time": "2025-10-16T00:00:00Z",
            "datacontenttype": "application/json",
            "type": "com.test.nosubject",
            "source": "test-source",
            "data": {"message": "event without subject"},
        }

        response = client.post(
            "/events/pub",
            json=event,
            headers={"Content-Type": "application/cloudevents+json"},
        )

        assert response.status_code == 202  # Accepted

    def test_receive_cloudevent_with_null_subject(self, client):
        """Test receiving a CloudEvent with explicit null subject."""
        event = {
            "specversion": "1.0",
            "id": "test-null-subject-event",
            "time": "2025-10-16T00:00:00Z",
            "datacontenttype": "application/json",
            "type": "com.test.nullsubject",
            "source": "test-source",
            "subject": None,
            "data": {"message": "event with null subject"},
        }

        response = client.post(
            "/events/pub",
            json=event,
            headers={"Content-Type": "application/cloudevents+json"},
        )

        assert response.status_code == 202  # Accepted


class TestTaskManagement:
    """Test suite for task management endpoints."""

    def test_get_all_tasks_empty(self, client):
        """Test getting tasks when none are active."""
        response = client.get("/api/tasks")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_cancel_all_tasks(self, client):
        """Test cancelling all tasks."""
        response = client.delete("/api/tasks")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestEventGenerator:
    """Test suite for event generator endpoint."""

    def test_generate_events_invalid_json_data(self, client):
        """Test generating events with invalid JSON in event_data."""
        request = {
            "event_gateway": "http://localhost:8884/events/pub",
            "event_source": "test",
            "event_type": "com.test.invalid",
            "event_subject": "test",
            "event_data": "not valid json {",
            "iterations": 1,
            "delay": 100,
        }

        response = client.post("/api/generate", json=request)
        # Validator should reject invalid JSON payloads
        assert response.status_code == 422

    def test_generate_events_valid_request(self, client, sample_generator_request):
        """Test generating events with valid request."""
        response = client.post("/api/generate", json=sample_generator_request)

        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        assert isinstance(data["task_id"], str)
