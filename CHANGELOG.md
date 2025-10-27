# CHANGE LOG

## 0.3.3 - 2025-10-27

### Bug Fixes

#### Toast Notification Race Condition

- Fixed critical race condition causing toast notifications to fail during view navigation
- Added pending toast queue to handle toasts triggered before Bootstrap initialization
- Implemented defensive checks to prevent "Cannot read properties of undefined (reading 'Toast')" errors
- Toasts triggered during page reload are now queued and displayed once system is ready
- Added DOM element existence validation before creating toast instances
- Resolved intermittent "stuck loading" behavior when switching between views

#### Role Mapping Configuration

- Added environment variables for configurable role mapping: `API_AUTH_ROLE_ADMIN`, `API_AUTH_ROLE_OPERATOR`, `API_AUTH_ROLE_USER`
- Updated authentication dependency functions to use configurable role names
- Updated all route handlers to use settings-based role checks instead of hardcoded strings
- Generator endpoint admin validation now uses configurable role settings
- Allows deployment with custom identity provider role naming conventions without code changes
- Default values maintain backward compatibility with existing deployments

## 0.3.2 - 2025-10-27

### Features

#### Swagger UI OAuth2 Authentication

- Added OAuth2 Authorization Code flow support in Swagger UI
- "Authorize" button now available for testing protected endpoints
- Integrated with Keycloak for seamless authentication
- Support for both OAuth2 and Bearer token authentication methods
- PKCE (Proof Key for Code Exchange) enabled for enhanced security
- Protected endpoints now properly show security requirements in OpenAPI schema

#### Real-time SSE Client Monitoring

- SSE `/stream/clients` endpoint now emits updates when queue sizes change
- Client statistics update in real-time as events flow through queues
- Fixed issue where queue utilization and status were only updated on client connect/disconnect
- Current Clients modal now shows live queue activity and utilization metrics

### Improvements

#### Authentication System

- Flattened authentication dependency chain for better OpenAPI integration
- Updated `get_current_user_optional`, `get_current_user_required`, `require_admin`, and `require_operator` to explicitly declare HTTPBearer security scheme
- FastAPI now properly detects security requirements for protected endpoints
- Authorization headers automatically included in Swagger UI requests after authentication

#### Docker Image Tagging

- Fixed Docker image tags to include `v` prefix (e.g., `v0.3.2` instead of `0.3.2`)
- Added automatic `latest` tag to images pushed to main branch
- Docker workflow now creates version tags with proper semantic versioning format
- Tags now match GitHub release tags (with `v` prefix)

#### UI Enhancements

- Generator minimum delay increased from 1ms to 50ms (prevents system overload)
- Generator maximum iterations increased from 100 to 500
- Centered "Generate CloudEvents" title in generator offcanvas panel
- Fixed Bootstrap card structure in Help modal storage system section
- Improved card formatting consistency across Help modal

#### Keyboard Navigation

- Changed global filters keyboard shortcut from Shift to Alt/Option (reduces conflicts with browser shortcuts)
- Updated Help modal documentation to reflect new keyboard shortcuts

### Documentation

- Added comprehensive Swagger UI authentication guide to README.md
- Documented OAuth2 flow and Bearer token usage
- Added step-by-step instructions for using the Authorize button
- Clarified WebSocket warnings in console (informational only, SSE implementation working correctly)

### Bug Fixes

- Fixed Authorization header not appearing in Swagger UI for protected endpoints
- Fixed queue size and utilization not updating in real-time in Current Clients modal
- Fixed card styling issues in Help modal

### Technical Improvements

- Enhanced OpenAPI schema customization to preserve FastAPI auto-generated security schemes
- Improved SSE client statistics generator to track queue size changes
- Added type annotations for better code quality
- Proper security scheme detection by FastAPI for Swagger UI integration

## 0.3.1 - 2025-10-26

### Documentation

#### Feature Documentation Reorganization

- Split monolithic `features.md` (567 lines) into 10 focused documents in `docs/features/` folder:
  - `index.md`: Features overview with navigation guide
  - `views.md`: Multiple Views (Events List, Timeline Chart)
  - `filtering.md`: Comprehensive filtering system
  - `storage.md`: Two-tier storage architecture
  - `sse.md`: Server-Sent Events real-time streaming
  - `tasks.md`: Background task management
  - `rbac.md`: Role-Based Access Control
  - `keyboard-shortcuts.md`: Complete keyboard shortcuts reference
  - `state-management.md`: Reactive state system
  - `performance.md`: Performance optimization techniques
- Updated `mkdocs.yml` with hierarchical navigation structure
- Total: 3,665 lines of comprehensive, focused documentation

#### Documentation Corrections

- Fixed RBAC documentation inconsistencies:
  - Clarified that ALL authenticated users can clear their own browser's local storage
  - Updated permission matrix to reflect client-side storage model
  - Removed admin-only references for storage clearing
  - Added notes explaining browser-specific, per-user storage architecture
- Each document now includes:
  - Overview and key features
  - Detailed implementation explanations
  - Usage examples and best practices
  - Troubleshooting guides
  - Cross-links to related features

### Features

#### State Management System

- Added centralized `AppState` class for reactive state management
- Observer pattern for component synchronization
- Dot notation support for nested state access
- Debug mode with built-in logging
- No external dependencies (pure JavaScript)
- State persistence during browser session
- Eliminates data duplication across views

#### API Client Utilities

- Added `apiClient` wrapper with automatic token refresh on 401 errors
- Retry logic for failed requests after token refresh
- Helper functions: `apiPost()`, `apiGet()`, `apiFetch()`
- Prevents infinite retry loops
- Seamless integration with existing authentication flow

### Improvements

- Updated filter controller to use centralized state management
- Updated event generator form to use new API client
- Improved cross-view synchronization through state subscriptions
- Better error handling in API requests
- Documentation notes for admin task cancellation and OIDC token refresh

### Bug Fixes

- Fixed storage clearing permissions (now correctly available to all users)
- Fixed API authentication issues in generator form

## 0.3.0 - 2025-10-26

### Major Features

#### Timeline Chart View

- Added visual timeline view with Chart.js for event activity visualization
- Interactive timeline showing event distribution over time
- Synchronized filters between Events and Timeline views
- Auto-refresh and manual refresh capabilities
- Time-based pattern analysis and debugging

#### Client-Side Storage Architecture

- Two-tier storage system with IndexedDB and in-memory cache
- Persistent event storage surviving browser restarts
- Efficient event retrieval with database indexes
- Storage management controls for administrators
- Automatic cleanup and configurable retention

#### State Management System

- Reactive state management (`appState`) across all views
- Centralized state for filters, events, and view settings
- Observer pattern for component synchronization
- Consistent data across multiple views
- Framework-independent architecture

#### Advanced Filtering System

- Multi-dimensional filtering: type, source, subject, search, time range
- Click-to-filter functionality on event properties
- Filter chips with individual removal
- Real-time event counter showing filtered results
- Synchronized filters across all views
- Time range filtering (last hour, 6h, 24h, all time)

#### OIDC Token Refresh

- Automatic access token refresh using refresh tokens
- Proactive token refresh (5 minutes before expiry)
- Background token monitoring (every 60 seconds)
- Seamless session continuation without user interruption
- Automatic retry of failed API calls after token refresh
- Support for `offline_access` scope in OAuth flow
- Read-only mode fallback on refresh failure

#### Admin Task Management

- Real-time task management modal for administrators
- View all active event generation tasks
- Cancel individual or all running tasks
- Progress tracking with real-time updates
- Auto-refresh every 2 seconds
- Graceful task cancellation preserving generated events
- Audit logging of admin actions

#### Keyboard Shortcuts

- Full keyboard navigation support
- `Ctrl/Cmd + K`: Focus search
- `Ctrl/Cmd + G`: Open event generator
- `Ctrl/Cmd + R`: Refresh events/timeline
- `Ctrl/Cmd + A`: Toggle all accordions
- `Ctrl/Cmd + L`: Clear all filters
- `Escape`: Close offcanvas/modals

### User Interface Improvements

- Enhanced navigation bar with view switcher
- Connection status indicator for SSE
- Real-time event counter with filter awareness
- Sticky header for better scrolling experience
- Dropdown filters with multi-select capability
- Bootstrap Icons integration
- Improved modal and toast notifications
- Consistent page titles across views

### Backend Enhancements

- Admin-only task management endpoints
  - `GET /api/tasks` - List all tasks
  - `POST /api/task/{task_id}/cancel` - Cancel specific task
  - `POST /api/tasks/cancel-all` - Cancel all tasks
- Token refresh endpoint: `POST /api/auth/refresh`
- Enhanced background task system with cancellation support
- Improved error handling and validation
- Request ID tracing for debugging

### Bug Fixes

- Fixed event counter double-increment issue
- Fixed timezone/timestamp handling in UI
- Fixed Bootstrap Icons missing on Timeline view
- Fixed dropdown filter visibility issues
- Fixed clearAll() duplicating filters
- Fixed generator not working on Timeline view
- Fixed timeline refresh and auto-refresh issues
- Removed code duplication across views

### Developer Experience

- Comprehensive MkDocs documentation updates
- New "Advanced Features" documentation page
- Updated authentication documentation with token refresh details
- API endpoint documentation with role-based access table
- Architecture documentation for storage and state management
- Code organization and modularization improvements

### Breaking Changes

- None (backward compatible)

### Configuration

- No new environment variables required
- OAuth `offline_access` scope automatically requested
- Keycloak client configuration unchanged (no special setup needed)

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
