# Server-Sent Events (SSE)

Real-time event streaming using Server-Sent Events for live monitoring.

## Overview

CloudEvent Player uses Server-Sent Events (SSE) to stream CloudEvents from the server to the browser in real-time. This provides a live feed of events as they occur without requiring polling or WebSockets.

## SSE vs Other Technologies

### Why SSE?

| Feature             | SSE             | WebSocket       | Polling         |
| ------------------- | --------------- | --------------- | --------------- |
| **Direction**       | Server → Client | Bidirectional   | Client → Server |
| **Connection**      | Single HTTP     | Separate socket | Multiple HTTP   |
| **Reconnection**    | Automatic       | Manual          | N/A             |
| **Complexity**      | Simple          | Complex         | Simple          |
| **Overhead**        | Low             | Medium          | High            |
| **Browser Support** | Excellent       | Excellent       | Universal       |

**SSE is ideal for CloudEvent Player because**:

- Unidirectional (server → client) is all we need
- Automatic reconnection built-in
- Simple HTTP, no special protocols
- Lower overhead than WebSockets
- Perfect for event streaming

## Connection Management

### Automatic Connection

The application automatically establishes SSE connection on page load:

```javascript
// Simplified connection code
const eventSource = new EventSource("/stream");

eventSource.onopen = () => {
  console.log("SSE connection established");
  updateConnectionStatus("connected");
};

eventSource.onmessage = (event) => {
  const cloudEvent = JSON.parse(event.data);
  handleNewEvent(cloudEvent);
};

eventSource.onerror = (error) => {
  console.error("SSE connection error:", error);
  // Automatic reconnection with backoff
};
```

**Connection Lifecycle**:

1. Page loads
2. SSE connection initiated to `/stream`
3. Connection established
4. Events start flowing
5. Connection indicator turns green

### Automatic Reconnection

If the connection is lost, the browser automatically attempts to reconnect:

**Reconnection Strategy**:

- **Initial retry**: Immediate
- **Subsequent retries**: Exponential backoff (3s, 6s, 12s, ...)
- **Max retry delay**: 30 seconds
- **No limit**: Keeps trying indefinitely

**User Experience**:

- Connection indicator turns yellow during reconnection
- No user action required
- Events resume when reconnected
- No data loss (server buffers events)

### Connection Status Indicator

Visual indicator in the navigation bar shows connection status:

**Status Colors**:

- 🟢 **Green** (Connected) - Receiving events normally
- 🟡 **Yellow** (Connecting) - Attempting to establish connection
- 🔴 **Red** (Disconnected) - Connection failed, will retry

**Indicator Location**:

- Navigation bar, next to event counter
- Always visible
- Updates in real-time

**Tooltip Information**:

- Hover over indicator for details
- Shows connection status
- Shows last event timestamp
- Shows reconnection attempts (if any)

## Event Stream

### Stream Endpoint

**URL**: `GET /stream`

**Content-Type**: `text/event-stream`

**Authentication**: Inherits authentication from session (if enabled)

**Connection**: Keep-alive HTTP connection

### Event Format

SSE messages are sent in this format:

```text
event: cloudevent
data: {"specversion": "1.0", "id": "abc-123", "type": "com.example.event", ...}

event: ping
data: {"type": "ping", "timestamp": "2025-10-26T12:34:56.789Z"}

event: cloudevent
data: {"specversion": "1.0", "id": "def-456", "type": "com.example.another", ...}
```

**Event Types**:

- `cloudevent` - Actual CloudEvent data
- `ping` - Heartbeat to keep connection alive
- `error` - Error messages from server (future)

### CloudEvent Messages

Each CloudEvent is sent as a complete JSON object:

```json
{
  "specversion": "1.0",
  "id": "a1b2c3d4-5678-90ab-cdef-123456789abc",
  "time": "2025-10-26T12:34:56.789012Z",
  "type": "com.example.order.created",
  "source": "order-service",
  "subject": "order-12345",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "12345",
    "amount": 99.99,
    "currency": "USD"
  }
}
```

**Message Characteristics**:

- Complete CloudEvents (no fragmentation)
- JSON format
- One event per message
- Ordered delivery (first-in, first-out)

### Heartbeat/Ping Messages

Server sends periodic ping messages to keep connection alive:

**Frequency**: Every 30 seconds (configurable on server)

**Purpose**:

- Prevent connection timeout
- Detect broken connections
- Confirm server is alive

**Format**:

```json
{
  "type": "ping",
  "timestamp": "2025-10-26T12:34:56.789Z"
}
```

**Handling**:

- Client receives ping
- Updates "last seen" timestamp
- No UI update needed
- Connection stays alive

## Stream Processing

### Event Processing Pipeline

When an SSE message arrives:

```text
1. Receive SSE Message
   ↓
2. Parse event type (cloudevent, ping, error)
   ↓
3. If cloudevent:
   ↓
4. Parse JSON Data
   ↓
5. Validate CloudEvent Structure
   ↓
6. Add to In-Memory Cache
   ↓
7. Save to IndexedDB (async)
   ↓
8. Apply Current Filters
   ↓
9. If event passes filters:
   ↓
10. Update UI in current view
    ↓
11. Increment Event Counter
    ↓
12. Notify State Subscribers
```

**Performance Characteristics**:

- Parsing: ~1ms per event
- Storage: Async, non-blocking
- Filtering: ~1-5ms depending on complexity
- UI update: ~5-10ms
- Total latency: ~10-20ms from receive to display

### Concurrent Event Handling

The system handles multiple concurrent events efficiently:

**Buffering**:

- Events buffered if arriving faster than processing
- Processing queue prevents UI blocking
- Batch updates for efficiency

**Throttling**:

- UI updates throttled to 60fps
- Event counter updates debounced
- Chart updates throttled (Timeline view)

**Priority**:

- Real-time display prioritized
- Storage happens in background
- User interactions take precedence

## Error Handling

### Network Errors

**Scenario**: Internet connection lost, network issues

**Handling**:

1. Browser detects connection loss
2. `onerror` event fires
3. Connection indicator turns red
4. Automatic reconnection begins
5. Exponential backoff applied
6. User notified via indicator

**No user action needed** - browser handles reconnection automatically.

### Parse Errors

**Scenario**: Malformed JSON in SSE message

**Handling**:

```javascript
try {
  const event = JSON.parse(data);
  processEvent(event);
} catch (error) {
  console.error("Failed to parse event:", error);
  // Log to console
  // Show error notification (optional)
  // Continue processing other events
}
```

**Result**:

- Error logged to console
- Event skipped
- Stream continues
- Other events processed normally

### Server Errors

**401 Unauthorized**:

- Trigger token refresh (if OIDC enabled)
- Retry connection with new token
- If refresh fails, prompt for login

**403 Forbidden**:

- Show permission error
- Stop reconnection attempts
- User must fix permissions

**500 Server Error**:

- Log error
- Attempt reconnection
- Show error message to user
- Admin notified (if monitoring configured)

### Connection Timeout

**Scenario**: No data received for extended period

**Detection**:

- Track last message timestamp
- Heartbeat/ping expected every 30s
- If no ping after 60s, assume connection dead

**Handling**:

- Close current connection
- Initiate new connection
- Update indicator
- Resume event stream

## Performance Optimization

### Efficient Event Handling

**Strategies**:

1. **Async Storage** - IndexedDB operations don't block UI
2. **Debounced Updates** - Counter updates debounced
3. **Throttled Rendering** - UI updates limited to 60fps
4. **Selective Filtering** - Only visible events fully processed
5. **Batch Operations** - Multiple events processed in batches

### Memory Management

**Event Retention**:

- Old events automatically cleaned up
- Memory cache kept under limits
- IndexedDB handles large storage

**Connection Management**:

- Single connection per tab
- Connection reused efficiently
- Automatic cleanup on page unload

### Bandwidth Optimization

**Compression**:

- Server can use gzip compression
- Reduces bandwidth ~70-80%
- Transparent to client

**Event Size**:

- Encourage compact event payloads
- Avoid large data objects
- Use references instead of embedding

## Use Cases

### Development & Testing

**Live Debugging**:

- Watch events as code generates them
- Verify event structure in real-time
- Test event-driven workflows
- Monitor test execution

**Integration Testing**:

- Monitor events during integration tests
- Verify correct event sequences
- Debug event timing issues
- Validate event data

### Operations & Monitoring

**System Monitoring**:

- Watch production event flow
- Detect anomalies in real-time
- Monitor event rates
- Track system health

**Alerting**:

- Watch for specific event types
- Monitor error events
- Track performance metrics
- Detect system issues

### Analysis & Debugging

**Pattern Recognition**:

- Observe event patterns
- Identify common sequences
- Discover relationships
- Understand system behavior

**Troubleshooting**:

- Watch events during incidents
- Correlate events with issues
- Identify root causes
- Verify fixes

## Advanced Features

### Multiple Clients

Multiple browser tabs/windows can connect simultaneously:

**Characteristics**:

- Each tab has independent connection
- Events delivered to all connected clients
- Server maintains separate queues
- No interference between clients

**Use Cases**:

- Multiple developers monitoring same system
- Different views in different windows
- Team collaboration
- Redundant monitoring

### Authentication

When authentication is enabled:

**SSE Connection**:

- Inherits authentication from HTTP session
- Uses cookies or auth headers
- Token validation on connection
- Automatic token refresh (if OIDC enabled)

**Reconnection with Auth**:

- Token validated on reconnect
- If expired, trigger refresh
- If refresh fails, prompt login
- Seamless user experience

## Troubleshooting

### Events Not Appearing

**Check**:

1. Connection indicator - is it green?
2. Browser console - any errors?
3. Network tab - is `/stream` connected?
4. Filters - are they too restrictive?
5. Server - is it generating events?

**Solutions**:

- Refresh page to reset connection
- Clear filters to see all events
- Check server logs for issues
- Verify network connectivity

### Connection Keeps Dropping

**Possible Causes**:

- Network instability
- Firewall/proxy issues
- Server restarts
- Browser resource limits

**Solutions**:

- Check network connection
- Configure proxy to allow SSE
- Increase server timeout settings
- Close unused browser tabs

### High Latency

**Symptoms**:

- Events appear delayed
- UI feels sluggish
- Counter updates slowly

**Solutions**:

- Check network latency
- Clear storage (too many events)
- Use time range filter
- Close other applications

## Next Steps

- [Storage](storage.md) - Learn how events are stored
- [Filtering](filtering.md) - Understand event filtering
- [Performance](performance.md) - Optimize performance
