import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

from .description import description
from .routes import router as api_router
from .stream import router as streaming_router
from .settings import settings

# Request ID context variable for tracing
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

app = FastAPI(
    title="CloudEvents Player",
    version=settings.tag,
    description=description,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/v1/oas.json",
    openapi_tags=[
        {"name": "Frontend", "description": "UI endpoints"},
        {
            "name": "CloudEvents Publisher",
            "description": "Generate and send CloudEvents",
        },
        {
            "name": "CloudEvents Subscriber",
            "description": "Receive and handle CloudEvents",
        },
        {"name": "Background Tasks", "description": "Task management and monitoring"},
        {
            "name": "Server Sent Event (SSE) Stream",
            "description": "Real-time event streaming",
        },
        {"name": "System", "description": "Health checks and system information"},
    ],
)


# Middleware for Request ID tracing
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """
    Add a unique request ID to each HTTP request for tracing.
    The request ID is stored in a context variable and added to response headers.
    """
    request_id = str(uuid.uuid4())
    request_id_var.set(request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(api_router)
app.include_router(streaming_router)
