import asyncio
import logging
import typing

from .settings import settings
from .models import EventGeneratorTask

# Configure logging
logging.basicConfig(format=settings.log_format, level=settings.log_level)
log = logging.getLogger(__name__)

# Asyncio lock-protected shared state; access guarded to prevent races
sse_clients: typing.Dict[str, asyncio.Queue] = {}
sse_clients_lock = asyncio.Lock()

# Dictionary to hold active background tasks
active_tasks: typing.Dict[str, EventGeneratorTask] = {}
active_tasks_lock = asyncio.Lock()
