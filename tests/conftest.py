"""
Test configuration and fixtures for CloudEvent Player tests.
"""

import os
import sys
from pathlib import Path

# Add src directory to Python path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# Create static directory if it doesn't exist (for testing)
static_dir = Path(__file__).parent.parent / "static"
static_dir.mkdir(exist_ok=True)

# Change to project root directory for tests
os.chdir(Path(__file__).parent.parent)

import pytest
from fastapi.testclient import TestClient

from api.app import app, request_id_var
from api.globals import active_tasks, sse_clients


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_globals():
    """Clear global state before and after each test."""
    sse_clients.clear()
    active_tasks.clear()
    yield
    sse_clients.clear()
    active_tasks.clear()


@pytest.fixture
def sample_cloudevent():
    """Sample CloudEvent payload for testing."""
    return {
        "specversion": "1.0",
        "id": "test-event-123",
        "time": "2025-10-16T00:00:00Z",
        "datacontenttype": "application/json",
        "type": "com.test.sample",
        "source": "test-source",
        "subject": "test-subject",
        "data": {"foo": "bar", "count": 42},
    }


@pytest.fixture
def sample_generator_request():
    """Sample event generator request for testing."""
    return {
        "event_gateway": "http://localhost:8884/events/pub",
        "event_source": "test-source",
        "event_type": "com.test.generated",
        "event_subject": "test-subject",
        "event_data": '{"test": true, "value": 123}',
        "iterations": 3,
        "delay": 100,
    }
