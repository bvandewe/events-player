# CloudEvent Viewer

This micro-app can be used as a test **subscriber** and/or test **emitter** of [CloudEvents](https://cloudevents.io/).

It is very useful in an event-driven architecture in order to monitor events and test subscriptions.

The app provides a web-based interface that enables users to visualize events as they are received on the `POST /events/pub` endpoint. The UI provides simple web-form that enables users to generate event(s) and emit/transmit them to a selected customizable event gateway.

It can very easily be deployed locally (included in a `docker-compose` file) or remotely (in Kubernetes or Docker) and may be configured as a subscriber to an event channel (like [Cloud Streams](https://github.com/neuroglia-io/cloud-streams)).

![Demo](assets/cloudevent-player_demo_0.1.gif)

## Limitations

There is currently NO PERSISTANCE anywhere so refreshing the page on the browser will reset the state.  
The frontend keeps a given amount of events as a rolling buffer with a configurable max-size (i.e. 1000 last events, older events are discarded).

## Usage

The root URL shows a simple HTML page that automatically appends new CloudEvents as they are received by the backend (on the `POST /events/pub` endpoint) - and pops older events if the maximum stack size is reached.

- The UI stacks the events so that the most recent one is on top.
- User can search for any String anywhere in any events with the filter input box and the UI will show/hide events accordingly.
- User can toggle the display of the event details by clicking the any event header.
- There is a ToggleAll button next to the filter that will toggle the expand/collapse status of all events.

## Deployment

The app backend validates and handles CloudEvents via the `POST /events/pub` endpoint and streams events to all currently connected clients/browsers via [SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

- The payload must have the `Content-Type` header set to `application/cloudevents+json`.
- The event must be formatted as per the CloudEvents [Specifications v1.0.2](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md) in [JSON Format](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/formats/json-format.md).  

When a valid event is received, a FastAPI background task simply pushes a copy of the event into the queue of each currently connected client/browser.  

The SSE stream can be accessed at `/stream` using a browser or any SSE client. The stream sends a JSON payload for each received event, with the event payload and a timestamp indicating when the event was received.

## Local Usage

1. Pull and run the Docker image:

    ```sh
    docker run --name cloudevent-viewer -p 8888:80 $REGISTRY/cloudevent-viewer:latest
    ```

2. Browse to http://localhost:8888

3. Emit Cloudevent to http://localhost:8888/events/pub

4. Enjoy!

## Development

`Hint`:

The debugger fails with vscode v1.75 (currently the latest version).
Have to downgrade to 1.74: https://code.visualstudio.com/updates/v1_74 Then, disable automatic updates (settings > 'update': set to "none")

### Cheat Sheet

```sh
# Update CHANGELOG.md !!

# Upgrade Version
TAG="0.1.10"

# Build locally
docker build -t cloudevent-player:latest .
docker tag cloudevent-player:latest cloudevent-player:$TAG

# Run locally
docker run --name cloudevent-player -p 8888:80 cloudevent-player:$TAG

# Publish to Registry
docker login $REGISTRY
docker tag cloudevent-player:latest $REGISTRY/cloudevent-player:$TAG
docker tag cloudevent-player:latest $REGISTRY/cloudevent-player:latest
docker push $REGISTRY/cloudevent-player:$TAG
docker push $REGISTRY/cloudevent-player:latest

```
