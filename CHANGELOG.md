# CHANGE LOG

## CURRENT_CHANGES

- 

## 0.1.11

- Added `publish.sh` script thanks to ChatGPT!
- Fixed HTTP error handling when sending event to the gateway

## 0.1.10

- Fixed search form with preventDefault on submit event
- Fixed wrong page title when event was received
- Fixed validator to support optional charset in Header

## 0.1.9

- Completed conversion to Bootstrap 5.3.1 in Dark-mode
- Added raw data as string to badly formatted event data
- Added a badge to badly formatted events
- Added deployment files for CCIE360 events

## 0.1.8

- Renamed project to event-player
- Fixed handling of badly formatted event data

## 0.1.7

- Added UI build in Dockerfile
- Added handling of badly formatted event data

## 0.1.6

Prep for conversion to Bootstrap 5.3.x

- Converted JS to Modular JS
- Converted CSS to SASS
- Added Parcel bundler
- Changed Jinja2 templates folder to /static
- Added API endpoints for Tasks (delete task by id is failing)
- Added (multi)progress-bar for long-running tasks
- Fixed Generator's Delay

## 0.1.5

- Added setting for the max size of the events queue in the browser
- Added strategic logging

## 0.1.4

- Fixed subject placeholder
- Excluded favicon from swagger
- Fixed indicator title from blue to green
- Fixed anchors in modal

## 0.1.3

- Fixed event filter
- Added support for default Gateways
- Added toggle generator from menu
- Added Help icon with Usage and Keyboard shortcuts
- Added Icon to show SSE connection status
- Fixed generator layout
- Added confirmation dialog when clearing event stack (page refresh and click on Viewer)
- Fixed favicon.ico

## 0.1.2

- Added event generator

## 0.1.1

- Fixed streaming to concurrent clients

## 0.1.0

- Initial Event Viewer
- Support for only one client at a time