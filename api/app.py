import asyncio
import datetime

from fastapi import FastAPI, Request, Header, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from typing import AsyncGenerator


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
              version="0.1.0",
              description=description,
              docs_url="/api/docs",
              redoc_url=None,
              openapi_url="/api/v1/oas.json"
              )


log_queue = asyncio.Queue()


async def generate_log_messages() -> AsyncGenerator[str, None]:
    while True:
        message = await log_queue.get()
        if message is None:
            break
        now = datetime.datetime.now()
        date_str = now.strftime("%Y-%M-%d")
        time_str = now.strftime("%H:%M:%S.%f")
        timestamp = f"{date_str} at {time_str}"
        sse_message = f"data: {{\"time\": \"{timestamp}\", \"cloudevent\": \"{message}\"}}\n\n"
        yield sse_message


async def validate_cloud_event(content_type: str = Header(...)):
    if content_type != "application/cloudevents+json":
        raise HTTPException(status_code=400, detail="Only CloudEvents are supported! (Missing Content-Type: application/cloudevents+json)")


async def handle_event(payload: dict):
    try:
        await log_queue.put(payload)
    except Exception as e:
        await log_queue.put(f"Error handling event: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


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
        return {"status": "well received."}
    except Exception as e:
        await log_queue.put(f"Error handling event: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get(path="/stream",
         tags=['Streaming'],
         operation_id="stream_events")
async def stream_events():
    return StreamingResponse(generate_log_messages(), media_type="text/event-stream")
