# CHANGE LOG

## 0.2.0 - 2025-10-16

### Documentation

- Complete MkDocs documentation site with Material theme
- Added comprehensive documentation pages:
  - Quick Start guide with tabbed installation options (Pull vs Build)
  - Installation guide with Docker, local, and Kubernetes deployment
  - Usage guide with code examples (curl, Python, JavaScript)
  - Configuration reference with all environment variables
  - Deployment guide for Docker, Kubernetes, and cloud platforms
- Added demo GIF to homepage
- Added Mermaid diagrams for architecture and demo setup
- Custom styling with Montserrat font and teal/black color scheme
- Horizontal tabs for Pull vs Build installation methods

### Features

- Request ID tracing middleware with contextvars for distributed tracing
- CloudEvent Pydantic model with validation
- Comprehensive test suite (42 tests, 34 passing)
- SSE JSON serialization fixes for Python boolean/null types
- Health check endpoint improvements

### Container & Deployment

- GitHub Container Registry support (`ghcr.io/bvandewe/events-player`)
- Updated all documentation to use correct container image name
- Repository standardized to `https://github.com/bvandewe/events-player`

### Configuration

- Documented all environment variables with examples
- Added configuration examples for dev/staging/production
- Kubernetes ConfigMap examples

### Breaking Changes

- Container image name changed from `cloudevent-player` to `events-player`
- Repository URL standardized across all documentation

## CURRENT_CHANGES

## 0.1.16

- Added publishing for ghcr.io

## 0.1.15

- Fixed formatting, added push for AWS

## 0.1.14

- Fixed event timestamp in UI

## 0.1.13

- Fixed eventData `pre-wrap` to avoid horizontal scrolling

## 0.1.12

- Fixed handling of Null, None, True and False values in JS

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
