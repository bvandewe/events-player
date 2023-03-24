import asyncio
import datetime

from fastapi import FastAPI, Request, Header, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from typing import AsyncGenerator

templates = Jinja2Templates(directory="templates")

app = FastAPI(title="CloudEvent Viewer",
              version="0.1.0",
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
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post(path="/events/pub",
          tags=['CloudEvents'],
          operation_id="post_events")
async def post_event(payload: dict, background_tasks: BackgroundTasks, content_type: str = Header(..., alias="Content-Type"), valid_event: bool = Depends(validate_cloud_event)):
    try:
        background_tasks.add_task(handle_event, payload)
        return {"status": "ok"}
    except Exception as e:
        await log_queue.put(f"Error handling event: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/logs")
async def stream_logs():
    return StreamingResponse(generate_log_messages(), media_type="text/event-stream")
