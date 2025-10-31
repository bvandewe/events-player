# Real-Time SSE Updates Implementation

## Summary

Implemented real-time Server-Sent Events (SSE) for the Tasks modal to replace HTTP polling with true push-based updates.

## Problem

The user reported that the "Active Tasks" modal was not handling SSE events from the backend in real-time. Investigation revealed:

1. **Tasks Modal**: Was using HTTP polling every 2 seconds instead of SSE
2. **Clients Modal**: Already had proper SSE implementation via `/stream/clients`

## Solution

### Backend Changes

#### 1. Added `/stream/tasks` SSE Endpoint

**File**: `src/api/stream.py`

Added two new functions:

```python
async def task_stats_generator(request: Request):
    """
    Generator for streaming task statistics via SSE.
    Emits updates whenever active tasks change.
    """
    try:
        previous_state = None

        while True:
            # If client closes connection, stop
            if await request.is_disconnected():
                log.debug("Task stats client disconnected")
                break

            # Serialize current active tasks
            current_state = json.dumps(
                {"active_tasks": [task for task in active_tasks.values()]},
                sort_keys=True
            )

            # Only emit if state has changed
            if current_state != previous_state:
                yield dict(
                    event="message",
                    data=json.dumps({
                        "active_tasks": [task for task in active_tasks.values()]
                    })
                )
                previous_state = current_state

            # Check for changes every 500ms
            await asyncio.sleep(0.5)

    except (asyncio.CancelledError, GeneratorExit):
        log.debug("Task stats generator cancelled")
    except Exception as e:
        log.error("Error in task_stats_generator: %s", e)


@router.get(
    path="/stream/tasks",
    tags=["Server Sent Event (SSE) Stream"],
    operation_id="stream_task_stats",
)
async def stream_task_stats(request: Request):
    """
    SSE endpoint that streams real-time active task statistics.
    Emits updates whenever tasks are created, updated, or completed.
    """
    client_id = "unknown"
    if request.client:
        client_id = f"{request.client.host}:{request.client.port}"
    log.info("New SSE client for /stream/tasks: %s", client_id)
    return EventSourceResponse(task_stats_generator(request))
```

**Key Features**:

- Only emits events when task state changes (efficient)
- Checks for changes every 500ms
- Properly handles client disconnection
- Streams all active tasks in JSON format

### Frontend Changes

#### 1. Refactored Tasks Modal to Use SSE

**File**: `src/ui/js/ui/tasksModal.js`

**Changes Made**:

- Removed `refreshInterval` (polling timer)
- Added `eventSource` and `badgeEventSource` for SSE connections
- Added `isVisible` flag to track modal state
- Added `taskCountBadge` for menu badge updates

**New Functions**:

```javascript
setupBadgeSSEConnection();
```

- Establishes persistent SSE connection to `/stream/tasks`
- Runs continuously in background to keep badge count updated
- Updates modal UI when open
- Auto-reconnects on connection failure (5 second delay)

```javascript
updateBadgeCount(count);
```

- Finds/creates badge element in admin dropdown
- Updates badge with current task count
- Hides badge when count is 0
- Uses warning badge color (bg-warning)

**Event Flow**:

1. Modal init: Starts background badge SSE connection
2. Modal show: Sets `isVisible = true`, fetches initial data, reuses badge SSE for updates
3. SSE message: Updates badge count + modal UI if visible
4. Modal hide: Sets `isVisible = false`, SSE continues in background
5. SSE error: Auto-reconnects after 5 seconds

#### 2. Added Badge Data Attribute

**File**: `src/ui/js/auth/auth.js`

Added `data-tasks-menu` attribute to menu items in two places:

**In `renderAuthUI()` (authenticated users)**:

```javascript
tasksLink.setAttribute("data-tasks-menu", "true");
// ...
// Badge will be added dynamically by tasksModalController
```

**In `renderAdminFeaturesOnly()` (no auth required)**:

```javascript
tasksLink.setAttribute("data-tasks-menu", "true");
// ...
// Badge will be added dynamically by tasksModalController
```

This allows the tasks modal controller to find the menu item and add the badge dynamically.

## Architecture

### SSE Connection Pattern

Both modals now follow the same pattern:

1. **Background Badge Connection**: Always-on SSE connection for badge updates
2. **Shared Connection**: Modal reuses badge connection when open
3. **Efficient Updates**: Only emits when state changes
4. **Auto-Reconnect**: Handles connection failures gracefully

### Data Flow

```
Backend (active_tasks dict)
    ↓
/stream/tasks SSE endpoint
    ↓ (every 500ms if changed)
EventSource in browser
    ↓
tasksModalController
    ↓
- Update badge count
- Update modal UI (if open)
```

## Benefits

1. **True Real-Time**: Updates appear instantly when tasks change (no 2-second delay)
2. **More Efficient**: Only sends data when state changes (vs. polling every 2 seconds)
3. **Lower Server Load**: Single persistent connection vs. repeated HTTP requests
4. **Consistent UX**: Both Tasks and Clients modals now use same pattern
5. **Background Updates**: Badge updates even when modal is closed

## Testing

To verify the implementation:

1. **Badge Updates**:

   - Open admin dropdown
   - Start a generator task
   - Badge should appear instantly with count

2. **Modal Real-Time Updates**:

   - Open "Manage Tasks" modal
   - Start a generator task
   - Task should appear in modal instantly
   - Progress bar should update in real-time

3. **Connection Resilience**:

   - Open browser DevTools → Network tab
   - Filter for "tasks" (EventStream type)
   - Should see persistent `/stream/tasks` connection
   - Refresh page → connection should re-establish

4. **State Changes**:
   - Watch task progress bars update smoothly
   - Cancel a task → status should update instantly
   - Task completion → should disappear from list immediately

## Comparison: Before vs After

### Before (HTTP Polling)

```javascript
// Started on modal show
refreshInterval = setInterval(loadActiveTasks, 2000);

// Stopped on modal hide
clearInterval(refreshInterval);
```

**Issues**:

- 2-second lag between updates
- Constant HTTP requests (even if no changes)
- Missed updates between polls
- Higher server load

### After (SSE)

```javascript
// Started on init (always-on)
badgeEventSource = new EventSource("/stream/tasks");

// Reused when modal opens
if (isVisible) {
  renderTasks(tasksObj);
}
```

**Improvements**:

- Instant updates (push-based)
- Only sends data when state changes
- Never misses updates
- Single persistent connection

## Files Changed

### Backend

- `src/api/stream.py`: Added `/stream/tasks` endpoint and generator

### Frontend

- `src/ui/js/ui/tasksModal.js`: Converted from polling to SSE
- `src/ui/js/auth/auth.js`: Added `data-tasks-menu` attributes for badge

## Related Documentation

- See `OAUTH_ARCHITECTURE.md` for authentication context
- See `SSE_JSON_SERIALIZATION_FIX.md` for SSE data format details
- See `ADMIN_TASK_CANCELLATION.md` for task management background

## Future Enhancements

1. Could add SSE heartbeat/ping for connection health monitoring
2. Could add exponential backoff for reconnection attempts
3. Could add user-visible connection status indicator
4. Could optimize state comparison to use hash instead of full JSON comparison
