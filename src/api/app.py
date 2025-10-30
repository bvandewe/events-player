import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .description import description
from .routes import router as api_router
from .stream import router as streaming_router
from .settings import settings
from .auth import auth_middleware

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
    swagger_ui_init_oauth=(
        {
            "clientId": settings.oauth_client_id,
            "appName": "CloudEvents Player",
            "usePkceWithAuthorizationCodeGrant": True,
        }
        if settings.oauth_client_id
        else None
    ),
)

# CORS middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8884",
        "http://localhost:1234",
        "http://localhost:8090",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


# Authentication middleware
app.middleware("http")(auth_middleware)


# Customize OpenAPI schema to include OAuth2 security
def custom_openapi():
    """Customize OpenAPI schema with OAuth2 security definitions."""
    if app.openapi_schema:
        return app.openapi_schema

    from fastapi.openapi.utils import get_openapi

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # Add security schemes if OAuth is configured
    if settings.oauth_server_url and settings.oauth_client_id:
        auth_url = (
            f"{settings.oauth_base_url}/realms/{settings.oauth_realm}/protocol/openid-connect/auth"
        )
        token_url = (
            f"{settings.oauth_base_url}/realms/{settings.oauth_realm}/protocol/openid-connect/token"
        )

        # Ensure components exists
        if "components" not in openapi_schema:
            openapi_schema["components"] = {}
        if "securitySchemes" not in openapi_schema["components"]:
            openapi_schema["components"]["securitySchemes"] = {}

        # Add OAuth2 scheme (in addition to HTTPBearer which is auto-generated)
        openapi_schema["components"]["securitySchemes"]["OAuth2AuthorizationCode"] = {
            "type": "oauth2",
            "flows": {
                "authorizationCode": {
                    "authorizationUrl": auth_url,
                    "tokenUrl": token_url,
                    "scopes": {
                        "openid": "OpenID Connect",
                        "profile": "User profile information",
                        "email": "User email address",
                    },
                }
            },
        }

        # Apply OAuth2 security to protected endpoints (HTTPBearer is already applied by FastAPI)
        # Endpoints that require authentication will show the lock icon in Swagger UI
        protected_paths = [
            "/api/generate",  # Requires operator role
            "/api/tasks",  # Requires admin role
            "/api/tasks/cancel-all",  # Requires admin role
            "/api/task/{task_id}/cancel",  # Requires admin role
        ]

        for path, path_item in openapi_schema.get("paths", {}).items():
            # Check if this path is protected
            if path in protected_paths:
                # Apply security to all methods for this path
                for method in path_item.values():
                    if isinstance(method, dict):
                        # Add OAuth2 as an alternative to the HTTPBearer that's already there
                        if "security" in method:
                            # Append OAuth2 to existing security
                            method["security"].append(
                                {"OAuth2AuthorizationCode": ["openid", "profile", "email"]}
                            )
                        else:
                            # Set both HTTPBearer and OAuth2
                            method["security"] = [
                                {"HTTPBearer": []},
                                {"OAuth2AuthorizationCode": ["openid", "profile", "email"]},
                            ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


# Override the openapi method
app.openapi = custom_openapi  # type: ignore[method-assign]


app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(api_router)
app.include_router(streaming_router)
