"""
Unit tests for CloudEvent Pydantic model.
"""

from datetime import datetime

import pytest
from pydantic import ValidationError

from api.models import CloudEvent


class TestCloudEventModel:
    """Test suite for the CloudEvent Pydantic model."""

    def test_valid_cloudevent(self):
        """Test creating a valid CloudEvent."""
        event = CloudEvent(
            specversion="1.0",
            id="test-123",
            time=datetime.now(),
            datacontenttype="application/json",
            type="com.test.event",
            source="test-source",
            subject="test-subject",
            data={"key": "value"},
        )

        assert event.specversion == "1.0"
        assert event.id == "test-123"
        assert event.type == "com.test.event"

    def test_cloudevent_from_dict(self):
        """Test creating CloudEvent from dictionary."""
        data = {
            "specversion": "1.0",
            "id": "test-456",
            "time": "2025-10-16T00:00:00Z",
            "datacontenttype": "application/json",
            "type": "com.test.event",
            "source": "test-source",
            "subject": "test-subject",
            "data": {"foo": "bar"},
        }

        event = CloudEvent(**data)

        assert event.id == "test-456"
        assert event.source == "test-source"

    def test_cloudevent_missing_required_fields(self):
        """Test that missing required fields raise validation error."""
        with pytest.raises(ValidationError):
            CloudEvent(
                id="test-789",
                # Missing required fields
            )

    def test_cloudevent_serialization_mode_json(self):
        """Test that model_dump(mode='json') properly serializes."""
        event = CloudEvent(
            specversion="1.0",
            id="test-serialize",
            time=datetime(2025, 10, 16, 0, 0, 0),
            datacontenttype="application/json",
            type="com.test.serialize",
            source="test",
            subject="test",
            data={"active": True, "count": 42, "value": None},
        )

        json_dict = event.model_dump(mode="json")

        # Check that datetime is serialized as ISO string
        assert isinstance(json_dict["time"], str)
        assert "2025-10-16" in json_dict["time"]

        # Check that data is properly included
        assert json_dict["data"]["active"] is True
        assert json_dict["data"]["count"] == 42
        assert json_dict["data"]["value"] is None

    def test_cloudevent_with_boolean_and_null_in_data(self):
        """Test CloudEvent with Python boolean and None values in data."""
        event = CloudEvent(
            specversion="1.0",
            id="test-bool",
            time=datetime.now(),
            datacontenttype="application/json",
            type="com.test.bool",
            source="test",
            subject="test",
            data={"is_active": True, "is_deleted": False, "optional_field": None},
        )

        assert event.data["is_active"] is True
        assert event.data["is_deleted"] is False
        assert event.data["optional_field"] is None

    def test_cloudevent_default_specversion(self):
        """Test that specversion defaults to '1.0'."""
        event = CloudEvent(
            id="test-default",
            time=datetime.now(),
            type="com.test.default",
            source="test",
            subject="test",
            data={},
        )

        assert event.specversion == "1.0"

    def test_cloudevent_default_datacontenttype(self):
        """Test that datacontenttype defaults to 'application/json'."""
        event = CloudEvent(
            id="test-content-type",
            time=datetime.now(),
            type="com.test.contenttype",
            source="test",
            subject="test",
            data={},
        )

        assert event.datacontenttype == "application/json"
