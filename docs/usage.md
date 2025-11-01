# Usage Guide

Learn how to use CloudEvent Player to generate, monitor, and debug CloudEvents.

## Web Interface Overview

The CloudEvent Player web interface provides multiple views for monitoring and analyzing CloudEvents:

### Views

1. **Events View** (Default)

   - Real-time event stream with accordion items
   - Full event details with syntax highlighting
   - Click-to-filter functionality
   - Keyboard navigation support

2. **Timeline View**
   - Visual chart showing event activity over time
   - Interactive Chart.js timeline
   - Time-based analysis of event patterns
   - Same filtering capabilities as Events view

### Main Components

1. **Navigation Bar**

   - View switcher (Events/Timeline)
   - Event counter showing filtered results
   - Connection status indicator (SSE)
   - User menu with role-based options

2. **Filter Controls**

   - **Search Box**: Quick text search across all event properties
   - **Type Filter**: Filter by specific event types
   - **Source Filter**: Filter by event sources
   - **Subject Filter**: Filter by event subjects
   - **Time Range Filter**: Filter events by time period (last hour, 6 hours, 24 hours, all)

3. **Event Generator Form** (Offcanvas panel)

   - Configure and generate CloudEvents
   - Background task support for bulk generation
   - Form validation and error handling

4. **Admin Controls** (Admin role only)

   - **Manage Tasks**: View and cancel running event generation tasks
   - **Clear Storage**: Remove all stored events from browser

5. **Event Display**
   - **Events View**: Expandable accordion items with event details
   - **Timeline View**: Chart-based visualization of event timeline

## Generating CloudEvents

### Opening the Generator

Click the **"Generate Events"** button (top-left) to open the event generator panel.

### Configuration Options

#### Event Gateway

The endpoint where events will be sent:

```
http://localhost:8884/events/pub
```

**Standard Options:**

- Use the local subscriber for testing
- Select from pre-configured gateway endpoints
- Supports any HTTP endpoint accepting CloudEvents

**Custom Gateway URL** (Admin only):

- Select "Custom URL..." from the dropdown to enter a custom gateway endpoint
- Useful for testing with development environments or external gateways
- Custom URL is saved in browser localStorage for convenience
- Format: `http://your-gateway:8080/events`
- Only available to users with admin role (or when authentication is disabled)

#### Event Source

Identifies the source of the event:

```
cloudevent-player
```

Examples:

- `com.example.payment-service`
- `https://example.com/api/v1`
- `my-microservice`

#### Event Type

The type of event being generated:

```
com.cloudevent.player.generated.v1
```

Examples:

- `com.example.order.created`
- `com.example.payment.processed`
- `com.github.pull_request.opened`

#### Event Subject

Optional subject for the event:

```
test-event
```

Examples:

- `order-12345`
- `user/john.doe@example.com`
- `resource/inventory/item-456`

#### Event Data (JSON)

The payload of the event in JSON format:

```json
{
  "foo": "bar",
  "count": 42,
  "active": true,
  "tags": ["test", "demo"]
}
```

**Important**: Use proper JSON syntax:

- ✅ `true`, `false`, `null` (lowercase)
- ✅ Double quotes for strings
- ❌ Python syntax (`True`, `False`, `None`)

#### Iterations

Number of events to generate:

```
1
```

- Set to `1` for a single event
- Set to `100` for load testing
- Maximum recommended: 1000

#### Delay (ms)

Delay between events in milliseconds:

```
1000
```

- `0` = No delay (fastest)
- `1000` = 1 second between events
- `5000` = 5 seconds between events

### Generating Events

1. Fill in the form fields
2. Click **"Generate"**
3. Watch events appear in the stream

### Example Scenarios

#### Single Test Event

```
Gateway: http://localhost:8884/events/pub
Source: test-app
Type: com.test.sample
Subject: sample-test
Data: {"message": "Hello CloudEvents"}
Iterations: 1
Delay: 1000
```

#### Load Testing

```
Gateway: http://localhost:8884/events/pub
Source: load-test
Type: com.test.load
Subject: load-test-batch
Data: {"batch": 1, "timestamp": "2025-10-16T00:00:00Z"}
Iterations: 100
Delay: 100
```

#### Integration Testing

```
Gateway: http://your-service:8080/api/events
Source: cloudevent-player
Type: com.example.order.created
Subject: order-test-001
Data: {
  "orderId": "TEST-001",
  "customerId": "CUST-123",
  "amount": 99.99,
  "currency": "USD"
}
Iterations: 1
Delay: 0
```

## Monitoring Events

### Event Stream

Events appear in real-time in the main area:

- **Newest events** at the top
- **Auto-scroll** to latest events
- **Syntax highlighting** for JSON
- **Expandable** accordion items

### Event Details

Click any event to expand and view:

- **CloudEvent Headers**: specversion, id, time, type, source
- **Data Payload**: The event data in formatted JSON
- **Timestamp**: When the event was received
- **Request ID**: For tracing (in response headers)

### Event Structure

Each CloudEvent displays:

```json
{
  "specversion": "1.0",
  "id": "a1b2c3d4-5678-90ab-cdef-123456789abc",
  "time": "2025-10-16T12:34:56.789012",
  "datacontenttype": "application/json",
  "type": "com.example.event.type",
  "source": "example-service",
  "subject": "example-subject",
  "data": {
    "key": "value"
  }
}
```

### Search and Filter

Use the comprehensive filtering system to find specific events:

#### Quick Search

- **Search Box** (Ctrl/Cmd + K): Filter events by any text
    - Searches across type, source, subject, and data content
    - Real-time filtering as you type
    - Case-insensitive matching

#### Filter Dropdowns

- **Type Filter**: Select from available event types

    - Auto-populates with types from received events
    - Multi-select capability
    - Clear individual or all selections

- **Source Filter**: Filter by event source

    - Shows all unique sources
    - Same multi-select functionality

- **Subject Filter**: Filter by event subject

    - Filters events with matching subjects
    - Supports null/empty subject filtering

- **Time Range Filter**: Filter by time period
    - Last Hour
    - Last 6 Hours
    - Last 24 Hours
    - All Time (default)

#### Click-to-Filter

Click on any event property to automatically add it to filters:

- Click event **type** → adds to type filter
- Click event **source** → adds to source filter
- Click event **subject** → adds to subject filter

#### Filter Synchronization

All filters are synchronized across views:

- Set filters in Events view → automatically applied to Timeline view
- Switch between views → filters remain consistent
- Real-time event counter updates based on active filters

#### Clearing Filters

- Click **X** on individual filter chips to remove
- Click **Clear Filters** button to remove all filters at once
- Use keyboard shortcut `Ctrl/Cmd + L` to clear all

Example searches:

- `order.created` - Find order creation events
- `payment-service` - Find events from payment service
- `error` - Find events containing "error"

## Timeline View

The Timeline view provides a visual representation of event activity over time using Chart.js.

### Accessing Timeline View

Click **Timeline** in the navigation bar or use the view switcher to access the timeline visualization.

### Features

- **Time-Based Visualization**: See event patterns and activity trends
- **Interactive Chart**: Hover over data points for details
- **Synchronized Filters**: Same filters as Events view apply automatically
- **Auto-Refresh**: Timeline updates as new events arrive
- **Manual Refresh**: Click refresh button (Ctrl/Cmd + R) to update chart

### Use Cases

- **Pattern Recognition**: Identify peak activity periods
- **Load Analysis**: Visualize event load distribution
- **Debugging**: Correlate event bursts with system issues
- **Monitoring**: Track event throughput over time

## Client-Side Storage

CloudEvent Player uses a two-tier storage architecture to persist events in your browser.

### Storage Layers

1. **IndexedDB** (Persistent)

   - Survives browser restarts
   - Stores full event history
   - Configurable size limits
   - Automatic cleanup of old events

2. **In-Memory Cache** (Session)
   - Fast access for current session
   - Cleared on page refresh
   - Used for real-time operations

### Storage Benefits

- **Offline Access**: View previously received events without server connection
- **Fast Loading**: Quick retrieval from local storage
- **Reduced Server Load**: Events cached locally
- **Session Persistence**: Continue where you left off after browser restart

### Managing Storage

#### View Storage Stats

Storage information is displayed in the UI:

- Total events stored
- Storage space used
- Last sync timestamp

#### Clear Storage (Admin Only)

Administrators can clear all stored events:

1. Click **Admin** menu in navigation bar
2. Select **Clear Storage**
3. Confirm the action
4. All events are removed from IndexedDB and memory

**Note**: Clearing storage does not affect events on the server or events currently being streamed via SSE.

## Admin Task Management

Administrators can manage background event generation tasks in real-time.

### Accessing Task Manager

1. Click **Admin** menu in navigation bar (Admin role only)
2. Select **Manage Tasks**
3. Task management modal opens

### Task Manager Features

#### Real-Time Task List

- **Auto-Refresh**: Updates every 2 seconds while modal is open
- **Task Status**: View status of all running tasks
- **Progress Tracking**: See progress bars for each task
- **Task Details**:
    - Task ID
    - Status (Pending, Running, Completed, Failed, Cancelled)
    - Progress percentage
    - Created timestamp

#### Task Control

**Cancel Individual Task**:

- Click **Cancel** button next to specific task
- Task stops gracefully
- Events generated so far are preserved
- Task status updates to "Cancelled"

**Cancel All Tasks**:

- Click **Cancel All Tasks** button at top of modal
- All running tasks stop gracefully
- Bulk cancellation for emergency scenarios
- Confirmation toast appears

### Task Lifecycle

1. **Pending**: Task queued but not started
2. **Running**: Task actively generating events
3. **Completed**: Task finished successfully
4. **Failed**: Task encountered an error
5. **Cancelled**: Task stopped by administrator

### Use Cases

- **Resource Management**: Stop unnecessary event generation
- **Emergency Control**: Halt all tasks during incidents
- **Testing Cleanup**: Cancel test tasks when done
- **Load Control**: Manage system load by canceling tasks

## Keyboard Shortcuts

CloudEvent Player supports keyboard shortcuts for efficient navigation:

| Shortcut       | Action                      |
| -------------- | --------------------------- |
| `Ctrl/Cmd + K` | Focus search box            |
| `Ctrl/Cmd + G` | Open event generator        |
| `Ctrl/Cmd + R` | Refresh events/timeline     |
| `Ctrl/Cmd + A` | Toggle all event accordions |
| `Ctrl/Cmd + L` | Clear all filters           |
| `Escape`       | Close offcanvas/modals      |

**Note**: Keyboard shortcuts work across all views.

## Using as a Subscriber

CloudEvent Player can receive events from other systems.

### Subscriber Endpoint

```
POST http://localhost:8884/events/pub
Content-Type: application/cloudevents+json
```

### Publishing to CloudEvent Player

Using curl:

```bash
curl -X POST http://localhost:8884/events/pub \
  -H "Content-Type: application/cloudevents+json" \
  -d '{
    "specversion": "1.0",
    "id": "12345",
    "time": "2025-10-16T00:00:00Z",
    "type": "com.example.test",
    "source": "curl",
    "subject": "test",
    "datacontenttype": "application/json",
    "data": {
      "message": "Hello from curl"
    }
  }'
```

Using Python:

```python
import httpx
import json
from datetime import datetime

event = {
    "specversion": "1.0",
    "id": "test-123",
    "time": datetime.now().isoformat(),
    "type": "com.example.python.test",
    "source": "python-script",
    "subject": "test-event",
    "datacontenttype": "application/json",
    "data": {
        "message": "Hello from Python",
        "count": 42
    }
}

response = httpx.post(
    "http://localhost:8884/events/pub",
    json=event,
    headers={"Content-Type": "application/cloudevents+json"}
)

print(f"Status: {response.status_code}")
```

Using JavaScript:

```javascript
const event = {
  specversion: "1.0",
  id: "js-test-123",
  time: new Date().toISOString(),
  type: "com.example.javascript.test",
  source: "javascript-app",
  subject: "test-event",
  datacontenttype: "application/json",
  data: {
    message: "Hello from JavaScript",
    timestamp: Date.now(),
  },
};

fetch("http://localhost:8884/events/pub", {
  method: "POST",
  headers: {
    "Content-Type": "application/cloudevents+json",
  },
  body: JSON.stringify(event),
})
  .then((response) => response.status)
  .then((status) => console.log("Status:", status));
```

## Monitoring Tasks

### Viewing Active Tasks

Navigate to the tasks endpoint:

```
GET http://localhost:8884/api/tasks
```

Returns a list of active event generation tasks:

```json
[
  {
    "id": "task-uuid-here",
    "status": "Running",
    "progress": 50,
    "created_at": "2025-10-16T12:34:56"
  }
]
```

### Task Status

- **Pending**: Task queued but not started
- **Running**: Task is actively generating events
- **Completed**: Task finished successfully
- **Failed**: Task encountered an error

## Server-Sent Events (SSE)

CloudEvent Player uses SSE for real-time updates.

### Connecting to the Stream

The web UI automatically connects to:

```
GET http://localhost:8884/stream
```

### Using SSE Programmatically

```javascript
const eventSource = new EventSource("http://localhost:8884/stream");

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};

eventSource.onerror = (error) => {
  console.error("SSE Error:", error);
};
```

## Health Monitoring

### Health Check Endpoint

```bash
curl http://localhost:8884/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-16T12:34:56.789012",
  "active_tasks": 0,
  "active_clients": 1,
  "version": "0.1.17"
}
```

Use for:

- Kubernetes liveness/readiness probes
- Load balancer health checks
- Monitoring systems
- CI/CD pipelines

## Request ID Tracing

Every request receives a unique Request ID in the response headers:

```
X-Request-ID: a1b2c3d4-5678-90ab-cdef-123456789abc
```

### Using Request IDs

Include in bug reports:

```bash
curl -v http://localhost:8884/health 2>&1 | grep -i x-request-id
```

Use for log correlation:

```bash
# Search logs for specific request
docker-compose logs event-player | grep "a1b2c3d4-5678-90ab-cdef"
```

## API Documentation

### Interactive Documentation

- **Swagger UI**: [http://localhost:8884/api/docs](http://localhost:8884/api/docs)
- **ReDoc**: [http://localhost:8884/api/redoc](http://localhost:8884/api/redoc)

### API Endpoints

| Endpoint        | Method | Description         |
| --------------- | ------ | ------------------- |
| `/`             | GET    | Web UI              |
| `/health`       | GET    | Health check        |
| `/api/generate` | POST   | Generate events     |
| `/api/tasks`    | GET    | List tasks          |
| `/api/tasks`    | DELETE | Cancel all tasks    |
| `/events/pub`   | POST   | Receive CloudEvents |
| `/stream`       | GET    | SSE event stream    |

## Tips and Best Practices

### Event Generation

1. **Start small**: Test with 1 event before generating many
2. **Use delays**: Add delays for realistic load testing
3. **Validate JSON**: Ensure your event data is valid JSON
4. **Test locally**: Use the built-in subscriber first

### Monitoring

1. **Use filters**: Search for specific event types
2. **Watch for errors**: Look for events with error data
3. **Check timestamps**: Verify event ordering
4. **Inspect payloads**: Expand events to see full data

### Performance

1. **Limit iterations**: Don't generate more than needed
2. **Adjust delays**: Balance speed with system capacity
3. **Monitor health**: Check the health endpoint regularly
4. **Clean up**: Cancel tasks when done testing

### Debugging

1. **Check Request IDs**: Use for tracing specific requests
2. **View logs**: Check container logs for errors
3. **Validate events**: Ensure CloudEvents are well-formed
4. **Test endpoints**: Verify connectivity before load testing

## Common Workflows

### Testing a Microservice

1. Start CloudEvent Player
2. Configure gateway to your service endpoint
3. Generate a single test event
4. Verify your service receives and processes it
5. Generate more events for load testing

### Debugging Event Flow

1. Connect CloudEvent Player as subscriber
2. Have your system send events to CloudEvent Player
3. Watch events in real-time
4. Inspect event structure and data
5. Verify CloudEvents compliance

### Load Testing

1. Configure realistic event data
2. Set high iteration count (e.g., 1000)
3. Set appropriate delay (e.g., 100ms)
4. Monitor your system's performance
5. Adjust parameters and repeat

## Next Steps

- [API Reference](api-reference.md) - Detailed API documentation
- [Event Generation](event-generation.md) - Advanced event generation
- [Deployment](deployment.md) - Production deployment guide
- [Troubleshooting](advanced/troubleshooting.md) - Common issues and solutions
