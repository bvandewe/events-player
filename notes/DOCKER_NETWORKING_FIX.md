# Docker Networking Issues - Troubleshooting Guide

## Error: Network is unreachable / Connection refused

### Symptoms

```
OSError: [Errno 101] Network is unreachable
ConnectionRefusedError: [Errno 111] Connect call failed ('192.168.65.254', 80)
```

When trying to POST to `/api/generate` with target URL like `http://host.docker.internal/events/pub`

## Root Causes

1. **Missing port in URL** - Using `http://host.docker.internal/events/pub` instead of `http://host.docker.internal:8884/events/pub`
2. **Network mode issues** - Container can't reach host services
3. **Docker Desktop networking** - `host.docker.internal` not resolving properly

## Solutions

### Solution 1: Use Correct URL with Port (Quick Fix)

When using the CloudEvent Player UI, make sure the target URL includes the port:

❌ **Wrong:**

```
http://host.docker.internal/events/pub
```

✅ **Correct:**

```
http://host.docker.internal:8884/events/pub
```

Or use one of the pre-configured gateways from the dropdown.

### Solution 2: Fix docker-compose.yml

Update the default gateway URLs in `docker-compose.debug.yml`:

```yaml
environment:
  api_default_generator_gateways: '{"urls": ["http://host.docker.internal:8884/events/pub", "http://event-player:8080/events/pub"]}'
```

### Solution 3: Add host.docker.internal mapping (Linux)

If running on Linux, add extra_hosts:

```yaml
services:
  event-player:
    # ... other config ...
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### Solution 4: Use host network mode (Linux only)

For testing on Linux:

```yaml
services:
  event-player:
    # ... other config ...
    network_mode: "host"
    ports: [] # Not needed with host network
```

Then access at `http://localhost:8080`

### Solution 5: Run Multiple Instances with Docker Compose

Create a complete `docker-compose.yml` with two instances:

```yaml
version: '3.8'

services:
  player-1:
    image: ghcr.io/bvandewe/events-player:latest
    container_name: events-player-1
    ports:
      - "8080:8080"
    environment:
      - API_LOG_LEVEL=INFO
      - API_TITLE=Player 1
      - API_DEFAULT_GENERATOR_GATEWAYS={"urls": ["http://player-2:8080/events/pub"]}
    networks:
      - events-network

  player-2:
    image: ghcr.io/bvandewe/events-player:latest
    container_name: events-player-2
    ports:
      - "8081:8080"
    environment:
      - API_LOG_LEVEL=INFO
      - API_TITLE=Player 2
      - API_DEFAULT_GENERATOR_GATEWAYS={"urls": ["http://player-1:8080/events/pub"]}
    networks:
      - events-network

networks:
  events-network:
    driver: bridge
```

Usage:

```bash
docker-compose up -d
# Player 1: http://localhost:8080
# Player 2: http://localhost:8081
# They can communicate via service names
```

## Testing Connectivity

### From inside the container

```bash
# Access container shell
docker exec -it events-player sh

# Test network connectivity
ping host.docker.internal
curl http://host.docker.internal:8884/health

# Test DNS resolution
nslookup host.docker.internal
```

### From host

```bash
# Check if service is accessible
curl http://localhost:8884/health

# Check container networking
docker inspect events-player | grep -A 20 NetworkSettings
```

## Common Use Cases

### Case 1: Self-send (Same Instance)

Use the container's own service name or localhost:

```json
{
  "target_url": "http://localhost:8080/events/pub",
  "iterations": 5
}
```

### Case 2: Send to Host Service

From container to service on host machine:

```json
{
  "target_url": "http://host.docker.internal:8080/events/pub",
  "iterations": 5
}
```

### Case 3: Send Between Containers

From one container to another in same network:

```json
{
  "target_url": "http://other-container-name:8080/events/pub",
  "iterations": 5
}
```

### Case 4: Send to External Service

To any external HTTP endpoint:

```json
{
  "target_url": "https://webhook.site/your-unique-id",
  "iterations": 5
}
```

## Platform-Specific Notes

### macOS / Windows (Docker Desktop)

✅ `host.docker.internal` works by default

- Resolves to host machine's IP
- Use with port: `http://host.docker.internal:8080`

### Linux (Docker Engine)

⚠️ `host.docker.internal` requires extra configuration:

**Option A:** Add to docker run:

```bash
docker run --add-host=host.docker.internal:host-gateway ...
```

**Option B:** Add to docker-compose.yml:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

**Option C:** Use host network mode:

```bash
docker run --network host ...
```

## Quick Fix Command

If you're currently running and need immediate fix:

```bash
# Stop current container
docker stop events-player
docker rm events-player

# Run with corrected environment
docker run -d \
  --name events-player \
  --add-host=host.docker.internal:host-gateway \
  -p 8080:8080 \
  -e API_LOG_LEVEL=INFO \
  -e 'API_DEFAULT_GENERATOR_GATEWAYS={"urls": ["http://host.docker.internal:8080/events/pub"]}' \
  ghcr.io/bvandewe/events-player:latest
```

## Verification

After applying fixes, test the connection:

```bash
# From host machine
curl -X POST http://localhost:8884/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "http://host.docker.internal:8080/events/pub",
    "iterations": 1,
    "event_type": "test.event"
  }'
```

Should return:

```json
{
  "task_id": "some-uuid",
  "status": "started"
}
```

No more `Network is unreachable` or `Connection refused` errors!

## References

- [Docker networking docs](https://docs.docker.com/network/)
- [Docker Compose networking](https://docs.docker.com/compose/networking/)
- [host.docker.internal explanation](https://docs.docker.com/desktop/networking/#i-want-to-connect-from-a-container-to-a-service-on-the-host)
