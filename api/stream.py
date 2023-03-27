import asyncio
import datetime

from fastapi import (
    APIRouter,
    Request
)
from sse_starlette.sse import EventSourceResponse

from .globals import sse_clients
from .constants import MAX_QUEUE_SIZE


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


# SSE Generator
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
                await asyncio.sleep(0.2)

        except Exception as e:
            print(f"Error in event_generator: {e}")

        # Handle client disconnection
        finally:
            del sse_clients[client_id]


# Streaming Route
@router.get(path="/stream",
            tags=['Server Sent Event (SSE) Stream'],
            operation_id="sse_stream")
async def sse_stream(request: Request):
    client_id = None
    if request.client:
        # Add an individual queue for each new client
        client_id = f"{request.client.host}:{request.client.port}"
        sse_clients[client_id] = asyncio.Queue(MAX_QUEUE_SIZE)
    return EventSourceResponse(event_generator(client_id, request))
