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
        # Use 'events-' prefix to avoid collision with other SSE streams
        client_id = f"events-{request.client.host}:{request.client.port}"
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


# Generator for unified metadata (tasks + clients)
async def metadata_generator(request: Request):
    """
    Unified SSE generator that streams all metadata updates:
    - Active tasks
    - SSE client statistics
    - Combined stats

    This reduces the need for multiple SSE connections and polling.
    """
    try:
        previous_task_state = None
        previous_client_count = -1  # Force initial emit
        previous_client_ids = set()  # type: set[str]
        previous_queue_sizes: dict[str, int] = {}

        log.info("Metadata stream started")

        while True:
            # Check if the requesting client disconnected
            if await request.is_disconnected():
                log.debug("Metadata stream: client disconnected")
                break

            # ===== TASK STATISTICS =====
            current_task_state = json.dumps(
                {"active_tasks": [task.model_dump() for task in active_tasks.values()]},
                sort_keys=True,
            )

            if current_task_state != previous_task_state:
                yield dict(
                    event="tasks",
                    data=json.dumps(
                        {"active_tasks": [task.model_dump() for task in active_tasks.values()]}
                    ),
                )
                previous_task_state = current_task_state
                log.debug("Metadata stream: tasks update sent")

            # ===== CLIENT STATISTICS =====
            current_client_count = len(sse_clients)
            current_client_ids = set(sse_clients.keys())
            current_queue_sizes = {
                client_id: queue.qsize() for client_id, queue in sse_clients.items()
            }

            queue_sizes_changed = current_queue_sizes != previous_queue_sizes
            clients_changed = current_client_count != previous_client_count
            client_ids_changed = current_client_ids != previous_client_ids
            client_list_changed = clients_changed or client_ids_changed
            is_first_emit = previous_client_count == -1

            if client_list_changed or queue_sizes_changed or is_first_emit:
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

                client_stats_payload = {
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

                yield dict(event="clients", data=json.dumps(client_stats_payload))

                previous_client_count = current_client_count
                previous_client_ids = current_client_ids
                previous_queue_sizes = current_queue_sizes

                log.debug(
                    f"Metadata stream: clients update sent ({current_client_count} clients, {total_queued} queued)"
                )

            # Check for changes every 500ms
            await asyncio.sleep(0.5)

    except (asyncio.CancelledError, GeneratorExit):
        log.debug("Metadata generator cancelled")
    except Exception as e:
        log.error("Error in metadata_generator: %s", e)


# Stream unified metadata (tasks + clients)
@router.get(
    path="/stream/meta",
    tags=["Server Sent Event (SSE) Stream"],
    operation_id="stream_metadata",
)
async def stream_metadata(request: Request):
    """
    SSE endpoint that streams all metadata updates in a unified stream:
    - Active tasks (event: 'tasks')
    - SSE client statistics (event: 'clients')

    This reduces the need for multiple SSE connections and polling,
    allowing the frontend to use just two SSE connections total:
    1. /stream/events for CloudEvents
    2. /stream/meta for all metadata

    Events are sent with specific event types that the frontend can listen for.
    """
    client_id = "unknown"
    if request.client:
        client_id = f"{request.client.host}:{request.client.port}"
    log.info("New SSE client for /stream/meta: %s", client_id)
    return EventSourceResponse(metadata_generator(request))
