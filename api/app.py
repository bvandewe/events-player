import asyncio
import datetime

from fastapi import FastAPI, Request, Response, Header, HTTPException, Depends, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sse_starlette.sse import EventSourceResponse


description = """
## Overview

This micro-app serves as a test subscriber of CloudEvents and offers a web-based interface to quickly visualize the events received on its `POST /events/pub` endpoint. However, it does not persist data anywhere, so refreshing the page on the browser will reset the state.

### Frontend

The root URL shows a simple HTML page that automatically refreshes as new CloudEvents are received by the backend. The UI stacks events to show the most recent one on top. The filter input box allows users to search for any string in any event, and the UI will show or hide events accordingly. By clicking on any event header, users can toggle the display of its details. There is also a ToggleAll button next to the filter to expand or collapse all events.

### CloudEvents

This app provides an endpoint at `/events/pub` that accepts HTTP POST requests with CloudEvents payloads. To be valid, the payload must have the `Content-Type` header set to `application/cloudevents+json` and be formatted as per the CloudEvents Specifications v1.0.2 in JSON Format.

When an event is received, it is added to a queue consumed by a background task that logs the events to a server-sent events (SSE) stream.

### Streaming

The SSE stream can be accessed at `/stream` using a browser or any SSE client. Each received event sends a JSON payload, including the event payload and a timestamp indicating when the event was received.
"""


templates = Jinja2Templates(directory="templates")

app = FastAPI(title="CloudEvents Viewer",
              version="0.1.1",
              description=description,
              docs_url="/api/docs",
              redoc_url=None,
              openapi_url="/api/v1/oas.json"
              )


MAX_QUEUE_SIZE = 2000
sse_clients = {}


async def validate_cloud_event(content_type: str = Header(...)):
    # TODO: add validation of the event attributes!
    if content_type != "application/cloudevents+json":
        raise HTTPException(status_code=400, detail="Only CloudEvents are supported! (Missing Content-Type: application/cloudevents+json)")


async def build_sse_payload(payload: dict):
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S.%f")
    timestamp = f"{date_str} at {time_str}"
    sse_event_payload = {}
    sse_event_payload["time"] = timestamp
    sse_event_payload["cloudevent"] = payload
    return sse_event_payload


async def handle_event(payload: dict):
    try:
        print(f"Handling event to {len(sse_clients)} clients: {payload}")
        for client_queue in sse_clients.values():
            await client_queue.put(payload)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@app.get(path="/",
         tags=['Frontend'],
         operation_id="get_root",
         response_class=HTMLResponse)
async def get_ui(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post(path="/events/pub",
          tags=['CloudEvents'],
          operation_id="post_events")
async def handle_events(payload: dict, background_tasks: BackgroundTasks, content_type: str = Header(...), valid_event: bool = Depends(validate_cloud_event)):
    try:
        background_tasks.add_task(handle_event, payload)
        return Response(status_code=202)
    except Exception as e:
        await events_queue.put(f"Error handling event: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


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


@app.get('/stream')
async def message_stream(request: Request):
    client_id = None
    if request.client:
        # Add an individual queue for each new client
        client_id = f"{request.client.host}:{request.client.port}"
        sse_clients[client_id] = asyncio.Queue(MAX_QUEUE_SIZE)
    return EventSourceResponse(event_generator(client_id, request))
