# Request ID Tracing Implementation

**Date:** October 16, 2025  
**Feature:** Request ID tracing for distributed tracing and debugging  
**Status:** ✅ Implemented

## Overview

Added a unique Request ID to every HTTP request for tracing and debugging purposes. Each request receives a UUID that is:

1. Generated at the start of each HTTP request
2. Stored in a context variable accessible throughout the request lifecycle
3. Added to the HTTP response headers as `X-Request-ID`

## Implementation

### Files Modified

#### 1. `src/api/app.py`

Added imports and middleware:

```python
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

# Request ID context variable for tracing
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

# ... FastAPI app initialization ...

# Middleware for Request ID tracing
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """
    Add a unique request ID to each HTTP request for tracing.
    The request ID is stored in a context variable and added to response headers.
    """
    request_id = str(uuid.uuid4())
    request_id_var.set(request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

#### 2. `src/api/__init__.py`

Exported the context variable for use in other modules:

```python
"""CloudEvents Player API package"""

from api.app import app, request_id_var

__all__ = ["app", "request_id_var"]
```

## How It Works

### Request Flow

1. **Request arrives** → Middleware intercepts it
2. **Generate UUID** → Create unique identifier: `str(uuid.uuid4())`
3. **Store in context** → `request_id_var.set(request_id)` makes it available throughout the request
4. **Process request** → All downstream code can access the request ID
5. **Add to response** → `response.headers["X-Request-ID"] = request_id`
6. **Return response** → Client receives the request ID in headers

### Context Variables

Python's `contextvars` module provides async-safe context management:

- **Async-safe**: Each async task has its own context
- **No thread pollution**: Values don't leak between requests
- **Automatic cleanup**: Context is cleaned up when request completes

## Usage

### For Clients

Clients can use the Request ID to:

- Track specific requests in logs
- Correlate requests across distributed systems
- Debug issues by referencing the exact request

Example:

```bash
$ curl -I http://localhost:8884/health
HTTP/1.1 200 OK
content-length: 126
content-type: application/json
x-request-id: d64d0d8c-de72-41ba-9d0f-aef29ee3cb70
```

### For Logging (Future Enhancement)

The `request_id_var` can be imported and used in logging:

```python
from api import request_id_var
import logging

log = logging.getLogger(__name__)

def some_function():
    request_id = request_id_var.get()
    log.info(f"[{request_id}] Processing event...")
```

This allows all log statements within a request to include the request ID for tracing.

### For Structured Logging (Recommended)

When combined with structured logging (e.g., `structlog`), you can automatically inject the request ID into all log records:

```python
import structlog
from api import request_id_var

def add_request_id(logger, method_name, event_dict):
    event_dict["request_id"] = request_id_var.get()
    return event_dict

structlog.configure(
    processors=[
        add_request_id,
        structlog.processors.JSONRenderer()
    ]
)
```

## Benefits

### 1. **Debugging**

When a user reports an issue, they can provide the Request ID, allowing you to:

- Find all logs related to that specific request
- Trace the request through all system components
- Identify exactly where the issue occurred

### 2. **Distributed Tracing**

If you have multiple microservices:

- Pass the Request ID to downstream services
- Track a request across service boundaries
- Build a complete picture of the request flow

### 3. **Performance Analysis**

- Track request duration by matching start and end log entries
- Identify slow requests by their Request ID
- Correlate performance issues with specific requests

### 4. **Correlation**

- Link client-side errors to server-side logs
- Correlate metrics with specific requests
- Debug race conditions by seeing exact request order

## Testing

### Basic Test

```bash
# Make a request and check the header
curl -I http://localhost:8884/health | grep -i x-request-id
```

Expected output:

```
x-request-id: d64d0d8c-de72-41ba-9d0f-aef29ee3cb70
```

### Multiple Requests Test

```bash
# Verify each request gets a unique ID
for i in {1..3}; do
  echo "Request $i:";
  curl -I http://localhost:8884/health 2>&1 | grep -i x-request-id;
  echo "";
done
```

Expected output:

```
Request 1:
x-request-id: d360d8e6-1c1e-4d7d-b059-522a0283f865

Request 2:
x-request-id: e307d627-6b77-4b23-9240-78ea5d9e1b84

Request 3:
x-request-id: bebc77eb-9d91-4bb5-ab99-063e2955b740
```

✅ Each request has a different UUID

### SSE Streaming Test

Since SSE connections are long-lived, verify they also get Request IDs:

```bash
curl -N http://localhost:8884/stream -v 2>&1 | grep -i x-request-id
```

## Implementation Notes

### Why Context Variables?

We use `contextvars.ContextVar` instead of thread-local storage because:

1. **Async-safe**: Works correctly with `async`/`await`
2. **FastAPI compatible**: FastAPI uses asyncio, not threads
3. **Isolated**: Each request gets its own context automatically
4. **No cleanup needed**: Context is automatically cleaned up

### Why UUID4?

We use `uuid.uuid4()` (random UUID) because:

1. **No collisions**: Virtually impossible to generate duplicates
2. **No coordination**: Don't need a central counter or database
3. **Distributed-friendly**: Multiple instances won't generate duplicate IDs
4. **Standard format**: 36 characters, widely recognized

### Middleware Order

The middleware is applied to the app before mounting routes, ensuring:

- All HTTP requests get a Request ID
- Static files also get Request IDs
- API endpoints and streaming endpoints are covered

## Future Enhancements

### 1. Accept Client-Provided Request IDs

Allow clients to provide their own Request ID:

```python
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    # Use client-provided ID if present, otherwise generate
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request_id_var.set(request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

### 2. Integrate with Logging

Add Request ID to all log records automatically:

```python
import logging

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_var.get() or "no-request"
        return True

# In logging configuration
logging.basicConfig(
    format='%(asctime)s [%(request_id)s] %(levelname)s: %(message)s'
)
logger.addFilter(RequestIdFilter())
```

### 3. Add to CloudEvents

Include the Request ID in generated CloudEvents:

```python
event = CloudEvent(
    id=str(uuid.uuid4()),
    time=datetime.datetime.now(),
    type=generator_request.event_type,
    source=generator_request.event_source,
    subject=generator_request.event_subject,
    data=data,
    extensions={
        "traceid": request_id_var.get()
    }
)
```

### 4. OpenTelemetry Integration

For full distributed tracing, integrate with OpenTelemetry:

```python
from opentelemetry import trace

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request_id_var.set(request_id)

    # Create OpenTelemetry span
    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("http_request") as span:
        span.set_attribute("request_id", request_id)
        response = await call_next(request)

    response.headers["X-Request-ID"] = request_id
    return response
```

## References

- [FastAPI Middleware Documentation](https://fastapi.tiangolo.com/tutorial/middleware/)
- [Python contextvars Documentation](https://docs.python.org/3/library/contextvars.html)
- [UUID RFC 4122](https://tools.ietf.org/html/rfc4122)
- [X-Request-ID Header Convention](https://http.dev/x-request-id)

## Related Features

This feature complements:

- **Health Check Endpoint**: Clients can correlate health check results with Request IDs
- **SSE Streaming**: Long-lived connections also get Request IDs
- **CloudEvent Generation**: Events can include tracing information
- **Error Handling**: Errors can be correlated to specific requests

## Checklist

- ✅ Middleware implemented in `app.py`
- ✅ Context variable created and exported
- ✅ Request ID added to response headers
- ✅ Unique ID verified for each request
- ✅ Code formatted with Black
- ✅ Linting passed with Flake8
- ✅ Container rebuilt and tested
- ✅ Documentation created

## Testing Summary

| Test              | Status  | Result                             |
| ----------------- | ------- | ---------------------------------- |
| Header present    | ✅ Pass | `x-request-id` appears in response |
| UUID format       | ✅ Pass | Valid UUID4 format                 |
| Uniqueness        | ✅ Pass | Each request gets different ID     |
| All endpoints     | ✅ Pass | Works for all HTTP endpoints       |
| SSE compatibility | ✅ Pass | Long-lived connections supported   |

---

**Next Steps:**

1. ✅ Feature is complete and working
2. Consider integrating Request ID into log messages
3. Consider adding OpenTelemetry for full distributed tracing
4. Update monitoring dashboards to use Request IDs for correlation
