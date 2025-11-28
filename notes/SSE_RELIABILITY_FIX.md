# SSE Reliability Fix: Addressing Dropped Events

## 1. Problem Description

The application experiences a critical issue where incoming CloudEvents sent to the `/events/pub` endpoint do not consistently reach all connected Server-Sent Events (SSE) clients. While the endpoint successfully processes the events (as confirmed by logs), the UI does not reliably update.

The root cause is a **race condition** in the management of the in-memory `sse_clients` dictionary, which is shared across different asynchronous tasks.

### Race Condition Explained

1. **Event Broadcast**: When an event is received, the `handle_event` function in `src/api/background_tasks.py` begins iterating over a copy of the `sse_clients` dictionary to send the event to each client's queue.
2. **Client Disconnection**: Simultaneously, a client might disconnect (e.g., by closing a browser tab). This triggers the `finally` block in the `event_generator` function in `src/api/stream.py`.
3. **Dictionary Modification**: The `event_generator` immediately removes the disconnected client from the global `sse_clients` dictionary (`del sse_clients[client_id]`).
4. **Broadcast Failure**: The `handle_event` function, still in its loop, attempts to access the queue for the client that has just been removed. This can lead to a `KeyError` or other unpredictable behavior, causing the event to be dropped for that client and potentially disrupting the broadcast to subsequent clients.

This issue occurs even with a single worker process because `asyncio` tasks run concurrently, and dictionary modifications are not atomic.

## 2. Recommended Solution

To resolve this race condition and ensure atomic operations on the shared client list, the recommended solution is to replace the standard Python `dict` with a process-safe and thread-safe dictionary from Python's `multiprocessing` module.

**Chosen Solution**: `multiprocessing.Manager().dict()`

### Why this is the best approach

- **Atomicity**: It provides a synchronized dictionary proxy. All operations (read, write, delete) are atomic, preventing one task from modifying the dictionary while another is iterating over it. This directly eliminates the race condition.
- **Process-Safe**: While the immediate problem is concurrency within a single process, this solution also makes the application ready for horizontal scaling (multiple worker processes) without further code changes. The manager process handles the shared state across all workers.
- **Minimal Code Intrusion**: The `Manager.dict()` behaves very similarly to a standard dictionary, requiring minimal changes to the existing application logic.

## 3. Implementation Plan

1. **Update `src/api/globals.py`**:
    - Import `multiprocessing`.
    - Initialize `sse_clients` as `multiprocessing.Manager().dict()`.
    - Initialize `active_tasks` using the same manager to ensure it is also process-safe.

2. **Update `src/api/background_tasks.py`**:
    - Modify the `handle_event` function to create a copy of the `sse_clients` items before iterating. This is crucial because the dictionary proxy from the manager does not support iteration while the dictionary size is changing. A snapshot (`list(sse_clients.items())`) ensures a stable loop.

3. **Verify Other Files**:
    - Ensure that `src/api/stream.py` and `src/api/routes.py` continue to function correctly with the new `Manager.dict()`. The API is similar enough that changes should not be required, but verification is necessary.
