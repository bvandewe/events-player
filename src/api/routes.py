import datetime
import json
import logging
import uuid
from typing import Optional, Dict

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
from pydantic import BaseModel

from .settings import settings
from .globals import active_tasks, sse_clients
from .models import EventGeneratorRequest, EventGeneratorTask, CloudEvent
from .background_tasks import handle_event, handle_generator_request
from .validator import validate_cloud_event
from .constants import MAX_QUEUE_SIZE, SLOW_CLIENT_THRESHOLD
from .auth import (
    get_current_user_optional,
    get_current_user_required,
    require_admin,
    require_operator,
    exchange_oauth_code,
    refresh_access_token,
)


log = logging.getLogger(__name__)

templates = Jinja2Templates(directory="static")
router = APIRouter()


# Root Route
@router.get(path="/", tags=["Frontend"], operation_id="get_root", response_class=HTMLResponse)
async def get_ui(
    request: Request, current_user: Optional[dict] = Depends(get_current_user_optional)
):
    tag = settings.tag
    year = datetime.datetime.now().year
    default_events_settings = settings.default_generator_event.model_dump()
    # Convert event_data dict to JSON string to avoid Python True/False in template
    default_events_settings["event_data"] = json.dumps(default_events_settings["event_data"])
    default_events_gateways = settings.default_generator_gateways.model_dump()
    log.debug("Received request on root: %s", request)

    # Extract user roles for authorization
    user_roles = current_user.get("roles", []) if current_user else []
    is_admin = settings.auth_role_admin in user_roles
    is_operator = settings.auth_role_operator in user_roles or is_admin

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
            # Storage configuration for frontend
            "storage_max_recent_events": settings.storage_max_recent_events,
            "storage_max_metadata_events": settings.storage_max_metadata_events,
            # Auth configuration for frontend
            "oauth_url": settings.oauth_server_url_external or settings.oauth_server_url,
            "oauth_realm": settings.oauth_realm,
            "oauth_client_id": settings.oauth_client_id,
            # User authorization info
            "user_authenticated": current_user is not None,
            "user_is_admin": is_admin,
            "user_is_operator": is_operator,
        },
    )


# Timeline View Route
@router.get(
    path="/timeline", tags=["Frontend"], operation_id="get_timeline", response_class=HTMLResponse
)
async def get_timeline(
    request: Request, current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Timeline visualization view"""
    year = datetime.datetime.now().year
    default_events_settings = settings.default_generator_event.model_dump()
    # Convert event_data dict to JSON string to avoid Python True/False in template
    default_events_settings["event_data"] = json.dumps(default_events_settings["event_data"])
    default_events_gateways = settings.default_generator_gateways.model_dump()
    log.debug("Received request on timeline: %s", request)

    # Extract user roles for authorization
    user_roles = current_user.get("roles", []) if current_user else []
    is_admin = settings.auth_role_admin in user_roles
    is_operator = settings.auth_role_operator in user_roles or is_admin

    return templates.TemplateResponse(
        "html/timeline.html",
        {
            "request": request,
            "tag": settings.tag,
            "repo_url": settings.repository_url,
            "year": year,
            "default_events_settings": default_events_settings,
            "default_events_gateways": default_events_gateways,
            "browser_queue_size": settings.browser_queue_size,
            # Storage configuration for frontend
            "storage_max_recent_events": settings.storage_max_recent_events,
            "storage_max_metadata_events": settings.storage_max_metadata_events,
            # Auth configuration for frontend
            "oauth_url": settings.oauth_server_url_external or settings.oauth_server_url,
            "oauth_realm": settings.oauth_realm,
            "oauth_client_id": settings.oauth_client_id,
            # User authorization info
            "user_authenticated": current_user is not None,
            "user_is_admin": is_admin,
            "user_is_operator": is_operator,
        },
    )


# Dashboard View Route
@router.get(
    path="/dashboard", tags=["Frontend"], operation_id="get_dashboard", response_class=HTMLResponse
)
async def get_dashboard(
    request: Request, current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Metrics dashboard view"""
    year = datetime.datetime.now().year
    default_events_settings = settings.default_generator_event.model_dump()
    # Convert event_data dict to JSON string to avoid Python True/False in template
    default_events_settings["event_data"] = json.dumps(default_events_settings["event_data"])
    default_events_gateways = settings.default_generator_gateways.model_dump()
    log.debug("Received request on dashboard: %s", request)

    # Extract user roles for authorization
    user_roles = current_user.get("roles", []) if current_user else []
    is_admin = settings.auth_role_admin in user_roles
    is_operator = settings.auth_role_operator in user_roles or is_admin

    return templates.TemplateResponse(
        "html/dashboard.html",
        {
            "request": request,
            "tag": settings.tag,
            "repo_url": settings.repository_url,
            "year": year,
            "default_events_settings": default_events_settings,
            "default_events_gateways": default_events_gateways,
            "browser_queue_size": settings.browser_queue_size,
            # Storage configuration for frontend
            "storage_max_recent_events": settings.storage_max_recent_events,
            "storage_max_metadata_events": settings.storage_max_metadata_events,
            # Auth configuration for frontend
            "oauth_url": settings.oauth_server_url_external or settings.oauth_server_url,
            "oauth_realm": settings.oauth_realm,
            "oauth_client_id": settings.oauth_client_id,
            # User authorization info
            "user_authenticated": current_user is not None,
            "user_is_admin": is_admin,
            "user_is_operator": is_operator,
        },
    )


# Authentication Endpoints


class OAuthCallbackRequest(BaseModel):
    """OAuth callback request model"""

    code: str
    redirect_uri: str
    code_verifier: str  # PKCE code verifier


class TokenRefreshRequest(BaseModel):
    """Token refresh request model"""

    refresh_token: str


@router.get(
    path="/api/auth/info",
    tags=["System"],
    operation_id="get_auth_info",
    summary="Get current authentication status",
)
async def get_auth_info(user: Optional[Dict] = Depends(get_current_user_optional)):
    """
    Return current authentication status and user information.

    This endpoint helps the frontend determine:
    - Whether the user is authenticated (Istio mode with JWT)
    - User information if authenticated
    - Whether to show login button
    """
    if user:
        return {
            "authenticated": True,
            "user": {
                "user_id": user.get("user_id"),
                "email": user.get("email"),
                "username": user.get("username"),
                "full_name": user.get("full_name"),
                "roles": user.get("roles", []),
                "groups": user.get("groups", []),
            },
            "mode": (
                "istio" if settings.auth_jwks_url and not settings.oauth_server_url else "unknown"
            ),
        }

    return {
        "authenticated": False,
        "user": None,
        "mode": "oauth" if settings.oauth_server_url else "none",
        "oauth_config": (
            {
                "url": settings.oauth_server_url_external or settings.oauth_server_url,
                "realm": settings.oauth_realm,
                "client_id": settings.oauth_client_id,
            }
            if settings.oauth_server_url
            else None
        ),
    }


@router.post(
    path="/api/auth/callback",
    tags=["System"],
    operation_id="oauth_callback",
    summary="OAuth callback handler",
)
async def oauth_callback(callback_request: OAuthCallbackRequest):
    """
    Exchange OAuth authorization code for access token.

    This endpoint is called by the frontend after the user completes
    the OAuth flow with the identity provider.
    """
    try:
        # Exchange code for token
        token_data = await exchange_oauth_code(
            callback_request.code,
            callback_request.redirect_uri,
            callback_request.code_verifier,
        )

        # Validate the access token to get user info
        from .auth import jwt_validator

        token_payload = await jwt_validator.validate_token(token_data["access_token"])
        user_info = jwt_validator.extract_user_info(token_payload)

        return {
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in", 300),
            "token_type": token_data.get("token_type", "Bearer"),
            "user_info": {
                "user_id": user_info.get("user_id"),
                "email": user_info.get("email"),
                "username": user_info.get("username"),
                "full_name": user_info.get("full_name"),
                "roles": user_info.get("roles", []),
                "groups": user_info.get("groups", []),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"OAuth callback error: {e}")
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")


@router.post(
    path="/api/auth/refresh",
    tags=["System"],
    operation_id="refresh_token",
    summary="Refresh access token",
)
async def refresh_token(refresh_request: TokenRefreshRequest):
    """
    Refresh the access token using a refresh token.

    This endpoint allows clients to obtain a new access token without
    requiring the user to log in again.
    """
    try:
        # Refresh the access token
        token_data = await refresh_access_token(refresh_request.refresh_token)

        # Optionally validate the new access token to get updated user info
        from .auth import jwt_validator

        try:
            token_payload = await jwt_validator.validate_token(token_data["access_token"])
            user_info = jwt_validator.extract_user_info(token_payload)
        except Exception as e:
            log.warning(f"Failed to validate refreshed token: {e}")
            user_info = None

        response = {
            "access_token": token_data["access_token"],
            "expires_in": token_data.get("expires_in", 300),
            "token_type": token_data.get("token_type", "Bearer"),
        }

        # Include new refresh token if provided
        if "refresh_token" in token_data:
            response["refresh_token"] = token_data["refresh_token"]

        # Include user info if available
        if user_info:
            response["user_info"] = {
                "user_id": user_info.get("user_id"),
                "email": user_info.get("email"),
                "username": user_info.get("username"),
                "full_name": user_info.get("full_name"),
                "roles": user_info.get("roles", []),
                "groups": user_info.get("groups", []),
            }

        return response

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Token refresh error: {e}")
        raise HTTPException(status_code=500, detail=f"Token refresh failed: {str(e)}")


# Publisher Route
@router.post(path="/api/generate", tags=["CloudEvents Publisher"], operation_id="generate_events")
async def generate_events(
    request: Request,
    generator_request: EventGeneratorRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_operator),  # Require admin or operator role
):
    log.debug("Received request on generator: %s", generator_request)

    # Only admin can use iterations > 1 or custom delay (non-default)
    # Default delay is 100ms, operators can use default settings (iterations=1, delay=100)
    if generator_request.iterations > 1 or generator_request.delay != 100:
        if settings.auth_role_admin not in current_user.get("roles", []):
            raise HTTPException(
                status_code=403,
                detail="Only administrators can use iterations > 1 or custom delay settings",
            )

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
@router.get(
    path="/api/tasks",
    tags=["Background Tasks"],
    operation_id="get_active_tasks",
    summary="Get all active generator tasks",
)
async def get_active_tasks(current_user: dict = Depends(require_admin)):
    """
    Get list of all active generator tasks.
    Only accessible by admin users.
    """
    return JSONResponse({"active_tasks": jsonable_encoder(active_tasks)})


@router.post(
    path="/api/tasks/cancel-all",
    tags=["Background Tasks"],
    operation_id="cancel_all_tasks",
    summary="Cancel all active generator tasks",
)
async def cancel_all_tasks(current_user: dict = Depends(require_admin)):
    """
    Cancel all active generator tasks by setting their cancelled flag.
    Tasks will check this flag and stop gracefully.
    Only accessible by admin users.
    """
    count = len(active_tasks)

    # Set cancelled flag on all tasks
    for task in active_tasks.values():
        task.cancelled = True
        task.status = "Cancelling"

    log.info(f"Admin user {current_user.get('username')} cancelled {count} active tasks")

    return {"message": f"Cancelling {count} active task(s)", "tasks_cancelled": count}


@router.post(
    path="/api/task/{task_id}/cancel",
    tags=["Background Tasks"],
    operation_id="cancel_task",
    summary="Cancel a specific generator task",
)
async def cancel_task(task_id: str, current_user: dict = Depends(require_admin)):
    """
    Cancel a specific generator task by setting its cancelled flag.
    The task will check this flag and stop gracefully.
    Only accessible by admin users.
    """
    if task_id in active_tasks:
        task = active_tasks[task_id]
        task.cancelled = True
        task.status = "Cancelling"

        log.info(f"Admin user {current_user.get('username')} cancelled task {task_id}")

        return {"message": f"Task {task_id} is being cancelled", "task_id": task_id}

    return JSONResponse(status_code=404, content={"message": "Task not found", "task_id": task_id})


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
