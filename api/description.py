# This is injected into FastAPI as the OpenAPI description,
# which is in turn rendered on the Swagger UI.

description = """
## Overview

This micro-app serves as a test subscriber of CloudEvents.

It offers a web-based interface that allows users to:

1. quickly visualize the events received on its `POST /events/pub` endpoint;
2. generate a sequence of custom CloudEvents that are sent to a user-defined Gateway;

Note that it does NOT persist data anywhere, so refreshing the page on the browser will reset the state.

### Frontend

The root URL shows a simple HTML page that automatically refreshes as new CloudEvents are received by the backend.

The UI stacks events as they are received, showing the most recent one on top.

There is a filter input box that allows users to search for any string in any event.
Upon submitting a filter string, the UI will search for a match in any field of an event and will show or hide events accordingly.

By clicking on any event header, users can toggle the display of its details.
There is also a ToggleAll button next to the filter to expand or collapse all events.

Finally, an overlay panel enables users to define a sequence of CloudEvents that the backend will send.
Upon submission, the backend will validate the `CloudEvent Generation` request. If the request is valid,
it will generate the sequence of events and will send them to a user-defined Gateway. If the request is invalid
(for example the Gateway URI is wrong), the backend will return a message to the user providing details about the error.

Assuming that the app is also subscribed to the Gateway, it might show events that were generated,
ingested by the Gateway and finally forwarded to the app as a subscriber of the Gateway!

### CloudEvents

This app provides an endpoint at `/events/pub` that accepts HTTP POST requests with CloudEvents payloads.
To be valid, the payload must have the `Content-Type` header set to `application/cloudevents+json`
and be formatted as per the CloudEvents Specifications v1.0.2 in JSON Format (That validation is currently missing!).

When an event is received, it is consumed by a background task that adds a copy to the queue of each active clients
(i.e. browsers that are currently connected to the `/stream` route).

### Streaming

The SSE stream (at `/stream`) is an always-on HTTP2 connection that is loaded by Javascript on the index.html page.
Whenever the `/events/pub` route received an event, it copies it to the queue of each active client.

In turn, the `/stream` route runs an infinite loop that dequeues events from each of the client's queue and sends it as a JSON payload,
including a timestamp indicating when the event was sent to the client. The UI renders these events as explained above...

"""
