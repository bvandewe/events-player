# CloudEvent SSE Serialization Fix

**Date:** October 16, 2025  
**Issue:** CloudEvent data field showing as escaped string with Python types and extra closing braces  
**Status:** ✅ Fixed

## Problem

When viewing events in the UI, the `data` field was displayed as an escaped string with Python syntax instead of a proper JSON object:

```json
{
  "data": " {\"foo\": True, \"active\": False, \"value\": None, \"count\": 5}}}"
}
```

**Expected:**

```json
{
  "data": { "foo": true, "active": false, "value": null, "count": 5 }
}
```

## Root Cause

The issue had multiple layers:

1. **EventSourceResponse behavior**: When yielding a dict to SSE, `sse-starlette` was using Python's `repr()` instead of `json.dumps()`, causing Python types (`True`, `False`, `None`) to appear in the stream
2. **Extra closing braces**: The UI JavaScript error handler was adding `}}` when trying to "fix" malformed JSON
3. **Type preservation**: Python boolean and None types were being preserved throughout the serialization chain

The SSE debug logs showed:

```
chunk: data: {'foo': True, 'bar': False, 'baz': None}
```

Instead of proper JSON:

```
chunk: data: {"foo": true, "bar": false, "baz": null}
```

## Solution

### Change 1: Explicit JSON Serialization in SSE Stream (`src/api/stream.py`)

**The Critical Fix:**

```python
async def event_generator(client_id: str | None, request: Request):
    # ... code omitted ...
    sse_message_payload = await build_sse_payload(sse_message_payload)
    # Explicitly serialize to JSON string to ensure proper type conversion
    # This prevents Python True/False/None from appearing in the SSE stream
    yield {"data": json.dumps(sse_message_payload)}
```

**Before:**

```python
yield {"data": sse_message_payload}  # Dict with Python types
```

**After:**

```python
yield {"data": json.dumps(sse_message_payload)}  # JSON string with proper types
```

This change forces proper JSON serialization with lowercase `true`/`false`/`null` instead of relying on `EventSourceResponse` to serialize the dict (which was using Python's `repr()`).

### Change 2: CloudEvent Validation in Routes (`src/api/routes.py`)

Added CloudEvent model validation at the `/events/pub` endpoint:

```python
# Subscriber Route
@router.post(path="/events/pub", tags=["CloudEvents Subscriber"], operation_id="handle_events")
async def handle_events(
    payload: dict,
    background_tasks: BackgroundTasks,
    content_type: str = Header(...),
    valid_event: bool = Depends(validate_cloud_event),
):
    log.debug("Received request on events subscriber: %s", payload)
    try:
        # Parse and validate as CloudEvent to ensure proper serialization
        cloud_event = CloudEvent(**payload)
        # Convert back to dict with proper JSON serialization (datetime as ISO string, etc.)
        normalized_payload = cloud_event.model_dump(mode="json")
        background_tasks.add_task(handle_event, normalized_payload)
        return Response(status_code=202)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}") from e
```

### What This Does

1. **Validates CloudEvent Structure**: Ensures the incoming event conforms to CloudEvents v1.0 spec
2. **Parses Datetime**: Converts ISO datetime string to Python datetime object
3. **Normalizes Serialization**: `model_dump(mode="json")` ensures:

   - Datetime objects → ISO strings
   - All nested objects are JSON-serializable
   - Proper type handling

4. **Combined with `build_sse_payload`**: The existing `json.loads(json.dumps(payload))` in `stream.py` converts Python types to JSON types

## How It Works

### Full Flow

1. **Event Generation** (`background_tasks.py`):

   ```python
   data = json.loads(generator_request.event_data)  # String → Python dict
   event = CloudEvent(
       id=str(uuid.uuid4()),
       time=datetime.datetime.now(),  # Python datetime
       data=data  # Python dict with True/False/None
   )
   await client.post(url, json=event.model_dump(mode="json"))  # Serializes to JSON
   ```

2. **Event Reception** (`routes.py` - NEW):

   ```python
   cloud_event = CloudEvent(**payload)  # Validates and parses
   normalized_payload = cloud_event.model_dump(mode="json")  # Normalizes
   background_tasks.add_task(handle_event, normalized_payload)
   ```

3. **SSE Distribution** (`stream.py`):

   ```python
   serialized_payload = json.loads(json.dumps(payload))  # Python types → JSON types
   sse_event_payload = {"timed": timestamp, "cloudevent": serialized_payload}
   yield {"data": sse_event_payload}  # EventSourceResponse serializes to JSON
   ```

## Type Conversion Chain

| Stage                      | `time` field                | `data.foo`                     | `data.active`                   | `data.value`                   |
| -------------------------- | --------------------------- | ------------------------------ | ------------------------------- | ------------------------------ |
| 1. Creation                | `datetime.datetime`         | `True` (Python)                | `False` (Python)                | `None` (Python)                |
| 2. HTTP Send               | `"2025-10-16T..."`          | `true` (JSON)                  | `false` (JSON)                  | `null` (JSON)                  |
| 3. HTTP Receive            | `"2025-10-16T..."` (string) | `true` (in JSON)               | `false` (in JSON)               | `null` (in JSON)               |
| 4. FastAPI Parse           | `"2025-10-16T..."` (string) | `True` (Python)                | `False` (Python)                | `None` (Python)                |
| 5. CloudEvent Validation   | `datetime.datetime`         | `True` (Python)                | `False` (Python)                | `None` (Python)                |
| 6. model_dump(mode="json") | `"2025-10-16T..."` (string) | `True` (Python dict)           | `False` (Python dict)           | `None` (Python dict)           |
| 7. build_sse_payload       | `"2025-10-16T..."` (string) | `true` (after json round-trip) | `false` (after json round-trip) | `null` (after json round-trip) |
| 8. SSE Send                | `"2025-10-16T..."`          | `true` (JSON)                  | `false` (JSON)                  | `null` (JSON)                  |

## Debug Log vs Actual Data

**Important:** Python debug logs will always show Python types:

```python
log.debug("Event: %s", event)
# Output: {'data': {'foo': True, 'active': False}}
```

But the actual JSON sent over HTTP/SSE will have JSON types:

```json
{ "data": { "foo": true, "active": false } }
```

## Verification

### Test 1: Send Event with Booleans

```bash
curl -X POST http://localhost:8884/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "event_gateway": "http://event-player:8080/events/pub",
    "event_data": "{\"active\": true, \"enabled\": false, \"optional\": null}"
  }'
```

**Expected in Browser:**

```json
{
  "data": {
    "active": true,
    "enabled": false,
    "optional": null
  }
}
```

### Test 2: Check Browser DevTools

1. Open browser DevTools → Network tab
2. Filter for EventSource/SSE connections
3. Check the actual SSE messages
4. Verify JSON types are lowercase: `true`, `false`, `null`

### Test 3: Check UI Display

1. Open UI at <http://localhost:8884>
2. Send an event with boolean/null values
3. Check the accordion display
4. Verify data is shown as proper JSON object, not escaped string

## Benefits

1. ✅ **Type Safety**: CloudEvent validation ensures spec compliance
2. ✅ **Proper Serialization**: All datetime and data types correctly converted
3. ✅ **No Escaped JSON**: Data field is a proper object, not a string
4. ✅ **Boolean Support**: `true`/`false`/`null` in JSON, not `True`/`False`/`None`
5. ✅ **Consistent Format**: Same data structure throughout the pipeline

## Related Fixes

This fix complements:

- **BOOLEAN_FIX.md**: SSE payload serialization with `json.loads(json.dumps())`
- **EVENT_DATA_JSON_FIX.md**: UI form default values with proper JSON

Together, these ensure end-to-end JSON type consistency.

---

**Fix Date:** October 16, 2025  
**File Modified:** `src/api/routes.py`  
**Status:** Production Ready ✅
