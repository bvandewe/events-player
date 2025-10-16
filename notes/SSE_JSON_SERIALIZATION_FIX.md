# SSE JSON Serialization Fix

**Date:** October 16, 2025  
**Issue:** Extra closing braces and Python types in SSE event data  
**Status:** ✅ Fixed

## The Problem

When viewing events in the UI, the data field showed:

```json
{
  "data": " {\"foo\": True, \"bar\": False, \"baz\": None}}}"
}
```

Three issues:

1. **Python types**: `True`, `False`, `None` instead of `true`, `false`, `null`
2. **Extra braces**: Three closing braces `}}}` instead of one
3. **Escaped string**: Data as escaped string instead of proper JSON object

## Root Cause

The `EventSourceResponse` from `sse-starlette` was using Python's `repr()` to convert dicts to strings instead of using `json.dumps()`.

Debug logs showed:

```text
chunk: data: {'foo': True, 'bar': False, 'baz': None}
```

When the browser received this malformed JSON, the UI JavaScript error handler tried to "fix" it by adding `}}`, creating the triple-brace problem.

## The Fix

**File:** `src/api/stream.py`

**Change:**

```python
# Before:
yield {"data": sse_message_payload}

# After:
yield {"data": json.dumps(sse_message_payload)}
```

This explicitly serializes the payload to a JSON string before yielding to the SSE stream, ensuring:

- Python `True` → JSON `true`
- Python `False` → JSON `false`
- Python `None` → JSON `null`
- Proper JSON structure with no escaping

## Verification

After the fix, the SSE stream shows:

```text
chunk: data: {"timed": "2025-10-16 at 00:17:47.306910", "cloudevent": {"specversion": "1.0", "id": "test-json-fix", "time": "2025-10-16T00:17:00Z", "datacontenttype": "application/json", "type": "com.test.jsonfix", "source": "curl-test", "subject": "testing", "data": {"foo": true, "bar": false, "baz": null, "count": 42}}}
```

And the UI displays:

```json
{
  "specversion": "1.0",
  "id": "test-json-fix",
  "time": "2025-10-16T00:17:00Z",
  "datacontenttype": "application/json",
  "type": "com.test.jsonfix",
  "source": "curl-test",
  "subject": "testing",
  "data": {
    "foo": true,
    "bar": false,
    "baz": null,
    "count": 42
  }
}
```

✅ No extra braces  
✅ Proper JSON types  
✅ Data as proper object, not escaped string

## Testing

```bash
# Send test event
curl -X POST http://localhost:8884/events/pub \
  -H "Content-Type: application/cloudevents+json" \
  -d '{
    "specversion": "1.0",
    "id": "test-json-fix",
    "time": "2025-10-16T00:17:00Z",
    "datacontenttype": "application/json",
    "type": "com.test.jsonfix",
    "source": "curl-test",
    "subject": "testing",
    "data": {"foo": true, "bar": false, "baz": null, "count": 42}
  }'

# Check logs
docker-compose -f docker-compose.debug.yml logs event-player | grep -A 3 "test-json-fix"
```

Expected log output:

```text
chunk: data: {"timed": "...", "cloudevent": {"...", "data": {"foo": true, "bar": false, "baz": null, "count": 42}}}
```

## Related Fixes

This fix works in conjunction with:

1. **UI Form JSON Fix** (`EVENT_DATA_JSON_FIX.md`): Ensures the form displays valid JSON
2. **CloudEvent Validation** (`CLOUDEVENT_SSE_FIX.md`): Validates incoming events with Pydantic model
3. **build_sse_payload()**: Uses `json.loads(json.dumps())` for type conversion

Together, these ensure end-to-end JSON consistency from form input → event validation → SSE streaming → UI display.
