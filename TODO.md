# TODO

- add a new variable configuration that enables user to customize the HTML page title (for all views) that currently is hardcoded and varies on all three views. This title configuration should be the prefix of the page title.

- [ ] TBC: Add API client to cloudstream (the event's broker API) to trigger replaying event streams to the player (<https://github.com/neuroglia-io/cloud-streams>)
- [ ] Add keyb nav between events (auto-expand/collapse)
- [ ] Make app and page title configurable from ENV VARs
- [x] Add support for different types of SSE messages (live_event, replayed_event, generated_event, gateway_origin) and add badge on event_box
- [x] Add support for templated fields to input random (like in Postman)
- [x] Add Authorization
- [x] Add feedback about the background task(s) progress and status
- [x] Add version/tag in UI
- [x] Use FastAPI built-in SSEEvent
- [x] Add support for precompiled CSS with libsass (without NPM!)
- [x] Add support for delay in generator
- [x] Add full validation cloudevent
