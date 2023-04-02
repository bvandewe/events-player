import datetime
import logging
import uuid

from fastapi import (
    APIRouter,
    Request,
    Response,
    Header,
    HTTPException,
    Depends,
    BackgroundTasks
)

from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.encoders import jsonable_encoder

from .settings import settings
from .globals import active_tasks
from .models import EventGeneratorRequest, EventGeneratorTask
from .background_tasks import (
    handle_event,
    handle_generator_request
)
from .validator import validate_cloud_event


log = logging.getLogger(__name__)

templates = Jinja2Templates(directory="static")
router = APIRouter()


# Root Route
@router.get(path="/",
            tags=['Frontend'],
            operation_id="get_root",
            response_class=HTMLResponse)
async def get_ui(request: Request):
    year = datetime.datetime.now().year
    default_events_settings = dict(settings.default_generator_event)
    default_events_gateways = dict(settings.default_generator_gateways)
    log.debug(f"Received request on root: {request}")
    return templates.TemplateResponse("index.html", {"request": request,
                                                     "year": year,
                                                     "default_events_settings": default_events_settings,
                                                     "default_events_gateways": default_events_gateways,
                                                     "browser_queue_size": settings.browser_queue_size})


# Publisher Route
@router.post(path="/api/generate",
             tags=['CloudEvents Publisher'],
             operation_id="generate_events")
async def generate_events(request: Request,
                          generator_request: EventGeneratorRequest,
                          background_tasks: BackgroundTasks):
    log.debug(f"Received request on generator: {generator_request}")
    try:
        task_id = str(uuid.uuid4())
        client_id = ""
        if request.client:
            client_id = f"{request.client.host}:{request.client.port}"

        current_task = EventGeneratorTask(id=task_id,
                                          status="Creating",
                                          progress=0,
                                          client_id=client_id)
        active_tasks[task_id] = current_task
        background_tasks.add_task(handle_generator_request, generator_request, task=current_task)
        result = {
            "message": f"Ok. Working on it in the background... (task: {task_id})",
            "status": "success",
            "task_id": task_id
        }
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# All Tasks Route
@router.get(path="/api/tasks",
            tags=['Background Tasks'],
            operation_id="get_active_tasks")
async def get_active_tasks():
    return JSONResponse({"active_tasks": jsonable_encoder(active_tasks)})


@router.delete(path="/api/tasks",
               tags=['Background Tasks'],
               operation_id="cancel_all_tasks")
async def cancel_all_tasks(background_tasks: BackgroundTasks):
    # This is not working... FastAPI bg tasks do not support cancellation! :(
    i = 0
    for key, val in active_tasks.items():
        active_tasks.pop(key)
        i += 1

    return {'message': f"Cancelled {i} tasks."}


@router.delete(path="/api/task/{task_id}",
               tags=['Background Tasks'],
               operation_id="delete_task")
async def cancel_task(task_id: str, background_tasks: BackgroundTasks):
    for task in background_tasks.tasks:
        if task.id == task_id:
            task.cancel()
            return {"message": "Task cancelled."}
    return {"message": "Task not found."}


# Subscriber Route
@router.post(path="/events/pub",
             tags=['CloudEvents Subscriber'],
             operation_id="handle_events")
async def handle_events(payload: dict,
                        background_tasks: BackgroundTasks,
                        content_type: str = Header(...),
                        valid_event: bool = Depends(validate_cloud_event)):
    log.debug(f"Received request on events subscriber: {payload}")
    try:
        background_tasks.add_task(handle_event, payload)
        return Response(status_code=202)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# Favicon
@router.get("/favicon.ico", include_in_schema=False)
async def get_default_favicon():
    return FileResponse("static/favicon.ico")


@router.get("/favicon-16x16.ico", include_in_schema=False)
async def get_favicon_16():
    return FileResponse("static/favicon-16x16.ico")


@router.get("/favicon-32x32.ico", include_in_schema=False)
async def get_favicon():
    return FileResponse("static/favicon-32x32.ico")
