import asyncio
import datetime
import json
import logging

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from .globals import sse_clients, active_tasks
from .constants import MAX_QUEUE_SIZE, SLOW_CLIENT_THRESHOLD, ADAPTIVE_QUEUE_CHECK_INTERVAL


log = logging.getLogger(__name__)

router = APIRouter()


# Utils
async def build_sse_payload(payload: dict):
    """
    Build SSE payload with proper JSON serialization.

    This ensures Python types (True/False/None) are converted to JSON types (true/false/null).
    """
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S.%f")
    timestamp = f"{date_str} at {time_str}"

    # Properly serialize payload to ensure Python booleans/None are converted to JSON format
    # This prevents "Escaped JSON" issues in the UI
    serialized_payload = json.loads(json.dumps(payload))

    sse_event_payload = {"timed": timestamp, "cloudevent": serialized_payload}
    return sse_event_payload


async def event_generator(client_id: str | None, request: Request):
    if client_id is not None:
        try:
            last_queue_check = asyncio.get_event_loop().time()

            while True:
                # If client closes connection, stop sending events
                if await request.is_disconnected():
                    log.debug("Client %s disconnected", client_id)
                    break

                # Adaptive backpressure - check queue depth periodically
                current_time = asyncio.get_event_loop().time()
                if current_time - last_queue_check > ADAPTIVE_QUEUE_CHECK_INTERVAL:
                    queue_size = sse_clients[client_id].qsize()
                    if queue_size > SLOW_CLIENT_THRESHOLD:
                        log.warning(
                            f"Client {client_id} queue at {queue_size}/{MAX_QUEUE_SIZE} "
                            f"({queue_size/MAX_QUEUE_SIZE*100:.0f}% full) - slow consumer"
                        )
                    last_queue_check = current_time

                try:
                    # Use timeout to make the stream more responsive to server shutdown
                    sse_message_payload = await asyncio.wait_for(
                        sse_clients[client_id].get(), timeout=1.0
                    )
                    if sse_message_payload is None:
                        break
                    sse_message_payload = await build_sse_payload(sse_message_payload)
                    # Explicitly serialize to JSON string to ensure proper type conversion
                    # This prevents Python True/False/None from appearing in the SSE stream
                    yield {"data": json.dumps(sse_message_payload)}
                except asyncio.TimeoutError:
                    # No message within timeout, check if connection is still alive
                    if await request.is_disconnected():
                        break
                    # Send keepalive to check connection
                    yield {"comment": "keepalive"}

                await asyncio.sleep(0.05)

        except (asyncio.CancelledError, GeneratorExit):
            log.debug("Event generator cancelled for client %s", client_id)
        except Exception as e:
            log.error("Error in event_generator: %s", e)

        # Handle client disconnection
        finally:
            if client_id in sse_clients:
                del sse_clients[client_id]
            log.debug("Client %s cleanup complete", client_id)


# Stream events
@router.get(
    path="/stream/events",
    tags=["Server Sent Event (SSE) Stream"],
    operation_id="sse_stream",
)
async def sse_stream(request: Request):
    client_id = None
    if request.client:
        # Add an individual queue for each new client' browser tab
        client_id = f"{request.client.host}:{request.client.port}"
        log.info("New SSE client for /stream/events: %s", client_id)
        sse_clients[client_id] = asyncio.Queue(MAX_QUEUE_SIZE)
    return EventSourceResponse(event_generator(client_id, request))


async def task_status_generator(task_id: str):
    try:
        if task_id in active_tasks:
            task = active_tasks[task_id]
            if task.progress >= 0:
                # Stream task updates until task is complete or removed
                while task_id in active_tasks:
                    task = active_tasks[task_id]
                    serialized_task = task.model_dump_json()
                    yield {"data": serialized_task}
                    # Use shorter sleep interval for more responsive shutdown
                    await asyncio.sleep(0.25)

                # Send final status when task is complete
                log.debug("Task %s streaming complete", task_id)
            else:
                # task.progress == -1 if there was an HTTP error code when sending the event
                yield {
                    "data": {
                        "id": "Unknown",
                        "status": "Errored when sending the event",
                        "progress": -1,
                        "client_id": "Unknown",
                    }
                }
        else:
            yield {
                "data": {
                    "id": "Unknown",
                    "status": "Unknown or Complete",
                    "progress": -1,
                    "client_id": "Unknown",
                }
            }

    except Exception as e:
        log.error("Error in task_status_generator: %s", e)


# Stream Task status
@router.get(
    path="/stream/task/{task_id}",
    tags=["Server Sent Event (SSE) Stream"],
    operation_id="get_task_status",
)
def get_task(request: Request, task_id: str):
    client_id = "unknown"
    if request.client:
        client_id = f"{request.client.host}:{request.client.port}"
    log.info("New SSE client for /stream/task/%s: %s", task_id, client_id)
    return EventSourceResponse(task_status_generator(task_id))


async def client_stats_generator(request: Request):
    """
    Stream SSE client statistics in real-time.

    This generator monitors the sse_clients dictionary and emits updates
    whenever the client list changes (clients connect/disconnect) or
    when queue sizes change significantly.
    """
    try:
        previous_client_count = len(sse_clients)
        previous_client_ids = set(sse_clients.keys())
        previous_queue_sizes: dict[str, int] = {}

        log.info("Client stats stream started")

        while True:
            # Check if the requesting client disconnected
            if await request.is_disconnected():
                log.debug("Client stats stream: client disconnected")
                break

            # Check current state
            current_client_count = len(sse_clients)
            current_client_ids = set(sse_clients.keys())

            # Calculate current queue sizes
            current_queue_sizes = {
                client_id: queue.qsize() for client_id, queue in sse_clients.items()
            }

            # Detect changes in client list or queue sizes
            queue_sizes_changed = current_queue_sizes != previous_queue_sizes
            clients_changed = current_client_count != previous_client_count
            client_ids_changed = current_client_ids != previous_client_ids
            client_list_changed = clients_changed or client_ids_changed

            if client_list_changed or queue_sizes_changed:
                # Calculate statistics
                stats = []
                total_queued = 0

                for client_id, queue in sse_clients.items():
                    queue_size = queue.qsize()
                    total_queued += queue_size
                    stats.append(
                        {
                            "client_id": client_id,
                            "queue_size": queue_size,
                            "queue_full": queue.full(),
                            "utilization_pct": round((queue_size / MAX_QUEUE_SIZE) * 100, 1),
                            "is_slow": queue_size > SLOW_CLIENT_THRESHOLD,
                        }
                    )

                payload = {
                    "total_clients": len(sse_clients),
                    "total_queued_events": total_queued,
                    "max_queue_size": MAX_QUEUE_SIZE,
                    "slow_client_threshold": SLOW_CLIENT_THRESHOLD,
                    "avg_utilization_pct": round(
                        (
                            (total_queued / (len(sse_clients) * MAX_QUEUE_SIZE) * 100)
                            if sse_clients
                            else 0
                        ),
                        1,
                    ),
                    "clients": sorted(stats, key=lambda x: x["queue_size"], reverse=True),
                }

                yield {"data": json.dumps(payload)}

                # Update tracking variables
                previous_client_count = current_client_count
                previous_client_ids = current_client_ids
                previous_queue_sizes = current_queue_sizes

                log.debug(
                    f"Client stats update: {current_client_count} clients, {total_queued} queued"
                )

            # Sleep briefly before checking again
            await asyncio.sleep(0.5)

    except (asyncio.CancelledError, GeneratorExit):
        log.debug("Client stats generator cancelled")
    except Exception as e:
        log.error("Error in client_stats_generator: %s", e)


# Stream client statistics
@router.get(
    path="/stream/clients",
    tags=["Server Sent Event (SSE) Stream"],
    operation_id="stream_client_stats",
)
async def stream_client_stats(request: Request):
    """
    SSE endpoint that streams real-time SSE client statistics.

    Emits updates whenever clients connect or disconnect.
    Useful for monitoring system health and client behavior.
    """
    client_id = "unknown"
    if request.client:
        client_id = f"{request.client.host}:{request.client.port}"
    log.info("New SSE client for /stream/clients: %s", client_id)
    return EventSourceResponse(client_stats_generator(request))


# Generator for task statistics
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
                {"active_tasks": [task for task in active_tasks.values()]}, sort_keys=True
            )

            # Only emit if state has changed
            if current_state != previous_state:
                yield dict(
                    event="message",
                    data=json.dumps({"active_tasks": [task for task in active_tasks.values()]}),
                )
                previous_state = current_state

            # Check for changes every 500ms
            await asyncio.sleep(0.5)

    except (asyncio.CancelledError, GeneratorExit):
        log.debug("Task stats generator cancelled")
    except Exception as e:
        log.error("Error in task_stats_generator: %s", e)


# Stream task statistics
@router.get(
    path="/stream/tasks",
    tags=["Server Sent Event (SSE) Stream"],
    operation_id="stream_task_stats",
)
async def stream_task_stats(request: Request):
    """
    SSE endpoint that streams real-time active task statistics.

    Emits updates whenever tasks are created, updated, or completed.
    Useful for monitoring background task status in admin interface.
    """
    client_id = "unknown"
    if request.client:
        client_id = f"{request.client.host}:{request.client.port}"
    log.info("New SSE client for /stream/tasks: %s", client_id)
    return EventSourceResponse(task_stats_generator(request))
