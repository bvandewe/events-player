import logging
import typing

from .settings import settings
from .models import EventGeneratorTask

# Configure logging
logging.basicConfig(format=settings.log_format, level=settings.log_level)
log = logging.getLogger(__name__)


# Global Variable
# THIS IS A PERFORMANCE BOTTLENECK THAT PREVENTS HORIZONTAL SCALING
sse_clients = {}

active_tasks: typing.Dict[str, EventGeneratorTask] = {}
