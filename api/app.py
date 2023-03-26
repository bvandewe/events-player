import asyncio
import datetime
import httpx
import json
import uuid

from fastapi import FastAPI, Request, Response, Header, HTTPException, Depends, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, AnyUrl, validator, ValidationError


from sse_starlette.sse import EventSourceResponse


# Constants
MAX_QUEUE_SIZE = 5000
description = """
## Overview

This micro-app serves as a test subscriber of CloudEvents.

It offers a web-based interface that allows users to:

1. quickly visualize the events received on its `POST /events/pub` endpoint;
2. generate a sequence of custom CloudEvents that are sent to a user-defined Gateway;

Note that it does NOT persist data anywhere, so refreshing the page on the browser will reset the state.

### Frontend

The root URL shows a simple HTML page that automatically refreshes as new CloudEvents are received by the backend.

The UI stacks events as they are received, showing the most recent one on top.

There is a filter input box that allows users to search for any string in any event.
Upon submitting a filter string, the UI will search for a match in any field of an event and will show or hide events accordingly.

By clicking on any event header, users can toggle the display of its details.
There is also a ToggleAll button next to the filter to expand or collapse all events.

Finally, an overlay panel enables users to define a sequence of CloudEvents that the backend will send.
Upon submission, the backend will validate the `CloudEvent Generation` request. If the request is valid,
it will generate the sequence of events and will send them to a user-defined Gateway. If the request is invalid
(for example the Gateway URI is wrong), the backend will return a message to the user providing details about the error.

Assuming that the app is also subscribed to the Gateway, it might show events that were generated,
ingested by the Gateway and finally forwarded to the app as a subscriber of the Gateway!

### CloudEvents

This app provides an endpoint at `/events/pub` that accepts HTTP POST requests with CloudEvents payloads.
To be valid, the payload must have the `Content-Type` header set to `application/cloudevents+json`
and be formatted as per the CloudEvents Specifications v1.0.2 in JSON Format (That validation is currently missing!).

When an event is received, it is consumed by a background task that adds a copy to the queue of each active clients
(i.e. browsers that are currently connected to the `/stream` route).

### Streaming

The SSE stream (at `/stream`) is an always-on HTTP2 connection that is loaded by Javascript on the index.html page.
Whenever the `/events/pub` route received an event, it copies it to the queue of each active client.

In turn, the `/stream` route runs an infinite loop that dequeues events from each of the client's queue and sends it as a JSON payload,
including a timestamp indicating when the event was sent to the client. The UI renders these events as explained above...

"""


# Global Variable
sse_clients = {}


# App
templates = Jinja2Templates(directory="templates")
app = FastAPI(title="CloudEvents Viewer",
              version="0.1.1",
              description=description,
              docs_url="/api/docs",
              redoc_url=None,
              openapi_url="/api/v1/oas.json"
              )
app.mount("/static", StaticFiles(directory="static"), name="static")


# Prevents the UI from getting errors - for some reason !?!
# @app.exception_handler(RequestValidationError)
# async def validation_exception_handler(request: Request, exc: RequestValidationError):
#     return JSONResponse(content={"message": "Validation error", "details": exc.errors()}, status_code=422)


# Model
class EventGeneratorRequest(BaseModel):
    event_gateway: AnyUrl
    event_source: str
    event_type: str
    event_data: str
    iterations: str
    delay: str | None

    @validator('iterations')
    def check_positive_iterations(cls, value):
        int_value = int(value)
        if int_value < 0:
            raise ValueError('Iterations value must be a positive integer')
        return int_value

    @validator('delay')
    def check_positive_delay(cls, value):
        int_value = int(value)
        if int_value < 0:
            raise ValueError('Delay value must be a positive integer')
        return int_value

    class Config:
        extra = 'forbid'


# Validator
async def validate_cloud_event(content_type: str = Header(...)):
    # TODO: add validation of the event attributes!
    if content_type != "application/cloudevents+json":
        raise HTTPException(status_code=400, detail="Only CloudEvents are supported! (Missing Content-Type: application/cloudevents+json)")


# Background Task
async def handle_event(payload: dict):
    try:
        print(f"Handling event to {len(sse_clients)} clients: {payload}")
        for client_queue in sse_clients.values():
            await client_queue.put(payload)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# Background Task
async def handle_generator_request(generator_request: EventGeneratorRequest):
    try:
        print(f"Handling generator request for {generator_request.iterations} iterations to {generator_request.event_gateway}")
        for i in range(int(generator_request.iterations)):
            print(f"POST event with type {generator_request.event_type}")
            try:
                data = json.loads(generator_request.event_data)
            except json.JSONDecodeError as e:
                data = {"error": f"Error parsing JSON:{e}"}

            event = {
                "specversion": "1.0",
                "id": str(uuid.uuid4()),
                "time": datetime.datetime.now().isoformat(),
                "datacontenttype": "application/json",
                "type": generator_request.event_type,
                "source": generator_request.event_source,
                "data": data
            }
            # print(event)
            async with httpx.AsyncClient() as client:
                response = await client.post(generator_request.event_gateway, json=event, headers={"Content-Type": "application/cloudevents+json"})
                response.raise_for_status()

    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# Root Route
@app.get(path="/",
         tags=['Frontend'],
         operation_id="get_root",
         response_class=HTMLResponse)
async def get_ui(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# Publisher Route
@app.post(path="/api/generate",
          tags=['CloudEvents Publisher'],
          operation_id="generate_events")
async def generate_events(generator_request: EventGeneratorRequest, background_tasks: BackgroundTasks):
    try:
        print(generator_request)
        background_tasks.add_task(handle_generator_request, generator_request)

        result = {
            "message": "Ok. Working on it...",
            "status": "success"
        }
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# Subscriber Route
@app.post(path="/events/pub",
          tags=['CloudEvents Subscriber'],
          operation_id="handle_events")
async def handle_events(payload: dict, background_tasks: BackgroundTasks, content_type: str = Header(...), valid_event: bool = Depends(validate_cloud_event)):
    try:
        background_tasks.add_task(handle_event, payload)
        return Response(status_code=202)
    except Exception as e: 
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# Background Task
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
@app.get(path="/stream",
         tags=['Server Sent Event (SSE) Stream'],
         operation_id="sse_stream")
async def sse_stream(request: Request):
    client_id = None
    if request.client:
        # Add an individual queue for each new client
        client_id = f"{request.client.host}:{request.client.port}"
        sse_clients[client_id] = asyncio.Queue(MAX_QUEUE_SIZE)
    return EventSourceResponse(event_generator(client_id, request))
