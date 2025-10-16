import asyncio
import datetime
import json
import logging

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from .globals import sse_clients, active_tasks
from .constants import MAX_QUEUE_SIZE


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
            while True:
                # If client closes connection, stop sending events
                if await request.is_disconnected():
                    log.debug("Client %s disconnected", client_id)
                    break

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
