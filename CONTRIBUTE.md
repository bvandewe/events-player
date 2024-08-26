# Contribute

## TODO

### Cheat Sheet

```sh
# Update CHANGELOG.md !!

# Upgrade Version
TAG="0.1.15"

# Build locally
docker build -t event-player:latest .
docker tag event-player:latest event-player:$TAG
docker tag event-player:latest  ghcr.io/bvandewe/events-player:$TAG
docker tag event-player:latest  ghcr.io/bvandewe/events-player:latest

# Run two instances locally:

# http://localhost:8080
docker run -d --rm -it -p 8080:80 -e api_default_generator_gateways='{"urls": ["http://localhost/events/pub", "http://host.docker.internal:8081/events/pub"]}' ghcr.io/bvandewe/events-player:latest

# http://localhost:8081
docker run -d --rm -it -p 8081:80 -e api_default_generator_gateways='{"urls": ["http://localhost/events/pub", "http://host.docker.internal:8081/events/pub"]}' ghcr.io/bvandewe/events-player:latest

# Push to Github Registry
docker login ghcr.io
docker tag event-player:latest  ghcr.io/bvandewe/events-player:latest
docker push ghcr.io/bvandewe/events-player:latest

```
