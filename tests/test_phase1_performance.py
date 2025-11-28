"""
Performance tests for Phase 1 optimizations.

Tests async fan-out broadcast and queue monitoring capabilities.
"""

import asyncio
import time
from datetime import datetime

import httpx
import pytest

BASE_URL = "http://localhost:8884"


@pytest.mark.asyncio
async def test_health_endpoint():
    """Verify health endpoint includes SSE client count"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "active_clients" in data
        assert "active_tasks" in data
        assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_sse_stats_endpoint():
    """Verify new SSE stats endpoint works"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/api/sse/stats")
        assert response.status_code == 200
        data = response.json()

        # Check structure
        assert "total_clients" in data
        assert "total_queued_events" in data
        assert "max_queue_size" in data
        assert "slow_client_threshold" in data
        assert "avg_utilization_pct" in data
        assert "clients" in data

        # Verify configuration values
        assert data["max_queue_size"] == 100  # Phase 1 reduced from 5000
        assert data["slow_client_threshold"] == 50


@pytest.mark.asyncio
async def test_parallel_event_broadcast():
    """
    Test that events are broadcast quickly without blocking.

    Before Phase 1: Sequential broadcast would take ~N*10ms where N is client count
    After Phase 1: Parallel broadcast should take ~10ms regardless of client count
    """
    async with httpx.AsyncClient() as client:
        # Send 10 events quickly
        events = []
        start_time = time.time()

        for i in range(10):
            event = {
                "specversion": "1.0",
                "type": "test.performance.parallel",
                "source": "performance-test",
                "id": f"test-{i}",
                "time": datetime.utcnow().isoformat() + "Z",
                "subject": f"test-{i}",
                "data": {"index": i, "message": "Performance test"},
            }

            task = client.post(
                f"{BASE_URL}/events/pub",
                json=event,
                headers={"Content-Type": "application/cloudevents+json"},
            )
            events.append(task)

        # Wait for all events to complete
        responses = await asyncio.gather(*events)
        elapsed = time.time() - start_time

        # All should succeed
        assert all(r.status_code == 202 for r in responses)

        # Should complete quickly (< 500ms for 10 events)
        # Before Phase 1 this could take 1-2 seconds with multiple clients
        assert elapsed < 0.5, f"Broadcast too slow: {elapsed:.2f}s"

        print(f"✓ Sent 10 events in {elapsed:.3f}s ({10/elapsed:.1f} events/sec)")


@pytest.mark.asyncio
async def test_queue_size_monitoring():
    """Verify queue sizes are properly reported in stats"""
    async with httpx.AsyncClient() as client:
        # Get initial stats
        response = await client.get(f"{BASE_URL}/api/sse/stats")
        assert response.status_code == 200
        initial_stats = response.json()

        # Send some events
        for i in range(5):
            event = {
                "specversion": "1.0",
                "type": "test.queue.monitoring",
                "source": "performance-test",
                "id": f"queue-test-{i}",
                "time": datetime.utcnow().isoformat() + "Z",
                "subject": "queue-test",
                "data": {"index": i},
            }

            response = await client.post(
                f"{BASE_URL}/events/pub",
                json=event,
                headers={"Content-Type": "application/cloudevents+json"},
            )
            assert response.status_code == 202

        # Give a moment for events to be processed
        await asyncio.sleep(0.1)

        # Check stats again
        response = await client.get(f"{BASE_URL}/api/sse/stats")
        final_stats = response.json()

        # Verify clients list has correct structure
        if final_stats["clients"]:
            client_stat = final_stats["clients"][0]
            assert "client_id" in client_stat
            assert "queue_size" in client_stat
            assert "queue_full" in client_stat
            assert "utilization_pct" in client_stat
            assert "is_slow" in client_stat
            assert client_stat["utilization_pct"] <= 100


@pytest.mark.asyncio
async def test_slow_client_detection():
    """Verify slow client detection works (threshold at 50% = 50 events)"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/api/sse/stats")
        data = response.json()

        # With 100 max queue size and 50 threshold:
        # - is_slow should be False when queue_size < 50
        # - is_slow should be True when queue_size >= 50

        for client_stat in data["clients"]:
            if client_stat["queue_size"] >= 50:
                assert client_stat["is_slow"] is True
            else:
                assert client_stat["is_slow"] is False


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
