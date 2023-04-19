import logging
import typing

from .settings import settings
from .models import EventGeneratorTask

log = logging.basicConfig(format=settings.log_format, level=settings.log_level)


# Global Variable
sse_clients = {}

active_tasks: typing.Dict[str, EventGeneratorTask] = {}
