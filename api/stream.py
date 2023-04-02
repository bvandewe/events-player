import asyncio
import datetime
import logging

from fastapi import (
    APIRouter,
    Request
)
from sse_starlette.sse import EventSourceResponse

from .globals import (
    sse_clients,
    active_tasks
)
from .constants import MAX_QUEUE_SIZE


log = logging.getLogger(__name__)

router = APIRouter()


# Utils
async def build_sse_payload(payload: dict):
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S.%f")
    timestamp = f"{date_str} at {time_str}"
    sse_event_payload = {}
    sse_event_payload["time"] = timestamp
    sse_event_payload["cloudevent"] = payload
    return sse_event_payload


async def event_generator(client_id: str | None, request: Request):
    if client_id is not None:
        try:
            while True:
                # If client closes connection, stop sending events
                if await request.is_disconnected():
                    break

                # Dequeue an event if there's one
                sse_message_payload = await sse_clients[client_id].get()
                if sse_message_payload is None:
                    break
                else:
                    sse_message_payload = await build_sse_payload(sse_message_payload)
                    yield {
                        "data": sse_message_payload
                    }
                await asyncio.sleep(0.05)

        except Exception as e:
            log.error(f"Error in event_generator: {e}")

        # Handle client disconnection
        finally:
            del sse_clients[client_id]


# Stream events
@router.get(path="/stream/events",
            tags=['Server Sent Event (SSE) Stream'],
            operation_id="sse_stream")
async def sse_stream(request: Request):
    client_id = None
    if request.client:
        # Add an individual queue for each new client' browser tab
        client_id = f"{request.client.host}:{request.client.port}"
        log.info(f"New SSE client for /stream/events: {client_id}")
        sse_clients[client_id] = asyncio.Queue(MAX_QUEUE_SIZE)
    return EventSourceResponse(event_generator(client_id, request))


async def task_status_generator(task_id: str):
    try:
        if task_id in active_tasks:
            task = active_tasks[task_id]
            while serialized_task := task.json():
                yield {
                    "data": serialized_task
                }
                await asyncio.sleep(0.25)
                if task_id in active_tasks:
                    task = active_tasks[task_id]
                else:
                    break
        else:
            yield {
                "data": {
                    "id": "Unknown",
                    "status": "Unknown or Complete",
                    "progress": -1,
                    "client_id": "Unknown"
                }
            }

    except Exception as e:
        log.error(f"Error in task_status_generator: {e}")


# Stream Task status
@router.get(path="/stream/task/{task_id}",
            tags=['Server Sent Event (SSE) Stream'],
            operation_id="get_task_status")
def get_task(request: Request, task_id: str):
    client_id = f"{request.client.host}:{request.client.port}"
    log.info(f"New SSE client for /stream/task/{task_id}: {client_id}")
    return EventSourceResponse(task_status_generator(task_id))
