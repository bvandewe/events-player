import datetime
import json
import logging
import uuid

from fastapi import (
    APIRouter,
    Request,
    Response,
    Header,
    HTTPException,
    Depends,
    BackgroundTasks,
)

from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.encoders import jsonable_encoder

from .settings import settings
from .globals import active_tasks, sse_clients
from .models import EventGeneratorRequest, EventGeneratorTask, CloudEvent
from .background_tasks import handle_event, handle_generator_request
from .validator import validate_cloud_event
from .constants import MAX_QUEUE_SIZE, SLOW_CLIENT_THRESHOLD


log = logging.getLogger(__name__)

templates = Jinja2Templates(directory="static")
router = APIRouter()


# Root Route
@router.get(path="/", tags=["Frontend"], operation_id="get_root", response_class=HTMLResponse)
async def get_ui(request: Request):
    tag = settings.tag
    year = datetime.datetime.now().year
    default_events_settings = settings.default_generator_event.model_dump()
    # Convert event_data dict to JSON string to avoid Python True/False in template
    default_events_settings["event_data"] = json.dumps(default_events_settings["event_data"])
    default_events_gateways = settings.default_generator_gateways.model_dump()
    log.debug("Received request on root: %s", request)
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "tag": tag,
            "repo_url": settings.repository_url,
            "year": year,
            "default_events_settings": default_events_settings,
            "default_events_gateways": default_events_gateways,
            "browser_queue_size": settings.browser_queue_size,
        },
    )


# Publisher Route
@router.post(path="/api/generate", tags=["CloudEvents Publisher"], operation_id="generate_events")
async def generate_events(
    request: Request,
    generator_request: EventGeneratorRequest,
    background_tasks: BackgroundTasks,
):
    log.debug("Received request on generator: %s", generator_request)
    try:
        task_id = str(uuid.uuid4())
        client_id = ""
        if request.client:
            client_id = f"{request.client.host}:{request.client.port}"

        current_task = EventGeneratorTask(
            id=task_id, status="Creating", progress=0, client_id=client_id
        )
        active_tasks[task_id] = current_task
        background_tasks.add_task(handle_generator_request, generator_request, task=current_task)
        result = {
            "message": f"Ok. Working on it in the background... (task: {task_id})",
            "status": "success",
            "task_id": task_id,
        }
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# All Tasks Route
@router.get(path="/api/tasks", tags=["Background Tasks"], operation_id="get_active_tasks")
async def get_active_tasks():
    return JSONResponse({"active_tasks": jsonable_encoder(active_tasks)})


@router.delete(path="/api/tasks", tags=["Background Tasks"], operation_id="cancel_all_tasks")
async def cancel_all_tasks(background_tasks: BackgroundTasks):
    """
    Remove all tasks from active_tasks dictionary.
    Note: FastAPI BackgroundTasks don't support cancellation, so tasks will continue running.
    """
    count = len(active_tasks)
    active_tasks.clear()
    return {"message": f"Removed {count} tasks from active_tasks."}


@router.delete(path="/api/task/{task_id}", tags=["Background Tasks"], operation_id="delete_task")
async def cancel_task(task_id: str, background_tasks: BackgroundTasks):
    """
    Remove a task from active_tasks dictionary.
    Note: FastAPI BackgroundTasks don't support cancellation, so the task will continue running.
    """
    if task_id in active_tasks:
        active_tasks.pop(task_id)
        return {"message": "Task removed from active_tasks (but still running in background)."}
    return {"message": "Task not found."}


# Health Check
@router.get(path="/health", tags=["System"], operation_id="health_check")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "active_tasks": len(active_tasks),
        "active_clients": len(sse_clients),
        "version": settings.tag,
    }


# SSE Statistics
@router.get(path="/api/sse/stats", tags=["System"], operation_id="get_sse_stats")
async def get_sse_stats():
    """
    Monitor SSE client queue depths and health.
    Useful for detecting slow clients and system performance issues.
    """
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

    return {
        "total_clients": len(sse_clients),
        "total_queued_events": total_queued,
        "max_queue_size": MAX_QUEUE_SIZE,
        "slow_client_threshold": SLOW_CLIENT_THRESHOLD,
        "avg_utilization_pct": round(
            (total_queued / (len(sse_clients) * MAX_QUEUE_SIZE) * 100) if sse_clients else 0, 1
        ),
        "clients": sorted(stats, key=lambda x: x["queue_size"], reverse=True),
    }


# Subscriber Route
@router.post(path="/events/pub", tags=["CloudEvents Subscriber"], operation_id="handle_events")
async def handle_events(
    payload: dict,
    background_tasks: BackgroundTasks,
    content_type: str = Header(...),
    valid_event: bool = Depends(validate_cloud_event),
):
    log.debug("Received request on events subscriber: %s", payload)
    try:
        # Parse and validate as CloudEvent to ensure proper serialization
        cloud_event = CloudEvent(**payload)
        # Convert back to dict with proper JSON serialization (datetime as ISO string, etc.)
        normalized_payload = cloud_event.model_dump(mode="json")
        background_tasks.add_task(handle_event, normalized_payload)
        return Response(status_code=202)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}") from e


# Favicon
@router.get("/favicon.ico", include_in_schema=False)
async def get_default_favicon():
    return FileResponse("static/img/favicon.ico")


@router.get("/favicon-16x16.ico", include_in_schema=False)
async def get_favicon_16():
    return FileResponse("static/img/favicon-16x16.ico")


@router.get("/favicon-32x32.ico", include_in_schema=False)
async def get_favicon():
    return FileResponse("static/img/favicon-32x32.ico")
