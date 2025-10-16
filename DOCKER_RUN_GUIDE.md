# Running CloudEvent Player Container

## Quick Start

### Pull the latest image

```bash
docker pull ghcr.io/bvandewe/events-player:latest
```

### Run the container

```bash
docker run -d \
  --name events-player \
  -p 8080:8080 \
  -e API_LOG_LEVEL=INFO \
  ghcr.io/bvandewe/events-player:latest
```

Access the UI at: <http://localhost:8080>

## Common Issues

### Port Already in Use

**Error:**

```text
Bind for 0.0.0.0:8080 failed: port is already allocated
```

**Solutions:**

1. **Stop conflicting container:**

   ```bash
   docker ps | grep 8080
   docker stop <container-id>
   ```

2. **Use a different port:**

   ```bash
   docker run -d \
     --name events-player \
     -p 8081:8080 \
     ghcr.io/bvandewe/events-player:latest
   ```

   Access at: <http://localhost:8081>

3. **Stop MkDocs if running:**

   ```bash
   # Find and kill mkdocs process
   lsof -ti:8080 | xargs kill -9
   ```

### Platform Mismatch (Fixed in Latest)

**Previous Warning:**

```text
WARNING: The requested image's platform (linux/arm64/v8) does not match...
```

**Solution:**
The Docker image now supports both AMD64 (Intel/x86) and ARM64 (Apple Silicon).
Pull the latest image to get multi-platform support:

```bash
docker pull ghcr.io/bvandewe/events-player:latest
```

## Container Management

### View logs

```bash
docker logs events-player
docker logs -f events-player  # Follow mode
```

### Stop container

```bash
docker stop events-player
docker rm events-player
```

### Restart container

```bash
docker restart events-player
```

### Access container shell

```bash
docker exec -it events-player sh
```

## Environment Variables

### Basic Configuration

```bash
docker run -d \
  --name events-player \
  -p 8080:8080 \
  -e API_LOG_LEVEL=DEBUG \
  -e API_TITLE="My Event Player" \
  -e API_VERSION="1.0.0" \
  ghcr.io/bvandewe/events-player:latest
```

### All Available Variables

See `docs/configuration.md` or the main README for complete list of environment variables.

Common variables:

- `API_LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)
- `API_TITLE`: Application title
- `API_VERSION`: Application version
- `API_DESCRIPTION`: Application description
- `API_TAG`: Container image tag

## Docker Compose

### Basic setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  events-player:
    image: ghcr.io/bvandewe/events-player:latest
    container_name: events-player
    ports:
      - "8080:8080"
    environment:
      - API_LOG_LEVEL=INFO
    restart: unless-stopped
```

### Run with Docker Compose

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

## Multiple Instances

Run multiple instances on different ports:

```bash
# Instance 1
docker run -d \
  --name events-player-1 \
  -p 8080:8080 \
  -e API_TITLE="Player 1" \
  ghcr.io/bvandewe/events-player:latest

# Instance 2
docker run -d \
  --name events-player-2 \
  -p 8081:8080 \
  -e API_TITLE="Player 2" \
  ghcr.io/bvandewe/events-player:latest
```

## Health Check

```bash
# Check if container is healthy
curl http://localhost:8080/health

# Check version
curl http://localhost:8080/version
```

## Available Tags

- `latest` - Latest stable release
- `main` - Latest from main branch
- `v0.2.0` - Specific version (semver tags)
- `sha-<commit>` - Specific commit

```bash
# Pull specific version
docker pull ghcr.io/bvandewe/events-player:v0.2.0

# Pull from main branch
docker pull ghcr.io/bvandewe/events-player:main
```

## Platforms

The image supports:

- `linux/amd64` - Intel/AMD x86_64
- `linux/arm64` - ARM64 (Apple Silicon, AWS Graviton)

Docker automatically pulls the correct architecture.

## Troubleshooting

### Container exits immediately

Check logs:

```bash
docker logs events-player
```

Common causes:

- Port already in use
- Missing environment variables
- Insufficient permissions

### Cannot pull image

Ensure you're authenticated (for private repos):

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

**Note**: The repository is public, so authentication isn't required for pulling.

### Image not found

Verify the image exists:

```bash
docker search ghcr.io/bvandewe/events-player
```

Or check GitHub Packages:
<https://github.com/bvandewe/events-player/pkgs/container/events-player>

## Production Deployment

See `docs/deployment.md` for:

- Kubernetes deployments
- Helm charts
- Cloud platform deployments
- High availability setups
- Load balancing configurations

## Building Locally

If you want to build from source instead:

```bash
# Clone repository
git clone https://github.com/bvandewe/events-player.git
cd events-player

# Build image
docker build -t events-player:local .

# Run locally built image
docker run -d -p 8080:8080 events-player:local
```
