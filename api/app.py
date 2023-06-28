from fastapi import FastAPI

from fastapi.staticfiles import StaticFiles

from .description import description
from .routes import router as api_router
from .stream import router as streaming_router


app = FastAPI(title="CloudEvents Viewer",
              version="0.1.13",
              description=description,
              docs_url="/api/docs",
              redoc_url=None,
              openapi_url="/api/v1/oas.json"
              )
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(api_router)
app.include_router(streaming_router)
