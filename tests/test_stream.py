"""
Tests for SSE JSON serialization (ensuring proper true/false/null types).
"""

import json

import pytest

from api.stream import build_sse_payload


class TestSSEJSONSerialization:
    """Test suite for SSE JSON serialization fix."""

    @pytest.mark.asyncio
    async def test_build_sse_payload_with_python_types(self):
        """Test that build_sse_payload converts Python types to JSON types."""
        payload = {
            "specversion": "1.0",
            "id": "test-123",
            "time": "2025-10-16T00:00:00Z",
            "type": "com.test.types",
            "source": "test",
            "subject": "test",
            "data": {"active": True, "inactive": False, "empty": None, "count": 42},
        }

        result = await build_sse_payload(payload)

        # Check structure
        assert "timed" in result
        assert "cloudevent" in result

        # Check that the cloudevent data is preserved
        assert result["cloudevent"]["data"]["active"] is True
        assert result["cloudevent"]["data"]["inactive"] is False
        assert result["cloudevent"]["data"]["empty"] is None
        assert result["cloudevent"]["data"]["count"] == 42

    @pytest.mark.asyncio
    async def test_build_sse_payload_json_dumps_compatibility(self):
        """Test that the payload can be JSON serialized without errors."""
        payload = {
            "id": "test-456",
            "data": {
                "bool_true": True,
                "bool_false": False,
                "null_val": None,
            },
        }

        result = await build_sse_payload(payload)

        # Should be JSON serializable
        json_str = json.dumps(result)

        # Should contain lowercase JSON types
        assert '"bool_true": true' in json_str
        assert '"bool_false": false' in json_str
        assert '"null_val": null' in json_str

        # Should NOT contain Python types
        assert "True" not in json_str
        assert "False" not in json_str
        assert "None" not in json_str

    @pytest.mark.asyncio
    async def test_build_sse_payload_timestamp_format(self):
        """Test that build_sse_payload adds proper timestamp."""
        payload = {"id": "test-timestamp"}

        result = await build_sse_payload(payload)

        # Check timestamp format
        assert "timed" in result
        timestamp = result["timed"]
        assert " at " in timestamp
        # Should be in format: "YYYY-MM-DD at HH:MM:SS.ffffff"
        assert "-" in timestamp
        assert ":" in timestamp
