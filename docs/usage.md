# Usage Guide

Learn how to use CloudEvent Player to generate, monitor, and debug CloudEvents.

## Web Interface Overview

The CloudEvent Player web interface consists of several key areas:

### Main Components

1. **Event Generator Form** (Offcanvas panel)
2. **Event Stream Display** (Main area)
3. **Search and Filters** (Top bar)
4. **Event Inspector** (Accordion items)

## Generating CloudEvents

### Opening the Generator

Click the **"Generate Events"** button (top-left) to open the event generator panel.

### Configuration Options

#### Event Gateway

The endpoint where events will be sent:

```
http://localhost:8884/events/pub
```

- Use the local subscriber for testing
- Change to your microservice endpoint
- Supports any HTTP endpoint accepting CloudEvents

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

Use the search box to filter events:

- Search by **type**
- Search by **source**
- Search by **subject**
- Search by **data content**

Example searches:

- `order.created` - Find order creation events
- `payment-service` - Find events from payment service
- `error` - Find events containing "error"

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
