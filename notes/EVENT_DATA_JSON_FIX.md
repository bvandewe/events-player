# Event Data JSON Serialization Fix

**Date:** October 16, 2025  
**Issue:** Invalid JSON format in UI event generator form  
**Status:** ✅ Fixed

## Problem Description

When using the UI event generator form, the default event data containing Python data types (booleans, None) was being displayed as Python syntax instead of valid JSON:

### Symptoms

**What was happening in the UI:**

```json
{
  "foo": True   // ❌ Python boolean - Invalid JSON
}
```

**Error received when sending:**

```json
{
  "error": "Invalid JSON format",
  "raw_data": "{\n  \"foo\": True\n}",
  "parse_error": "Expecting value: line 2 column 10 (char 11)"
}
```

### Root Cause

When passing `default_events_settings` to the Jinja2 template:

1. `settings.default_generator_event.model_dump()` returned a Python dictionary
2. The `event_data` field containing Python `True` was converted to string as `"True"` (Python repr)
3. The Jinja2 template used `| tojson(indent=2)` filter which double-encoded the already-stringified data
4. Result: Invalid JSON with Python syntax in the UI form

## Solution

### Changes Made

**File:** `src/api/routes.py`

1. Added `json` import
2. Explicitly converted `event_data` dictionary to JSON string before passing to template:

```python
# Added import
import json

# In get_ui function
default_events_settings = settings.default_generator_event.model_dump()
# Convert event_data dict to JSON string to avoid Python True/False in template
default_events_settings["event_data"] = json.dumps(default_events_settings["event_data"])
```

**File:** `src/ui/html/offcanvas.html`

Removed the `tojson` filter since we're now passing a pre-serialized JSON string:

```html
<!-- Before -->
<textarea ... name="event_data">
{{ default_events_settings.event_data | tojson(indent=2) }}</textarea
>

<!-- After -->
<textarea ... name="event_data">
{{ default_events_settings.event_data }}</textarea
>
```

## Verification

### Test 1: String Value (Original Default)

**Settings:**

```python
event_data: typing.Dict[str, typing.Any] = {"foo": "bar"}
```

**Result in UI:**

```json
{ "foo": "bar" } // ✅ Valid JSON
```

### Test 2: Boolean and Number Values

**Settings:**

```python
event_data: typing.Dict[str, typing.Any] = {"foo": True, "count": 42}
```

**Result in UI:**

```json
{ "foo": true, "count": 42 } // ✅ Valid JSON with lowercase 'true'
```

### Test 3: Complex Data with All Types

**API Request:**

```json
{
  "event_data": "{\"foo\": true, \"active\": false, \"value\": null, \"count\": 5}"
}
```

**Parsed correctly as:**

```python
{'foo': True, 'active': False, 'value': None, 'count': 5}
```

**Serialized to CloudEvent:**

```json
{
  "data": {
    "foo": true,
    "active": false,
    "value": null,
    "count": 5
  }
}
```

✅ All values properly serialized

## Technical Details

### JSON Serialization Flow

1. **Settings Definition:**

   ```python
   event_data: Dict[str, Any] = {"foo": True}  # Python dict with boolean
   ```

2. **Route Handler:**

   ```python
   default_events_settings = settings.default_generator_event.model_dump()
   default_events_settings["event_data"] = json.dumps(default_events_settings["event_data"])
   # Result: '{"foo": true}'  - JSON string with lowercase boolean
   ```

3. **Template Rendering:**

   ```html
   <textarea>{{ default_events_settings.event_data }}</textarea>
   <!-- Result: {"foo": true} - Valid JSON in textarea -->
   ```

4. **User Submits Form:**
   - Browser sends: `event_data: '{"foo": true}'`
   - Backend parses: `json.loads('{"foo": true}')` → `{'foo': True}`
   - CloudEvent model serializes: `model_dump(mode="json")` → `{"foo": true}`

### Python to JSON Type Mapping

| Python Type | JSON Type | json.dumps() Output |
| ----------- | --------- | ------------------- |
| `True`      | `true`    | `true` ✅           |
| `False`     | `false`   | `false` ✅          |
| `None`      | `null`    | `null` ✅           |
| `42`        | `42`      | `42` ✅             |
| `"text"`    | `"text"`  | `"text"` ✅         |

## Benefits

1. **✅ Valid JSON in UI** - Users can now copy/paste JSON from other sources
2. **✅ Boolean Support** - Can use `true`/`false` in event data
3. **✅ Null Support** - Can use `null` values
4. **✅ No More Parse Errors** - Invalid JSON format errors eliminated
5. **✅ Better UX** - Form pre-filled with valid, editable JSON

## Related Issues

This fix complements the previous boolean serialization fix documented in `BOOLEAN_FIX.md`, which handled Python-to-JSON conversion in SSE event streams. Together, these fixes ensure:

- UI form displays valid JSON (this fix)
- SSE events contain valid JSON (BOOLEAN_FIX.md)
- CloudEvent data is properly serialized (CloudEvent model)

## Testing Recommendations

To verify the fix:

1. Open the UI at http://localhost:8884
2. Click the offcanvas menu to open the event generator form
3. Check the "Data" textarea - should contain valid JSON
4. Try different values:

   ```json
   { "active": true, "count": 42, "name": "test", "optional": null }
   ```

5. Submit the form and verify no parse errors
6. Check the received event in the UI accordion

Expected: All events properly formatted with correct JSON types

---

**Fix Date:** October 16, 2025  
**Files Modified:** `src/api/routes.py`, `src/ui/html/offcanvas.html`  
**Status:** Production Ready ✅
