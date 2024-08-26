# Contribute

## TODO

### Cheat Sheet

```sh
# Update CHANGELOG.md !!

# Upgrade Version
TAG="0.1.15"

# Build locally
docker build -t cloudevent-player:latest .
docker tag cloudevent-player:latest cloudevent-player:$TAG

# Run locally
docker run --name cloudevent-player -p 8888:80 cloudevent-player:$TAG

# Publish to Gitlab Registry
docker login $REGISTRY
docker tag cloudevent-player:latest $REGISTRY/cloudevent-player:$TAG
docker tag cloudevent-player:latest $REGISTRY/cloudevent-player:latest
docker push $REGISTRY/cloudevent-player:$TAG
docker push $REGISTRY/cloudevent-player:latest

```
