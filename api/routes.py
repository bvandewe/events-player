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
from fastapi.responses import HTMLResponse

from .models import EventGeneratorRequest
from .background_tasks import (
    handle_event,
    handle_generator_request
)
from .validator import validate_cloud_event


templates = Jinja2Templates(directory="templates")
router = APIRouter()


# Root Route
@router.get(path="/",
            tags=['Frontend'],
            operation_id="get_root",
            response_class=HTMLResponse)
async def get_ui(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# Publisher Route
@router.post(path="/api/generate",
             tags=['CloudEvents Publisher'],
             operation_id="generate_events")
async def generate_events(generator_request: EventGeneratorRequest,
                          background_tasks: BackgroundTasks):
    try:
        print(generator_request)
        background_tasks.add_task(handle_generator_request, generator_request)

        result = {
            "message": "Ok. Working on it in the background...",
            "status": "success"
        }
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# Subscriber Route
@router.post(path="/events/pub",
             tags=['CloudEvents Subscriber'],
             operation_id="handle_events")
async def handle_events(payload: dict, 
                        background_tasks: BackgroundTasks,
                        content_type: str = Header(...),
                        valid_event: bool = Depends(validate_cloud_event)):
    try:
        background_tasks.add_task(handle_event, payload)
        return Response(status_code=202)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
