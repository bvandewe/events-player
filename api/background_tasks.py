import asyncio
import datetime
import httpx
import json
import logging
import uuid

from fastapi import (
    HTTPException
)
from pydantic import ValidationError

from .globals import (
    sse_clients,
    active_tasks
)
from .models import EventGeneratorRequest, EventGeneratorTask


log = logging.getLogger(__name__)


async def handle_event(payload: dict):
    try:
        print(f"Handling event to {len(sse_clients)} clients: {payload}")
        for client_queue in sse_clients.values():
            await client_queue.put(payload)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


async def handle_generator_request(generator_request: EventGeneratorRequest,
                                   task: EventGeneratorTask):
    try:
        log.info(f"Task {task.id}: Handling generator request for {generator_request.iterations} iterations to {generator_request.event_gateway}")
        for i in range(int(generator_request.iterations)):
            log.debug(f"POST event #{i+1}/{int(generator_request.iterations)} with type {generator_request.event_type}")
            try:
                data = json.loads(generator_request.event_data)
            except json.JSONDecodeError as e:
                data = {"error": f"Error parsing JSON: {e}"}

            event = {
                "specversion": "1.0",
                "id": str(uuid.uuid4()),
                "time": datetime.datetime.now().isoformat(),
                "datacontenttype": "application/json",
                "type": generator_request.event_type,
                "source": generator_request.event_source,
                "subject": generator_request.event_subject,
                "data": data
            }
            log.debug(f"Event payload: {event}")
            async with httpx.AsyncClient() as client:
                response = await client.post(generator_request.event_gateway,
                                             json=event,
                                             headers={"Content-Type": "application/cloudevents+json"}
                                             )
                response.raise_for_status()

            progress = round((i + 1) / int(generator_request.iterations) * 100)
            task.progress = progress
            if progress < 100:
                task.status = "Running"
            else:
                task.status = "Completed"

            # Update current task progress
            if task.id in active_tasks:
                active_tasks[task.id] = task
            else:
                raise Exception(f"Task {task.id} does not exist!")

            # wait for the requested delay
            await asyncio.sleep(int(generator_request.delay) / 1000)

        # Remove task from active tasks when completed
        log.info(f"Task {task.id} is completed")
        active_tasks.pop(task.id, None)

    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
