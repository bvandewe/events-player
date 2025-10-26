# Background Tasks

Event generation runs as background tasks to prevent UI blocking and enable high-volume event generation.

## Overview

When you submit the event generator form, CloudEvent Player creates a background task that runs independently of the UI. This prevents the browser from freezing and allows you to generate thousands of events without blocking.

## How Background Tasks Work

### Task Creation

When you submit the generator form:

```text
1. User submits form
   ↓
2. POST /api/generate request sent
   ↓
3. Server validates request
   ↓
4. Background task created (status: pending)
   ↓
5. Task ID returned immediately (UUID)
   ↓
6. Form closes, user can continue using UI
   ↓
7. Task starts running (status: running)
   ↓
8. Events generated and streamed via SSE
   ↓
9. Task completes (status: completed)
```

**Benefits**:

- UI remains responsive
- Generate many events without blocking
- Monitor progress in real-time
- Cancel tasks if needed
- Multiple tasks can run concurrently

### Task Execution

Background tasks execute independently:

**Execution Model**:

- Tasks run in FastAPI background worker
- Async/await for efficient I/O
- Events sent to gateway URLs
- Progress tracked and updated
- Errors caught and logged

**Example Task**:

```python
# Simplified task code
async def generate_events_task(task_id, config):
    task.status = "running"

    for i in range(config.iterations):
        # Check if cancelled
        if task.cancelled:
            task.status = "cancelled"
            return

        # Generate event
        event = create_cloud_event(config)

        # Send to gateway
        await send_event(event, config.gateway)

        # Update progress
        task.progress = (i + 1) / config.iterations * 100

        # Delay between events
        await asyncio.sleep(config.delay / 1000)

    task.status = "completed"
```

## Task Properties

### Task ID

**Format**: UUID (e.g., `a1b2c3d4-5678-90ab-cdef-123456789abc`)

**Purpose**:

- Unique identifier for each task
- Used for cancellation
- Referenced in logs
- Returned immediately on task creation

### Task Status

**Possible Values**:

- `pending` - Task queued but not yet started
- `running` - Task actively generating events
- `completed` - Task finished successfully
- `failed` - Task encountered an error
- `cancelled` - Task stopped by administrator

**Status Transitions**:

```text
pending → running → completed
                  → failed
                  → cancelled
```

### Progress

**Range**: 0-100 (percentage)

**Calculation**: `(events_generated / total_iterations) * 100`

**Updates**: Real-time as events are generated

**Display**: Progress bars in Task Manager modal

### Timestamps

**created_at**: When task was created (ISO 8601)

**started_at**: When task began running (ISO 8601)

**completed_at**: When task finished (ISO 8601)

**Example**:

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-123456789abc",
  "status": "running",
  "progress": 45,
  "created_at": "2025-10-26T12:00:00.000Z",
  "started_at": "2025-10-26T12:00:01.000Z",
  "completed_at": null
}
```

## Task Lifecycle

### Complete Lifecycle

```text
1. PENDING
   ↓
   Task queued, waiting to start
   ↓
2. RUNNING
   ↓
   Generating events (progress 0-100%)
   ↓
   [Optional: Admin cancels task]
   ↓
3a. COMPLETED (success)
   OR
3b. FAILED (error)
   OR
3c. CANCELLED (admin action)
```

### Lifecycle Details

**PENDING Phase**:

- Task created in database
- Configuration validated
- Queued for execution
- Task ID returned to client
- Duration: Milliseconds (immediate start typically)

**RUNNING Phase**:

- Task actively executing
- Events being generated
- Progress updated regularly
- Delays applied between events
- Duration: Depends on iterations and delay

**COMPLETED Phase**:

- All events generated successfully
- Progress = 100%
- completed_at timestamp set
- Task remains in database (for history)
- Duration: Permanent (until cleaned up)

**FAILED Phase**:

- Error occurred during execution
- Error message stored
- Progress stopped at failure point
- Task marked as failed
- Duration: Permanent (until cleaned up)

**CANCELLED Phase**:

- Admin cancelled the task
- Events generated up to cancellation point
- Task stopped gracefully
- No error condition
- Duration: Permanent (until cleaned up)

## Admin Task Management

Administrators have special capabilities to manage background tasks.

### Accessing Task Manager

**Steps**:

1. Click **Admin** menu in navigation bar
2. Select **Manage Tasks**
3. Task management modal opens

**Requirements**:

- Must have `admin` role
- Must be authenticated
- Admin menu item only visible to admins

### Task Manager Features

**Real-Time Task List**:

- Shows all tasks (pending, running, completed, failed, cancelled)
- Auto-refreshes every 2 seconds
- Progress bars for running tasks
- Status badges with color coding
- Task details (ID, created time, progress)

**Status Badges**:

- 🟡 **Pending** - Yellow badge
- 🔵 **Running** - Blue badge with progress
- 🟢 **Completed** - Green badge
- 🔴 **Failed** - Red badge
- ⚫ **Cancelled** - Grey badge

### Viewing Tasks

**Task List Display**:

```text
┌─────────────────────────────────────────────┐
│ Task Manager                    [Refresh] [X]│
├─────────────────────────────────────────────┤
│ Task ID: a1b2c3...                          │
│ Status: [Running] ████████░░ 75%            │
│ Created: 2025-10-26 12:00:00                │
│ [Cancel]                                     │
├─────────────────────────────────────────────┤
│ Task ID: b2c3d4...                          │
│ Status: [Completed] ████████████ 100%       │
│ Created: 2025-10-26 11:55:00                │
│ Completed: 2025-10-26 11:56:30              │
└─────────────────────────────────────────────┘
```

**Information Shown**:

- Task ID (shortened for display)
- Current status
- Progress bar (for running tasks)
- Created timestamp
- Completed timestamp (if applicable)
- Cancel button (for running tasks)

### Cancelling Tasks

#### Cancel Individual Task

**Steps**:

1. Open Task Manager modal
2. Find the task to cancel
3. Click **Cancel** button next to task
4. Task stops gracefully
5. Status changes to "cancelled"
6. Toast notification confirms cancellation

**What Happens**:

- Task immediately marked as cancelled
- Current event generation completes
- No new events generated
- Events generated before cancellation are preserved
- Task removed from active list

**API Call**:

```http
POST /api/task/{task_id}/cancel
Authorization: Bearer <admin-token>
```

**Response**:

```json
{
  "message": "Task cancelled successfully",
  "task_id": "a1b2c3d4-5678-90ab-cdef-123456789abc"
}
```

#### Cancel All Tasks

**Steps**:

1. Open Task Manager modal
2. Click **Cancel All Tasks** button at top
3. Confirm action (if confirmation enabled)
4. All running tasks stop
5. Toast notification confirms bulk cancellation

**What Happens**:

- All running tasks marked as cancelled
- Each task stops gracefully
- Events generated before cancellation preserved
- All tasks removed from active list
- User notified of count cancelled

**API Call**:

```http
POST /api/tasks/cancel-all
Authorization: Bearer <admin-token>
```

**Response**:

```json
{
  "message": "All tasks cancelled",
  "cancelled_count": 5
}
```

**Use Cases**:

- **Emergency stop** - Stop all event generation immediately
- **Resource management** - Free up server resources
- **Testing cleanup** - Stop all test tasks at once
- **Maintenance** - Clear tasks before deployment

### Auto-Refresh

**Behavior**:

- Task list refreshes automatically every 2 seconds
- Refresh only while modal is open
- Stops refreshing when modal closed
- Manual refresh button also available

**Benefits**:

- See real-time progress updates
- Monitor task completion
- Detect failures immediately
- No need to manually refresh

## Task Monitoring

### Viewing Task Status

**From UI**:

- Open Task Manager modal
- See all tasks and their status
- Real-time progress bars

**From API**:

```http
GET /api/tasks
Authorization: Bearer <admin-token>
```

**Response**:

```json
[
  {
    "id": "task-1",
    "status": "running",
    "progress": 45,
    "created_at": "2025-10-26T12:00:00Z"
  },
  {
    "id": "task-2",
    "status": "completed",
    "progress": 100,
    "created_at": "2025-10-26T11:00:00Z",
    "completed_at": "2025-10-26T11:05:30Z"
  }
]
```

### Tracking Progress

**Progress Calculation**:

```python
progress = (current_iteration / total_iterations) * 100
```

**Progress Updates**:

- Updated after each event generated
- Sent to frontend via task status endpoint
- Displayed in progress bars
- Percentage shown in UI

**Example Progress Timeline**:

```text
T+0s:    0% (0/100 events)
T+10s:  10% (10/100 events)
T+30s:  30% (30/100 events)
T+60s:  60% (60/100 events)
T+100s: 100% (100/100 events) - Completed
```

## Use Cases

### Development & Testing

**Load Testing**:

```text
Iterations: 10000
Delay: 10ms
Result: 10,000 events over ~100 seconds
Use: Test system capacity
```

**Integration Testing**:

```text
Iterations: 100
Delay: 100ms
Result: Controlled event sequence
Use: Test event processing logic
```

**Debugging**:

```text
Iterations: 1
Delay: 0ms
Result: Single event
Use: Debug event structure
```

### Operations

**System Warm-up**:

```text
Iterations: 1000
Delay: 50ms
Result: Gradual load increase
Use: Warm up caches and connections
```

**Performance Testing**:

```text
Iterations: 50000
Delay: 1ms
Result: High-rate event stream
Use: Stress test system
```

**Emergency Stop**:

```text
Action: Cancel All Tasks
Result: Stop all event generation
Use: System overload or issues
```

## Error Handling

### Task Failures

**Common Failure Scenarios**:

- Gateway URL unreachable
- Network timeout
- Invalid event data
- Server error response
- Authentication failure

**Failure Handling**:

1. Error caught during task execution
2. Error logged to server logs
3. Task status set to "failed"
4. Error message stored with task
5. Admin notified via Task Manager
6. Events generated before failure preserved

**Example Error**:

```json
{
  "id": "task-1",
  "status": "failed",
  "progress": 45,
  "error": "Gateway URL returned 500: Internal Server Error",
  "failed_at": "2025-10-26T12:05:30Z"
}
```

### Graceful Cancellation

Tasks cancel gracefully without data loss:

**Cancellation Process**:

1. Admin clicks Cancel
2. Task receives cancellation signal
3. Current event generation completes
4. No new events started
5. Task status set to "cancelled"
6. Progress saved at cancellation point

**No Data Loss**:

- Events already generated are preserved
- Events already sent to gateway are not rolled back
- SSE stream continues showing events
- Storage contains all events up to cancellation

## Best Practices

### For Operators

1. **Start small** - Test with 1 event before generating many
2. **Use delays** - Add appropriate delays for realistic testing
3. **Monitor progress** - Check Task Manager if generating many events
4. **Test locally** - Use local gateway first before external

### For Administrators

1. **Monitor resources** - Watch system resources during large tasks
2. **Cancel when needed** - Don't hesitate to cancel problematic tasks
3. **Review failures** - Check failed tasks to identify issues
4. **Clean up periodically** - Remove old completed tasks (future feature)

### For System Designers

1. **Set reasonable limits** - Configure max iterations per task
2. **Rate limiting** - Implement rate limits if needed
3. **Resource monitoring** - Track task resource usage
4. **Cleanup policies** - Auto-delete old completed tasks

## Troubleshooting

### Task Stuck in Pending

**Symptom**: Task never starts, stays pending

**Solutions**:

- Check server logs for errors
- Verify background worker is running
- Restart application
- Check for resource constraints

### Task Progress Not Updating

**Symptom**: Progress bar stuck at same percentage

**Solutions**:

- Check network connectivity
- Verify Task Manager modal is refreshing
- Check browser console for errors
- Manually refresh the modal

### Cannot Cancel Task

**Symptom**: Cancel button doesn't work

**Solutions**:

- Verify you have admin role
- Check browser console for errors
- Try Cancel All Tasks instead
- Restart browser if needed

### Too Many Tasks Running

**Symptom**: System performance degraded

**Solution**:

- Use Cancel All Tasks to stop everything
- Wait for tasks to complete
- Implement task queue limits (server-side)

## Next Steps

- [RBAC](rbac.md) - Understand admin role requirements
- [SSE](sse.md) - Learn how events are streamed
- [Performance](performance.md) - Optimize task performance
