# Installation

CloudEvent Player can be installed and run in several ways. Choose the method that best fits your needs.

## Prerequisites

### For Docker Installation

- Docker 20.10 or later
- Docker Compose 1.29 or later (optional)

### For Local Installation

- Python 3.10 or later
- Poetry 1.5 or later
- Node.js 16 or later (for building UI assets)

## Docker Installation (Recommended)

Choose between pulling a pre-built image or building from source:

=== "Pull Pre-built Image"

    The fastest way to get started - pull the pre-built image from GitHub Container Registry.

    ### Using Docker Run

    ```bash
    # Pull and run the latest image
    docker pull ghcr.io/bvandewe/events-player:latest

    docker run -d \
      --name event-player \
      -p 8884:8080 \
      -e API_LOG_LEVEL=INFO \
      ghcr.io/bvandewe/events-player:latest
    ```

    ### Using Docker Compose

    Create a `docker-compose.yml` file:

    ```yaml
    services:
      event-player:
        image: ghcr.io/bvandewe/events-player:latest
        container_name: event-player
        ports:
          - "8884:8080"
        environment:
          - API_LOG_LEVEL=INFO
          - API_TAG=v0.1.17
        restart: unless-stopped
        healthcheck:
          test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
          interval: 30s
          timeout: 10s
          retries: 3
    ```

    Start the service:

    ```bash
    docker-compose up -d
    ```

    ### Verify Installation

    ```bash
    # Check health
    curl http://localhost:8884/health

    # Access the UI
    open http://localhost:8884
    ```

=== "Build from Source"

    Build CloudEvent Player from source code.

    ### 1. Clone the Repository

    ```bash
    git clone https://github.com/bvandewe/events-player
    cd events-player
    ```

    ### 2. Start with Docker Compose

    ```bash
    # Production mode
    docker-compose up -d

    # Development mode with hot-reload
    docker-compose -f docker-compose.debug.yml up -d
    ```

    ### 3. Verify Installation

    ```bash
    # Check health
    curl http://localhost:8884/health

    # Access the UI
    open http://localhost:8884
    ```

### Configuration

Create a `.env` file to customize settings:

```bash
# Copy the sample environment file
cp .env.sample .env

# Edit settings
vim .env
```

Example `.env` file:

```ini
API_VERSION=0.1.17
API_TAG=v0.1.17
LOG_FORMAT=%(asctime)s - %(name)s - %(levelname)s - %(message)s
LOG_LEVEL=INFO

# Default CloudEvent settings
DEFAULT_EVENT_SOURCE=cloudevent-player
DEFAULT_EVENT_TYPE=com.cloudevent.player.generated.v1
DEFAULT_EVENT_SUBJECT=test-event
DEFAULT_EVENT_DATA={"foo": "bar"}
DEFAULT_EVENT_GATEWAY=http://localhost:8884/events/pub
DEFAULT_ITERATIONS=1
DEFAULT_DELAY=1000
```

## Local Installation (Development)

For development or when you want to run without Docker.

### 1. Install Dependencies

```bash
# Install Python dependencies with Poetry
poetry install

# Install Node.js dependencies
npm install
```

### 2. Build UI Assets

```bash
# Build CSS and JavaScript
npm run build
```

### 3. Create Static Directory

The application expects a `static` directory:

```bash
mkdir -p static
# The build process should populate this automatically
```

### 4. Run the Application

```bash
# Using Poetry
poetry run uvicorn api.app:app --host 0.0.0.0 --port 8884 --reload

# Or activate the virtual environment
poetry shell
uvicorn api.app:app --host 0.0.0.0 --port 8884 --reload
```

### 5. Access the Application

Open your browser to [http://localhost:8884](http://localhost:8884)

## Kubernetes Installation

For production deployments, use the provided Helm chart.

### 1. Configure Values

Edit the appropriate values file:

```bash
# Development
vim deployments/helm/values-dev.yaml

# Staging
vim deployments/helm/values-stg.yaml

# Production
vim deployments/helm/values-prd.yaml
```

### 2. Install with Helm

```bash
# Add namespace
kubectl create namespace cloudevent-player

# Install chart
helm install cloudevent-player deployments/helm/ \
  -f deployments/helm/values-dev.yaml \
  -n cloudevent-player

# Or use make
make deploy-dev
```

### 3. Verify Deployment

```bash
# Check pods
kubectl get pods -n cloudevent-player

# Check service
kubectl get svc -n cloudevent-player

# Port forward for testing
kubectl port-forward svc/cloudevent-player 8884:80 -n cloudevent-player
```

## Verification

After installation, verify the application is running:

### Health Check

```bash
curl http://localhost:8884/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-16T00:00:00.000000",
  "active_tasks": 0,
  "active_clients": 1,
  "version": "0.1.17"
}
```

### API Documentation

Access the interactive API documentation:

- Swagger UI: [http://localhost:8884/api/docs](http://localhost:8884/api/docs)
- ReDoc: [http://localhost:8884/api/redoc](http://localhost:8884/api/redoc)

### Web Interface

Open [http://localhost:8884](http://localhost:8884) to access the web UI.

## Port Configuration

Default ports:

- **Web UI & API**: 8884 (external)
- **Container**: 8080 (internal)

To change the port, update `docker-compose.yml`:

```yaml
ports:
  - "8884:8080" # Change 8884 to your desired port
```

Or for local development, pass the port to uvicorn:

```bash
uvicorn api.app:app --host 0.0.0.0 --port 9000
```

## Updating

### Docker

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

### Local

```bash
# Pull latest changes
git pull

# Update dependencies
poetry install
npm install

# Rebuild UI
npm run build

# Restart application
# (Ctrl+C the running process and start again)
```

### Kubernetes

```bash
# Pull latest changes
git pull

# Upgrade helm chart
helm upgrade cloudevent-player deployments/helm/ \
  -f deployments/helm/values-dev.yaml \
  -n cloudevent-player
```

## Uninstalling

### Docker

```bash
docker-compose down -v  # -v removes volumes
```

### Kubernetes

```bash
helm uninstall cloudevent-player -n cloudevent-player
kubectl delete namespace cloudevent-player
```

## Troubleshooting

### Port Already in Use

If port 8884 is already in use:

```bash
# Check what's using the port
lsof -i :8884

# Kill the process or change the port in docker-compose.yml
```

### Permission Denied

On Linux, if you get permission errors:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Re-login for changes to take effect
```

### Static Files Not Found

If the UI doesn't load:

```bash
# Rebuild UI assets
npm run build

# Check static directory exists
ls -la static/
```

### Health Check Fails

If the health endpoint returns an error:

```bash
# Check container logs
docker-compose logs event-player

# Check application status
docker-compose ps
```

## Next Steps

- [Quick Start Guide](quick-start.md) - Get started in 5 minutes
- [Configuration](configuration.md) - Customize your installation
- [Usage Guide](usage.md) - Learn how to use CloudEvent Player

## System Requirements

### Minimum Requirements

- CPU: 1 core
- RAM: 512 MB
- Disk: 100 MB

### Recommended Requirements

- CPU: 2 cores
- RAM: 1 GB
- Disk: 500 MB

### Network

- Port 8884 (or custom port) must be accessible
- Outbound connectivity for publishing events to external systems
