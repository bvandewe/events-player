"""
Unit tests for the Request ID tracing middleware.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from api.app import app, request_id_var


class TestRequestIdMiddleware:
    """Test suite for Request ID tracing functionality."""

    def test_request_id_header_present(self, client):
        """Test that X-Request-ID header is present in the response."""
        response = client.get("/health")

        assert response.status_code == 200
        assert "x-request-id" in response.headers

    def test_request_id_is_valid_uuid(self, client):
        """Test that the Request ID is a valid UUID."""
        response = client.get("/health")

        request_id = response.headers.get("x-request-id")
        assert request_id is not None

        # Should be parseable as a UUID
        try:
            uuid.UUID(request_id)
        except ValueError:
            pytest.fail(f"Request ID '{request_id}' is not a valid UUID")

    def test_request_id_unique_per_request(self, client):
        """Test that each request gets a unique Request ID."""
        response1 = client.get("/health")
        response2 = client.get("/health")
        response3 = client.get("/health")

        request_id1 = response1.headers.get("x-request-id")
        request_id2 = response2.headers.get("x-request-id")
        request_id3 = response3.headers.get("x-request-id")

        # All should be present
        assert request_id1 is not None
        assert request_id2 is not None
        assert request_id3 is not None

        # All should be different
        assert request_id1 != request_id2
        assert request_id2 != request_id3
        assert request_id1 != request_id3

    def test_request_id_on_all_endpoints(self, client):
        """Test that Request ID is present on all HTTP endpoints."""
        endpoints = [
            "/health",
            "/",  # UI endpoint
            "/api/tasks",
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            assert (
                "x-request-id" in response.headers
            ), f"Missing Request ID on {endpoint}"

    def test_request_id_on_post_requests(self, client, sample_cloudevent):
        """Test that Request ID works on POST requests."""
        response = client.post(
            "/events/pub",
            json=sample_cloudevent,
            headers={"Content-Type": "application/cloudevents+json"},
        )

        assert "x-request-id" in response.headers
        request_id = response.headers.get("x-request-id")

        # Should be a valid UUID
        try:
            uuid.UUID(request_id)
        except ValueError:
            pytest.fail(f"Request ID '{request_id}' is not a valid UUID")

    def test_request_id_context_var(self, client):
        """Test that request_id_var is properly set during request."""
        # Note: In actual request handling, the context var would be set
        # This test verifies the context var exists and has the right type
        assert hasattr(request_id_var, "get")
        assert hasattr(request_id_var, "set")
