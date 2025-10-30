# TODO

- remove the tag env_var and hardcode it per release

- move and rename the ui/index.html into the ui/html/events.html so that it is consistent with the other two views (timeline and dashboard). Extract common html into a base.html if applicable and ensure that the ui builds correctly.

- add the actual storage usage in kB value in the dashboard's storage utilization panel for both tiers, probably next to the progress bar title (unless you have a better suggestion)

- add a new variable configuration that enables user to customize the HTML page title (for all views) that currently is hardcoded and varies on all three views. This title configuration should be the prefix of the page title.

- add click-to-filter to metrics dashboard ("Top Event Types", "Top Sources", "Activity Distribution by Hour")
- fix global filter state vs query params from click-to-filter state

- [ ] Make app and page title configurable from ENV VARs
- [ ] Add support for different types of SSE messages (live_event, replayed_event, generated_event, gateway_origin) and add badge on event_box
- [ ] Add support for templated fields to input random (like in Postman)
- [ ] Add keyb nav between events (auto-expand/collapse)
- [x] Add Authorization
- [x] Add feedback about the background task(s) progress and status
- [x] Add version/tag in UI
- [x] Use FastAPI built-in SSEEvent
- [x] Add support for precompiled CSS with libsass (without NPM!)
- [x] Add support for delay in generator
- [x] Add full validation cloudevent
