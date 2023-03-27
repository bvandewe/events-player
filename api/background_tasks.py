import datetime
import httpx
import json
import uuid

from fastapi import HTTPException
from pydantic import ValidationError

from .globals import sse_clients
from .models import EventGeneratorRequest


async def handle_event(payload: dict):
    try:
        print(f"Handling event to {len(sse_clients)} clients: {payload}")
        for client_queue in sse_clients.values():
            await client_queue.put(payload)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


async def handle_generator_request(generator_request: EventGeneratorRequest):
    try:
        print(f"Handling generator request for {generator_request.iterations} iterations to {generator_request.event_gateway}")
        for i in range(int(generator_request.iterations)):
            print(f"POST event with type {generator_request.event_type}")
            try:
                data = json.loads(generator_request.event_data)
            except json.JSONDecodeError as e:
                data = {"error": f"Error parsing JSON:{e}"}

            event = {
                "specversion": "1.0",
                "id": str(uuid.uuid4()),
                "time": datetime.datetime.now().isoformat(),
                "datacontenttype": "application/json",
                "type": generator_request.event_type,
                "source": generator_request.event_source,
                "data": data
            }
            # print(event)
            async with httpx.AsyncClient() as client:
                response = await client.post(generator_request.event_gateway,
                                             json=event,
                                             headers={"Content-Type": "application/cloudevents+json"}
                                             )
                response.raise_for_status()

    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
