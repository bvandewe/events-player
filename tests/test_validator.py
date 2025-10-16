"""
Unit tests for the validator module.
"""

import pytest
from fastapi import HTTPException
from api.validator import validate_cloud_event


class TestCloudEventValidator:
    """Test suite for CloudEvent validator."""

    @pytest.mark.asyncio
    async def test_validate_valid_content_type(self):
        """Test validation with valid CloudEvent content type."""
        # Should not raise an exception
        result = await validate_cloud_event(content_type="application/cloudevents+json")
        assert result is True

    @pytest.mark.asyncio
    async def test_validate_json_content_type(self):
        """Test validation with application/json content type."""
        # The validator currently requires 'cloudevents+json'
        with pytest.raises(HTTPException) as exc_info:
            await validate_cloud_event(content_type="application/json")

        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_validate_invalid_content_type(self):
        """Test validation with invalid content type."""
        with pytest.raises(HTTPException) as exc_info:
            await validate_cloud_event(content_type="text/plain")

        assert exc_info.value.status_code == 400
        assert "CloudEvents" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_validate_content_type_with_charset(self):
        """Test validation with content type including charset."""
        # Should handle content type with charset parameter
        result = await validate_cloud_event(
            content_type="application/cloudevents+json; charset=utf-8"
        )
        assert result is True
