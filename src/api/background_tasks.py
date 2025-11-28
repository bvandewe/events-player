import asyncio
import datetime
import json
import logging
import random
import string
import uuid
from typing import Set

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from .globals import (
    active_tasks,
    active_tasks_lock,
    sse_clients,
    sse_clients_lock,
)
from .models import CloudEvent, EventGeneratorRequest, EventGeneratorTask
from .settings import settings

log = logging.getLogger(__name__)


def _generate_random_source() -> str:
    """Generate a random event source URL"""
    domains = ["example.com", "myapp.io", "service.net", "platform.cloud", "api.dev"]
    services = ["payment", "order", "user", "inventory", "notification", "analytics"]
    domain = random.choice(domains)
    service = random.choice(services)
    return f"https://{service}.{domain}/events"


def _generate_random_type() -> str:
    """Generate a random event type"""
    companies = ["com", "io", "net", "org"]
    domains = ["acme", "contoso", "fabrikam", "northwind", "adventure"]
    services = ["order", "payment", "shipping", "inventory", "user", "notification"]
    actions = ["created", "updated", "deleted", "completed", "failed", "cancelled"]
    versions = ["v1", "v2", "v3"]

    company = random.choice(companies)
    domain = random.choice(domains)
    service = random.choice(services)
    action = random.choice(actions)
    version = random.choice(versions)

    return f"{company}.{domain}.{service}.{action}.{version}"


def _generate_random_subject() -> str:
    """Generate a random subject (UUID, numeric, or alphanumeric)"""
    subject_type = random.choice(["uuid", "numeric", "alphanumeric"])

    if subject_type == "uuid":
        return str(uuid.uuid4())
    elif subject_type == "numeric":
        return str(random.randint(0, 999999))
    else:  # alphanumeric
        chars = string.ascii_letters + string.digits
        return "".join(random.choices(chars, k=12))


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
        async with sse_clients_lock:
            removed = sse_clients.pop(client_id, None) is not None
        if removed:
            log.info(f"Disconnected slow client {client_id}")
    except Exception as e:
        log.error(f"Error sending to client {client_id}: {e}")


async def handle_event(payload: dict):
    """
    Broadcast event to all SSE clients using async fan-out.
    This prevents slow clients from blocking event distribution.
    """
    try:
        async with sse_clients_lock:
            client_items = list(sse_clients.items())

        if not client_items:
            log.debug("No SSE clients connected, skipping event broadcast")
            return

        log.info("Broadcasting event to %s clients", len(client_items))

        # Create tasks for all clients in parallel (async fan-out)
        tasks: Set[asyncio.Task] = set()

        for client_id, client_queue in client_items:
            task = asyncio.create_task(
                _send_to_client(client_id, client_queue, payload)
            )
            tasks.add(task)
            # Clean up completed tasks to prevent memory leak
            task.add_done_callback(tasks.discard)

        # Fire and forget - events are delivered asynchronously
        # This prevents blocking the main event handler

    except Exception as e:
        log.error(f"Error in handle_event: {e}")
        raise HTTPException(
            status_code=500, detail=f"Internal server error: {e}"
        ) from e


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
                async with active_tasks_lock:
                    active_tasks.pop(task.id, None)
                return

            # Apply randomization if enabled for iterations > 1
            event_source = generator_request.event_source
            event_type = generator_request.event_type
            event_subject = generator_request.event_subject

            if iterations > 1:
                if generator_request.randomize_source:
                    event_source = _generate_random_source()
                if generator_request.randomize_type:
                    event_type = _generate_random_type()
                if generator_request.randomize_subject:
                    event_subject = _generate_random_subject()

            log.debug(
                "POST event #%s/%s with type %s",
                i + 1,
                iterations,
                event_type,
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
                type=event_type,
                source=event_source,
                subject=event_subject,
                data=data,
            )
            log.debug("Event payload: %s", event.model_dump())
            try:
                async with httpx.AsyncClient(
                    timeout=settings.http_client_timeout
                ) as client:
                    response = await client.post(
                        str(generator_request.event_gateway),
                        json=event.model_dump(mode="json"),
                        headers={"Content-Type": "application/cloudevents+json"},
                    )
                    response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                log.error("HTTP error occurred when posting to gateway: %s", exc)
                task.status = "Failed"
                task.progress = -1
                task.error = f"Bad Gateway: Failed to post event to {generator_request.event_gateway} - HTTP {exc.response.status_code}"
                async with active_tasks_lock:
                    active_tasks[task.id] = task  # Update task with error info
                return  # Exit gracefully without raising exception
            except httpx.ConnectError as exc:
                log.error(
                    "Connection error when posting to gateway %s: %s",
                    generator_request.event_gateway,
                    exc,
                )
                task.status = "Failed"
                task.progress = -1
                task.error = f"Service Unavailable: Could not connect to {generator_request.event_gateway}"
                async with active_tasks_lock:
                    active_tasks[task.id] = task  # Update task with error info
                return  # Exit gracefully without raising exception
            except httpx.TimeoutException as exc:
                log.error(
                    "Timeout when posting to gateway %s: %s",
                    generator_request.event_gateway,
                    exc,
                )
                task.status = "Failed"
                task.progress = -1
                task.error = f"Gateway Timeout: Request to {generator_request.event_gateway} timed out"
                async with active_tasks_lock:
                    active_tasks[task.id] = task  # Update task with error info
                return  # Exit gracefully without raising exception
            except httpx.RequestError as exc:
                log.error(
                    "Request error when posting to gateway %s: %s",
                    generator_request.event_gateway,
                    exc,
                )
                task.status = "Failed"
                task.progress = -1
                task.error = f"Bad Gateway: Error sending request to {generator_request.event_gateway} - {type(exc).__name__}"
                async with active_tasks_lock:
                    active_tasks[task.id] = task  # Update task with error info
                return  # Exit gracefully without raising exception

            progress = round((i + 1) / iterations * 100)

            task.progress = progress
            if 0 < progress < 100:
                task.status = "Running"
            else:
                task.status = "Completed"

            # Update current task progress
            async with active_tasks_lock:
                task_exists = task.id in active_tasks
                if task_exists and task.progress >= 0:
                    active_tasks[task.id] = task
                    task_state = "updated"
                elif task.progress == -1:
                    active_tasks.pop(task.id, None)
                    task_state = "failed"
                else:
                    task_state = "missing"

            if task_state == "failed":
                log.error("Task %s failed!", task.id)
                return  # Exit gracefully
            if task_state == "missing":
                log.error("Task %s does not exist!", task.id)
                return  # Exit gracefully

            # wait for the requested delay
            await asyncio.sleep(delay_ms / 1000)

        # Remove task from active tasks when completed
        log.info("Task %s is completed", task.id)
        async with active_tasks_lock:
            active_tasks.pop(task.id, None)

    except ValidationError as e:
        log.error("Validation error in task %s: %s", task.id, e)
        task.status = "Failed"
        task.progress = -1
        task.error = f"Validation error: {str(e)}"
        async with active_tasks_lock:
            active_tasks[task.id] = task
    except Exception as e:
        log.error("Unexpected error in task %s: %s", task.id, e, exc_info=True)
        task.status = "Failed"
        task.progress = -1
        task.error = f"Internal server error: {str(e)}"
        async with active_tasks_lock:
            active_tasks[task.id] = task
