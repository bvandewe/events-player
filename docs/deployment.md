# Deployment Guide

Deploy CloudEvent Player to various environments.

## Docker Deployment

The simplest deployment method using Docker Compose.

### Production Deployment

```bash
# Clone the repository
git clone https://github.com/bvandewe/events-player
cd events-player

# Start in production mode
docker-compose up -d

# Verify deployment
curl http://localhost:8884/health
```

### Custom Configuration

Create a `.env` file for environment-specific settings:

```ini
API_VERSION=0.1.17
API_TAG=v0.1.17
LOG_LEVEL=INFO

# Customize defaults
DEFAULT_EVENT_SOURCE=production-player
DEFAULT_EVENT_TYPE=com.mycompany.event.v1
DEFAULT_EVENT_GATEWAY=http://event-gateway:8080/events
```

### Docker Compose Configuration

```yaml
version: "3.8"

services:
  event-player:
    image: event-player:latest
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8884:8080"
    environment:
      - LOG_LEVEL=INFO
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Behind a Reverse Proxy

#### Nginx

```nginx
server {
    listen 80;
    server_name cloudevent-player.example.com;

    location / {
        proxy_pass http://localhost:8884;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

#### Traefik

```yaml
services:
  event-player:
    image: event-player:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.event-player.rule=Host(`cloudevent-player.example.com`)"
      - "traefik.http.services.event-player.loadbalancer.server.port=8080"
```

## Kubernetes Deployment

Deploy to Kubernetes using Helm charts.

### Prerequisites

- Kubernetes cluster (1.19+)
- Helm 3.x
- kubectl configured

### Using Helm Charts

The repository includes Helm charts for different environments.

#### Development Environment

```bash
# Create namespace
kubectl create namespace cloudevent-player-dev

# Install chart
helm install cloudevent-player deployments/helm/ \
  -f deployments/helm/values-dev.yaml \
  -n cloudevent-player-dev

# Verify deployment
kubectl get pods -n cloudevent-player-dev
kubectl get svc -n cloudevent-player-dev
```

#### Staging Environment

```bash
helm install cloudevent-player deployments/helm/ \
  -f deployments/helm/values-stg.yaml \
  -n cloudevent-player-stg
```

#### Production Environment

```bash
helm install cloudevent-player deployments/helm/ \
  -f deployments/helm/values-prd.yaml \
  -n cloudevent-player-prd
```

### Helm Values Configuration

Example `values-prd.yaml`:

```yaml
replicaCount: 2

image:
  repository: your-registry.io/cloudevent-player
  tag: "v0.1.17"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: cloudevent-player.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: cloudevent-player-tls
      hosts:
        - cloudevent-player.example.com

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

healthCheck:
  livenessProbe:
    httpGet:
      path: /health
      port: 8080
    initialDelaySeconds: 30
    periodSeconds: 10
  readinessProbe:
    httpGet:
      path: /health
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 5

env:
  - name: LOG_LEVEL
    value: "INFO"
  - name: API_VERSION
    value: "0.1.17"
```

### Port Forwarding for Testing

```bash
# Port forward to test locally
kubectl port-forward svc/cloudevent-player 8884:80 -n cloudevent-player-dev

# Access at http://localhost:8884
```

### Updating Deployment

```bash
# Update Helm release
helm upgrade cloudevent-player deployments/helm/ \
  -f deployments/helm/values-prd.yaml \
  -n cloudevent-player-prd

# Rollback if needed
helm rollback cloudevent-player -n cloudevent-player-prd
```

### Monitoring

```bash
# Watch pods
kubectl get pods -n cloudevent-player-prd -w

# View logs
kubectl logs -f deployment/cloudevent-player -n cloudevent-player-prd

# Check events
kubectl get events -n cloudevent-player-prd --sort-by='.lastTimestamp'
```

## Cloud Platform Deployment

### AWS ECS

Using AWS Fargate:

```bash
# Build and push image
docker build -t cloudevent-player:latest .
docker tag cloudevent-player:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/cloudevent-player:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/cloudevent-player:latest

# Create task definition and service
aws ecs create-task-definition --cli-input-json file://ecs-task-def.json
aws ecs create-service --cluster my-cluster --service-name cloudevent-player \
  --task-definition cloudevent-player --desired-count 2
```

### Google Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT-ID/cloudevent-player
gcloud run deploy cloudevent-player \
  --image gcr.io/PROJECT-ID/cloudevent-player \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

### Azure Container Instances

```bash
# Create resource group
az group create --name cloudevent-player-rg --location eastus

# Deploy container
az container create \
  --resource-group cloudevent-player-rg \
  --name cloudevent-player \
  --image cloudevent-player:latest \
  --dns-name-label cloudevent-player \
  --ports 8080
```

## Development Mode

For development with hot-reload:

```bash
# Use debug compose file
docker-compose -f docker-compose.debug.yml up -d

# Or run locally with Poetry
poetry install
poetry run uvicorn api.app:app --host 0.0.0.0 --port 8884 --reload
```

### Debug Configuration

The debug compose file includes:

- Hot-reload on code changes
- Increased log verbosity
- Shorter graceful shutdown timeout
- Volume mounts for live editing

## Production Best Practices

### Security

1. **Use HTTPS**: Always use TLS in production
2. **Authentication**: Add authentication if exposing publicly
3. **Network Policies**: Restrict access with firewall rules
4. **Regular Updates**: Keep dependencies up to date

### Performance

1. **Resource Limits**: Set appropriate CPU/memory limits
2. **Horizontal Scaling**: Use autoscaling for load
3. **Connection Pooling**: Configure connection limits
4. **Monitoring**: Set up metrics and alerts

### High Availability

1. **Multiple Replicas**: Run at least 2 instances
2. **Health Checks**: Configure liveness and readiness probes
3. **Load Balancing**: Use a load balancer
4. **Graceful Shutdown**: Enabled by default

### Monitoring & Observability

1. **Logs**: Centralize with ELK, Splunk, or CloudWatch
2. **Metrics**: Export to Prometheus
3. **Tracing**: Use Request ID for distributed tracing
4. **Alerts**: Set up alerts for failures

## Environment Variables

| Variable                | Default                              | Description                                 |
| ----------------------- | ------------------------------------ | ------------------------------------------- |
| `API_VERSION`           | `0.1.0`                              | API version number                          |
| `API_TAG`               | `v0.1.0`                             | Git tag/version                             |
| `LOG_LEVEL`             | `INFO`                               | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `LOG_FORMAT`            | (see settings)                       | Python log format string                    |
| `DEFAULT_EVENT_SOURCE`  | `cloudevent-player`                  | Default event source                        |
| `DEFAULT_EVENT_TYPE`    | `com.cloudevent.player.generated.v1` | Default event type                          |
| `DEFAULT_EVENT_SUBJECT` | `test-event`                         | Default event subject                       |
| `DEFAULT_EVENT_DATA`    | `{"foo": "bar"}`                     | Default event data (JSON)                   |
| `DEFAULT_EVENT_GATEWAY` | `http://localhost:8884/events/pub`   | Default gateway URL                         |
| `DEFAULT_ITERATIONS`    | `1`                                  | Default iteration count                     |
| `DEFAULT_DELAY`         | `1000`                               | Default delay (milliseconds)                |

## Health Checks

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

## Scaling

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cloudevent-player
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cloudevent-player
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Docker Swarm

```bash
# Create service with replicas
docker service create \
  --name cloudevent-player \
  --replicas 3 \
  --publish 8884:8080 \
  event-player:latest

# Scale service
docker service scale cloudevent-player=5
```

## Backup & Recovery

### Configuration Backup

```bash
# Backup environment configuration
cp .env .env.backup

# Backup Kubernetes configmaps
kubectl get configmap cloudevent-player-config -n cloudevent-player-prd -o yaml > config-backup.yaml
```

### Container Images

```bash
# Tag releases
docker tag event-player:latest event-player:v0.1.17

# Push to registry
docker push your-registry.io/event-player:v0.1.17
```

## Troubleshooting Deployment

### Pod Won't Start

```bash
# Check pod status
kubectl describe pod <pod-name> -n cloudevent-player-prd

# Check logs
kubectl logs <pod-name> -n cloudevent-player-prd

# Check events
kubectl get events -n cloudevent-player-prd
```

### Service Unreachable

```bash
# Check service
kubectl get svc cloudevent-player -n cloudevent-player-prd

# Check endpoints
kubectl get endpoints cloudevent-player -n cloudevent-player-prd

# Port forward to test
kubectl port-forward svc/cloudevent-player 8884:80 -n cloudevent-player-prd
```

### High Memory Usage

```bash
# Check resource usage
kubectl top pods -n cloudevent-player-prd

# Adjust limits in values.yaml and upgrade
helm upgrade cloudevent-player deployments/helm/ \
  -f deployments/helm/values-prd.yaml \
  -n cloudevent-player-prd
```

## Next Steps

- [Configuration](configuration.md) - Detailed configuration options
- [Monitoring](advanced/monitoring.md) - Set up monitoring and alerts
- [Troubleshooting](advanced/troubleshooting.md) - Common issues and solutions
- [API Reference](api-reference.md) - Complete API documentation
