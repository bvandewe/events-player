import asyncio

import pytest

from api.background_tasks import _send_to_client, handle_event
from api.globals import sse_clients, sse_clients_lock


@pytest.fixture(autouse=True)
async def clear_sse_state():
    async with sse_clients_lock:
        sse_clients.clear()
    yield
    async with sse_clients_lock:
        sse_clients.clear()


@pytest.mark.asyncio
async def test_handle_event_survives_concurrent_client_cleanup():
    payload = {"event": "test"}
    primary_queue: asyncio.Queue = asyncio.Queue()
    secondary_queue: asyncio.Queue = asyncio.Queue()

    async with sse_clients_lock:
        sse_clients["client-primary"] = primary_queue
        sse_clients["client-secondary"] = secondary_queue

    async def remove_primary_client():
        await asyncio.sleep(0)
        async with sse_clients_lock:
            sse_clients.pop("client-primary", None)

    remover_task = asyncio.create_task(remove_primary_client())

    await handle_event(payload)
    await remover_task

    assert secondary_queue.qsize() == 1
    queued_payload = secondary_queue.get_nowait()
    assert queued_payload == payload


@pytest.mark.asyncio
async def test_slow_client_is_evicted_when_queue_full():
    slow_queue: asyncio.Queue = asyncio.Queue(maxsize=1)
    await slow_queue.put({"existing": True})

    async with sse_clients_lock:
        sse_clients["slow-client"] = slow_queue

    await _send_to_client("slow-client", slow_queue, {"event": "data"})

    async with sse_clients_lock:
        assert "slow-client" not in sse_clients
