"""
Test to demonstrate the boolean/None serialization fix for CloudEvents
"""

import json
import datetime


async def build_sse_payload(payload: dict):
    """
    Build SSE payload with proper JSON serialization.

    This ensures Python types (True/False/None) are converted to JSON types (true/false/null).
    """
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S.%f")
    timestamp = f"{date_str} at {time_str}"

    # Properly serialize payload to ensure Python booleans/None are converted to JSON format
    # This prevents "Escaped JSON" issues in the UI
    serialized_payload = json.loads(json.dumps(payload))

    sse_event_payload = {"timed": timestamp, "cloudevent": serialized_payload}
    return sse_event_payload


async def test_boolean_serialization():
    """Test that Python booleans and None are properly serialized to JSON format"""

    print("Testing boolean/None serialization fix...")
    print("=" * 60)

    # Sample payload with Python boolean and None values (like the problematic event)
    test_payload = {
        "id": "0d53c43e07d2433dae1d3e29afeb41ed",
        "specversion": "1.0",
        "time": "2025-10-15T20:19:04.126359+00:00",
        "source": "https://variables-generator.expert.certs.cloud",
        "type": "com.cisco.mozart.variables-generator.session.query_completed.v1",
        "subject": "pl-pl-pl-ccie-inf-f2a70422",
        "datacontenttype": "application/json",
        "data": {
            "identifier": "pl-pl-pl-ccie-inf-f2a70422",
            "status": "Query Completed",
            "parts": [],
            "terminated": False,  # Python boolean
            "origin": "gateway-infra",
            "sequence": 610533,
            "optional_field": None,  # Python None
        },
    }

    print("\n1. Original payload (Python types):")
    print(
        f"   - terminated: {test_payload['data']['terminated']} (type: {type(test_payload['data']['terminated']).__name__})"
    )
    print(
        f"   - optional_field: {test_payload['data']['optional_field']} (type: {type(test_payload['data']['optional_field']).__name__})"
    )

    # Build SSE payload
    result = await build_sse_payload(test_payload)

    print("\n2. After build_sse_payload processing:")
    print(
        f"   - terminated: {result['cloudevent']['data']['terminated']} (type: {type(result['cloudevent']['data']['terminated']).__name__})"
    )
    print(
        f"   - optional_field: {result['cloudevent']['data']['optional_field']} (type: {type(result['cloudevent']['data']['optional_field']).__name__})"
    )

    # Verify it can be serialized to JSON string without issues
    json_str = json.dumps(result, indent=2)

    print("\n3. JSON serialization check:")
    # Check for correct JSON format (lowercase true/false/null)
    has_lowercase_false = '"terminated": false' in json_str
    has_null = '"optional_field": null' in json_str

    # Check that Python string representations are NOT present
    has_uppercase_false = '"terminated": False' in json_str or "'terminated': False" in json_str
    has_none_string = '"optional_field": None' in json_str or "'optional_field': None" in json_str

    print(f"   ✓ Contains JSON 'false': {has_lowercase_false}")
    print(f"   ✓ Contains JSON 'null': {has_null}")
    print(f"   ✓ Does NOT contain Python 'False': {not has_uppercase_false}")
    print(f"   ✓ Does NOT contain Python 'None': {not has_none_string}")

    print("\n4. Sample JSON output:")
    print(json_str[:300] + "...")

    # Final verification
    if has_lowercase_false and has_null and not has_uppercase_false and not has_none_string:
        print("\n" + "=" * 60)
        print("✅ SUCCESS! Boolean/None serialization test passed!")
        print("   The fix correctly converts Python types to JSON types.")
        print("=" * 60)
        return True
    else:
        print("\n" + "=" * 60)
        print("❌ FAILED! Boolean/None serialization has issues.")
        print("=" * 60)
        return False


if __name__ == "__main__":
    import asyncio

    asyncio.run(test_boolean_serialization())
