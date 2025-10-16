import asyncio
import datetime
import json
import logging
import uuid

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from .globals import sse_clients, active_tasks
from .models import EventGeneratorRequest, EventGeneratorTask, CloudEvent
from .settings import settings


log = logging.getLogger(__name__)


async def handle_event(payload: dict):
    try:
        log.info("Handling event to %s clients: %s", len(sse_clients), payload)
        for client_queue in sse_clients.values():
            await client_queue.put(payload)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}") from e


async def handle_generator_request(
    generator_request: EventGeneratorRequest, task: EventGeneratorTask
):
    iterations = generator_request.iterations
    delay_ms = generator_request.delay

    try:
        log.info(
            "Task %s: Handling generator request for %s iterations to %s",
            task.id,
            iterations,
            generator_request.event_gateway,
        )
        for i in range(iterations):
            log.debug(
                "POST event #%s/%s with type %s",
                i + 1,
                iterations,
                generator_request.event_type,
            )
            try:
                data = json.loads(generator_request.event_data)
            except json.JSONDecodeError as e:
                log.warning("Invalid JSON in event_data: %s", e)
                data = {
                    "error": "Invalid JSON format",
                    "raw_data": generator_request.event_data,
                    "parse_error": str(e),
                }

            event = CloudEvent(
                id=str(uuid.uuid4()),
                time=datetime.datetime.now(),
                type=generator_request.event_type,
                source=generator_request.event_source,
                subject=generator_request.event_subject,
                data=data,
            )
            log.debug("Event payload: %s", event.model_dump())
            try:
                async with httpx.AsyncClient(timeout=settings.http_client_timeout) as client:
                    response = await client.post(
                        str(generator_request.event_gateway),
                        json=event.model_dump(mode="json"),
                        headers={"Content-Type": "application/cloudevents+json"},
                    )
                    response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                active_tasks.pop(task.id, None)
                log.error("HTTP error occurred when posting to gateway: %s", exc)
                raise HTTPException(
                    status_code=502,
                    detail=f"Bad Gateway: Failed to post event to {generator_request.event_gateway}",
                ) from exc

            progress = round((i + 1) / iterations * 100)

            task.progress = progress
            if 0 < progress < 100:
                task.status = "Running"
            else:
                task.status = "Completed"

            # Update current task progress
            if task.id in active_tasks and task.progress >= 0:
                active_tasks[task.id] = task
            elif task.progress == -1:
                active_tasks.pop(task.id, None)
                raise HTTPException(
                    status_code=500, detail=f"Task {task.id} didnt complete or failed!"
                )
            else:
                raise HTTPException(status_code=500, detail=f"Task {task.id} does not exist!")

            # wait for the requested delay
            await asyncio.sleep(delay_ms / 1000)

        # Remove task from active tasks when completed
        log.info("Task %s is completed", task.id)
        active_tasks.pop(task.id, None)

    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}") from e
