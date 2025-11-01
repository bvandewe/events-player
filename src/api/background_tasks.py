import asyncio
import datetime
import json
import logging
import uuid
from typing import Set

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from .globals import sse_clients, active_tasks
from .models import EventGeneratorRequest, EventGeneratorTask, CloudEvent
from .settings import settings


log = logging.getLogger(__name__)


async def _send_to_client(client_id: str, queue: asyncio.Queue, payload: dict):
    """
    Send event to a single client with error handling.
    Uses put_nowait to avoid blocking if queue is full.
    """
    try:
        queue.put_nowait(payload)
    except asyncio.QueueFull:
        log.warning(
            f"Queue full for client {client_id}, dropping event and disconnecting slow client"
        )
        # Disconnect slow clients to protect system performance
        if client_id in sse_clients:
            del sse_clients[client_id]
            log.info(f"Disconnected slow client {client_id}")
    except Exception as e:
        log.error(f"Error sending to client {client_id}: {e}")


async def handle_event(payload: dict):
    """
    Broadcast event to all SSE clients using async fan-out.
    This prevents slow clients from blocking event distribution.
    """
    try:
        if not sse_clients:
            log.debug("No SSE clients connected, skipping event broadcast")
            return

        log.info("Broadcasting event to %s clients", len(sse_clients))

        # Create tasks for all clients in parallel (async fan-out)
        tasks: Set[asyncio.Task] = set()

        for client_id, client_queue in list(sse_clients.items()):
            task = asyncio.create_task(_send_to_client(client_id, client_queue, payload))
            tasks.add(task)
            # Clean up completed tasks to prevent memory leak
            task.add_done_callback(tasks.discard)

        # Fire and forget - events are delivered asynchronously
        # This prevents blocking the main event handler

    except Exception as e:
        log.error(f"Error in handle_event: {e}")
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
            # Check if task has been cancelled
            if task.cancelled:
                log.info("Task %s was cancelled, stopping generation", task.id)
                task.status = "Cancelled"
                active_tasks.pop(task.id, None)
                return

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
                task.status = "Failed"
                task.progress = -1
                raise HTTPException(
                    status_code=502,
                    detail=f"Bad Gateway: Failed to post event to {generator_request.event_gateway} - HTTP {exc.response.status_code}",
                ) from exc
            except httpx.ConnectError as exc:
                active_tasks.pop(task.id, None)
                log.error(
                    "Connection error when posting to gateway %s: %s",
                    generator_request.event_gateway,
                    exc,
                )
                task.status = "Failed"
                task.progress = -1
                raise HTTPException(
                    status_code=503,
                    detail=f"Service Unavailable: Could not connect to {generator_request.event_gateway}",
                ) from exc
            except httpx.TimeoutException as exc:
                active_tasks.pop(task.id, None)
                log.error(
                    "Timeout when posting to gateway %s: %s", generator_request.event_gateway, exc
                )
                task.status = "Failed"
                task.progress = -1
                raise HTTPException(
                    status_code=504,
                    detail=f"Gateway Timeout: Request to {generator_request.event_gateway} timed out",
                ) from exc
            except httpx.RequestError as exc:
                active_tasks.pop(task.id, None)
                log.error(
                    "Request error when posting to gateway %s: %s",
                    generator_request.event_gateway,
                    exc,
                )
                task.status = "Failed"
                task.progress = -1
                raise HTTPException(
                    status_code=502,
                    detail=f"Bad Gateway: Error sending request to {generator_request.event_gateway} - {type(exc).__name__}",
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
