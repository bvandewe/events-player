# CHANGE LOG

<!-- markdownlint-disable MD024 -->

## 0.5.0 - 2025-11-26

### Added

#### Infrastructure

- **Proxy Support**
  - Added support for running the application under a subpath (e.g. `/events-player/`)
  - Implemented `X-Forwarded-Prefix` header handling in backend middleware
  - Updated frontend to respect `base_path` for API calls and redirects

- **Keycloak Upgrade**
  - Upgraded Keycloak to version 26.0.0 (Quarkus distribution)
  - Updated configuration for Hostname v2 and Bootstrap Admin features

#### UI/UX

- **Storage Management**
  - Moved "Clear Storage" button to the main navigation bar for easier access
  - Added storage utilization indicator with color-coding (Green/Yellow/Red)
  - Added tooltip explaining that storage clearing is local and permanent

### Fixed

#### Frontend

- **Initialization**
  - Fixed circular dependency in SSE connection manager causing `ReferenceError` during startup

## 0.4.11 - 2025-11-08

### Added

#### Streams & Search

- **Persistent Event Search UX**
  - Search bar now remembers the last query across reloads via localStorage
  - Clear-state badge and keyboard shortcut (Cmd/Ctrl+F) surface active filters faster
  - Visual cues highlight when search filtering is applied for improved accessibility

### Fixed

#### Timeline

- **Auto-Refresh Reliability**
  - Auto-refresh immediately reschedules itself after manual refreshes so the loop never stalls
  - X-axis window and empty buckets extend to the current time, keeping the latest activity visible even when events pause
  - Handles empty datasets without throwing `ReferenceError: Cannot access 'bucketSizeMs' before initialization`

#### Event Intake

- **Handshake & Invalid CloudEvents**
  - Filters out system handshake payloads and CloudEvents missing required attributes before they reach storage
  - Additional validation in IndexedDB storage prevents malformed timestamps from triggering `RangeError` exceptions

- **Race Condition on Initial Load**
  - Fixed a race condition in the management of the in-memory `sse_clients` dictionary
  - Replaced standard `dict` with `multiprocessing.Manager().dict()` for atomic operations

### Tooling

- **Secrets Scanning Baseline**
  - Added `.secrets.baseline` compatible with the committed detect-secrets version so the pre-commit hook runs cleanly

## 0.4.10 - 2025-11-06

### Added

#### Timeline Features

- **Stacked Bar Chart by Event Source**
  - Timeline now displays stacked bars showing event count per source per time bucket
  - Each source gets a unique color (HSL color generation for better distribution)
  - Interactive legend allows filtering by source
  - Enhanced tooltips show per-source breakdown with total footer
  - Proper stacked mode enabled on both X and Y axes

- **Click-to-Filter and Auto-Zoom**
  - Clicking timeline bars filters entire application by that bucket's time range
  - Automatically zooms in one level (reduces bucket size) when clicking
  - Progressive drill-down: hour → 30min → 20min → 15min → etc.
  - Bucket size dropdown updates automatically during zoom
  - Grafana-like interactive time exploration

- **Enhanced Time Range Options**
  - Expanded from 4 to 12 preset time ranges
  - New options: 5m, 15m, 30m, 3h, 12h, 2d, 30d
  - Custom time range with date/time pickers
  - Visible custom range inputs when "Custom Range" selected

- **Click-to-Filter on Analytics Charts**
  - Top Sources, Top Types, and Top Subjects charts now clickable
  - Clicking any bar filters the entire application by that dimension
  - Tooltips indicate "(click to filter)" for user guidance
  - Unified filtering UX across all charts

#### Admin Features

- **Client Disconnect Functionality**
  - Admins can now forcefully disconnect SSE clients from the Clients modal
  - New "Actions" column with disconnect button in client table (admin-only)
  - Confirmation dialog before disconnecting a client
  - Backend endpoint `/api/sse/disconnect/{client_id}` with admin authorization
  - Automatic table refresh after disconnect

### Fixed

#### Authentication & Authorization

- **Client Disconnect Authorization**
  - Fixed 401 Unauthorized error when disconnecting SSE clients
  - Now uses `apiFetch` wrapper that properly includes Bearer token
  - Authentication credentials correctly sent with admin API calls

#### Timeline

- **Empty Timeline Error**
  - Fixed `TypeError: Cannot set properties of undefined` when no events exist
  - Properly clears all datasets when timeline is empty

- **Timezone/Timestamp Handling**
  - Fixed timezone offset issue causing 1-hour discrepancy
  - Event times without timezone suffix now correctly parsed as UTC
  - Bucket times now use raw timestamps instead of Chart.js parsed values
  - Click-to-filter now uses correct timestamps for accurate event filtering

- **Time Range Filter Reset**
  - Manually changing bucket size now resets time range filter to "all"
  - Prevents confusing state where narrow time filter is active with new bucket size
  - Clears custom start/end times when bucket size changes

- **Click Interaction Behavior**
  - Timeline only responds to clicks on actual bars with data, not empty space
  - Tooltips only appear when hovering over actual bars
  - Fixed interaction mode to prevent false triggers on empty buckets
  - Improved user experience with precise click targeting

- **Timeline Full Screen Button**
  - Fixed "View full screen" button functionality
  - Timeline chart can now be enlarged in modal view like analytics charts

- **Page Title Update**
  - Fixed page title not updating to X/Y notation when filtering via event filter buttons
  - Page title now consistently shows filtered count across all filter methods

- **Filter Button Tooltips**
  - Fixed tooltips persisting after clicking event filter buttons
  - Tooltips now hide immediately when filter buttons are clicked

#### UI Layout

- **Main Container Padding**
  - Removed top and bottom padding from main tag for better space utilization
  - Maintains horizontal padding for proper content spacing

- **Generator Panel Header**
  - Fixed operation history dropdown overlapping title on narrow viewports
  - Improved responsive layout with proper flexbox structure
  - Dropdown now scales appropriately with viewport width

### Changed

#### UI Components

- **Confirmation Dialogs Replaced with Bootstrap Modals**
  - Replaced all native browser `confirm()` and `alert()` dialogs with Bootstrap modals
  - New `showInfo()` method in actionsController for success/info messages
  - Updated confirmations in clientsModal, tasksModal, auth, and authorization modules
  - Consistent UX with themed buttons (danger for destructive actions, success for completions)
  - Better accessibility and more professional appearance
  - Info/success modals hide header close button, show only footer OK button

- **Global Filters Panel**
  - Custom time range inputs now properly show/hide based on selection
  - Better state management for custom vs preset time ranges

- **Time Range Consistency**
  - All components (timeline, analytics, metrics, events) support new time ranges
  - Unified time range calculation across all filter options

## 0.4.9 - 2025-11-05

### Fixed

#### Authentication & Authorization

- **Istio Mode Authentication Detection**
  - Fixed `isAuthenticated()` to work correctly in Istio/OAuth2 Proxy mode
  - In Istio mode, authentication is determined by presence of `userInfo` (not token)
  - Tokens are managed server-side by OAuth2 Proxy, browser never sees them
  - Frontend now correctly detects authenticated users in proxy-based authentication
  - Resolves issue where users were authenticated on backend but UI showed as unauthenticated

## 0.4.8 - 2025-11-05

### Fixed

#### Authentication & Authorization

- **OAuth2 Proxy / Istio Token Extraction**
  - Fixed authentication middleware to extract JWT tokens from OAuth2 Proxy headers
  - Now checks multiple token sources in order:
    1. `Authorization: Bearer <token>` (standard OAuth)
    2. `X-Auth-Request-Access-Token: <token>` (OAuth2 Proxy)
    3. `X-Forwarded-Access-Token: <token>` (other proxies)
  - Resolves issue where OAuth2 Proxy authenticated users were not recognized by backend
  - Critical fix for deployments using OAuth2 Proxy with Istio/service mesh

- **Token Role Extraction Priority**
  - Fixed role extraction order to check `roles` claim before `groups` claim
  - Previous order: `realm_roles` → `realm_access.roles` → `groups` → `roles`
  - New order: `realm_roles` → `realm_access.roles` → `roles` → `groups`
  - Resolves issue where tokens with both `roles` and `groups` claims would use group paths (e.g., `/admins`) instead of proper roles (e.g., `admin`)
  - Groups are now only used as fallback when no role claims are present
  - Added detailed logging to show which claim is being used for role extraction

- **Frontend Authorization Manager**
  - Fixed authorization manager to use role mappings from backend instead of hardcoded role names
  - Now properly respects `API_AUTH_ROLE_ADMIN`, `API_AUTH_ROLE_OPERATOR`, `API_AUTH_ROLE_USER` environment variables
  - Authorization checks now use configured role mappings: `authManager.roleMappings.admin` instead of hardcoded `'admin'`
  - Critical fix for deployments with custom identity provider role naming conventions

## 0.4.7 - 2025-11-04

### Security

#### Authentication

- **Trust Mode Token Decoding**
  - Added `verify_at_hash=False` to skip OpenID Connect at_hash validation

- **Removed Sensitive Logging**
  - No longer logs usernames, user IDs, emails in authentication logs
  - No longer logs full role arrays in authentication logs
  - Changed INFO level logs to DEBUG for detailed authentication info
  - Authorization failures now log role counts instead of actual role names
  - Reduces risk of PII leakage in production logs

## 0.4.6 - 2025-11-04

### Fixed

#### Authentication

- **Trust Mode Token Decoding**
  - Fixed JWT decoding in trust mode to use correct python-jose API
  - Changed from `jwt.get_unverified_claims()` to `jwt.decode()` with `verify_signature=False`
  - Ensures roles are properly extracted from `realm_access.roles` in trust mode
  - Critical fix for Istio/service mesh deployments
  - Resolves "No access_token provided to compare against at_hash claim" errors

## 0.4.5 - 2025-11-04

### Added

#### Authentication

- **Trust Mode for Istio/Service Mesh**
  - New `AUTH_TRUST_MODE` environment variable to skip JWT signature verification
  - Enables deployment behind Istio/service mesh where JWT validation is handled upstream
  - Decodes token without verification while still enforcing RBAC
  - Useful for scenarios where token issuer/realm differs from OAuth configuration
  - Added comprehensive documentation in `notes/ISTIO_TRUST_MODE.md`

#### Error Handling

- **Enhanced JWT Validation Logging**
  - Logs available key IDs when key mismatch occurs
  - Better error messages explaining possible root causes
  - Suggests enabling trust mode for Istio deployments
  - Added troubleshooting guide in `notes/JWT_KEY_MISMATCH_TROUBLESHOOTING.md`

#### UI Improvements

- **Timeline Error Modal**
  - New error modal displays Chart.js time scale errors to users
  - User-friendly messages when bucket size is too small for time range
  - Suggests using larger bucket sizes (minutes/hours instead of seconds)
  - Added technical details section for debugging

### Fixed

#### UI

- **Duplicate Timeline Bucket Size Options**
  - Removed static HTML options from timeline bucket selector
  - JavaScript now fully manages dropdown options dynamically
  - Eliminated duplicate entries (13 static + 13 dynamic → 13 total)

#### Authentication

- **JWT Key ID Mismatch Handling**
  - Better handling of Keycloak key rotation scenarios
  - Trust mode solves token validation issues in Istio environments
  - Improved error messages guide users to appropriate solutions

### Documentation

- **Authentication Guides**
  - Updated `docs/authentication.md` with `AUTH_TRUST_MODE` configuration
  - Added security considerations and usage guidelines
  - Created `notes/ISTIO_TRUST_MODE.md` with complete Istio setup examples
  - Updated `notes/JWT_KEY_MISMATCH_TROUBLESHOOTING.md` with trust mode solution

## 0.4.4 - 2025-11-02

### Added

#### Infrastructure

- **Unified Metadata SSE Stream**
  - New `/stream/meta` endpoint consolidates tasks and clients metadata
  - Single SSE connection for all metadata (tasks + clients statistics)
  - Eliminates polling, provides real-time metadata updates
  - Frontend uses dedicated MetadataSSEManager for subscription-based updates
  - Reduced SSE connections from 5+ to just 2 per browser tab

#### Backend

- **Input Validation for Event Generator**
  - Added JSON validation for `event_data` field in EventGeneratorRequest model
  - Prevents invalid JSON from being processed by background tasks
  - Custom validation error messages for better user experience
  - Global exception handlers for RequestValidationError and ValidationError
  - Returns structured error responses with field-level details

### Changed

#### Architecture

- **SSE Connection Optimization**
  - Clients modal now subscribes to unified metadata stream
  - Tasks modal now subscribes to unified metadata stream
  - Proper initialization order: components load before SSE connections
  - Metadata SSE initialized after all components are ready
  - Both modals share single SSE connection via subscription pattern

### Removed

#### Cleanup

- **Obsolete SSE Endpoints**
  - Removed `/stream/clients` endpoint (superseded by `/stream/meta`)
  - Removed `/stream/tasks` endpoint (superseded by `/stream/meta`)
  - Removed `client_stats_generator()` function
  - Removed `task_stats_generator()` function
  - Reduced backend code by 172 lines (462 → 290 lines in stream.py)

### Fixed

#### Error Handling

- **Graceful Generator Request Failures**
  - Invalid JSON data now rejected at validation layer (422 status)
  - Clear error messages guide users to fix input issues
  - No background tasks created for invalid requests
  - Prevents malformed events from being sent to gateway
  - Better error tracking with structured responses

### Performance

- **Browser Connection Limits**
  - Reduced to 2 persistent SSE connections per tab:
    - 1 for CloudEvents (`/stream/events`)
    - 1 for all metadata (`/stream/meta`)
  - Supports 3+ concurrent browser tabs reliably
  - Eliminated resource-intensive polling operations
  - Real-time updates with lower overhead

## 0.4.3 - 2025-11-02

### Added

#### Features

- **Enhanced Timeline Bucket Sizes**
  - Added 6 new granular bucket size options for high-frequency event analysis
  - New options: 1s, 3s, 5s, 10s, 15s, 20s
  - Total of 13 bucket size options ranging from 1 second to 1 hour
  - Improved event rate analysis for sub-30-second monitoring
  - Bucket size selection persists in localStorage

- **Click-to-Filter Metrics**
  - Event Types metric card now clickable to filter by most common type
  - Event Sources metric card now clickable to filter by most common source
  - Visual hover effects and active state indicators
  - Full keyboard accessibility (Enter/Space key support)
  - Tooltips guide users to click functionality
  - Programmatic filter API added to globalFilterController

- **Analytics Charts**
  - Implemented Top Sources horizontal bar chart (gray theme)
  - Implemented Top Event Types horizontal bar chart (green theme)
  - Implemented Top Subjects horizontal bar chart (yellow theme)
  - Charts display top 10 items for each category
  - Full-screen enlarge functionality for detailed viewing
  - Real-time updates synchronized with event stream
  - Charts respect global filter state

- **Timeline Enhancements**
  - Added auto-refresh toggle for timeline chart
  - Toggle state persists in localStorage
  - Manual refresh available when auto-refresh is disabled
  - Improved performance for high-volume event streams

- **Event Timestamp Features**
  - Toggle between relative time ("2 minutes ago") and absolute timestamps
  - Click timestamp column header to switch display format
  - Format persists per session
  - Tooltips show alternative format on hover

- **Browser Task Management**
  - Tasks modal now displays both backend and browser-side tasks
  - Auto-repeat event generator appears in task list
  - Browser tasks show distinct "Browser" badge
  - Separate cancel handling for browser vs backend tasks
  - Task count badge includes both task types

- **Generator Form Improvements**
  - Reorganized offcanvas header layout
  - Reset and History buttons moved to left side for better UX
  - Operation history dropdown integrated into header
  - More compact and intuitive layout

- **Event Rate Metrics**
  - Split event rate into Average and Peak metrics
  - Average: mean events per minute across all buckets
  - Peak: highest event count in any single minute
  - Dual display format "avg / peak per min"
  - Tooltips explain calculation method

### Changed

#### UI/UX Improvements

- **Unified Dashboard Architecture**
  - Consolidated dashboard to single main view with component-based structure
  - Created reusable component files: metrics.html, streams.html, analytics.html, storage.html, chartModal.html
  - Main.html now includes all components in clean, modular structure
  - Removed redundant dashboard-unified.html in favor of main.html
  - Updated index.html to include main.html instead of dashboard-unified.html

- **State Management**
  - Dashboard controller refactored from factory pattern to class-based singleton
  - Improved real-time update throttling (2-second delay for metrics)
  - Analytics charts always update regardless of active tab
  - Better separation of concerns between tabs and charts

- **Component Organization**
  - Each UI section now in separate HTML component file
  - Collapsible sections with chevron indicators
  - Collapse state persists in localStorage
  - New collapseState.js module for centralized collapse management

- **Tasks Modal**
  - Enhanced to support both backend and browser-side tasks
  - Location badges distinguish task origin (Backend/Browser)
  - Browser tasks show animated progress bars
  - Updated modal title to "Manage Tasks" (was "Active Generator Tasks")
  - Improved info text to clarify task types

### Fixed

#### Bug Fixes

- **Analytics Chart Initialization**
  - Fixed empty analytics panels - charts were placeholder TODO functions
  - Implemented full Chart.js initialization with proper registration
  - Added updateAnalyticsCharts() method to populate data
  - Charts now properly display and update in real-time

- **Build System**
  - Fixed Parcel cache corruption (MDB_BAD_TXN error)
  - Added .parcel-cache to .gitignore
  - Successfully rebuilt after cache cleanup

- **Auto-Repeat Generator**
  - Fixed auto-repeat to start only after first manual form submission
  - Prevents automatic start when checkbox is enabled
  - Proper task registration when repeater starts
  - Task unregistration when repeater stops or is cancelled

- **Modal Z-Index**
  - Confirmation modal now appears on top of other modals
  - Fixed backdrop layering issues
  - Dynamic z-index adjustment (1060 for modal, 1059 for backdrop)

- **Dashboard Routing**
  - Fixed app.js to import dashboard.js instead of non-existent unifiedDashboard.js
  - Removed deleted unifiedDashboard.js file references
  - Dashboard controller properly initialized

#### Code Quality

- **Import Statements**
  - Added missing date-fns import for formatDistanceToNow in events.js
  - Fixed module path for collapseState.js in app.js

### Technical Debt

- **File Cleanup**
  - Deleted obsolete unifiedDashboard.js (replaced by refactored dashboard.js)
  - Cleaned up duplicate dashboard implementation
  - Removed redundant unified dashboard code

## 0.4.2 - 2025-11-01

### Added

#### Features

- **Filtered Event Count Display**
  - H1 title counter now shows "X/Y" format when filters are active (filtered count / total count)
  - Metrics panel label dynamically changes to "Total Filtered Events" when filters are applied
  - Info icon with tooltip displays full total count when viewing filtered results
  - Automatically reverts to standard display when filters are cleared
  - Real-time updates as filters change through appState integration

### Changed

#### State Management

- **Enhanced Event Count Tracking**
  - Added `filteredEventCount` to appState for tracking filtered vs total events
  - Added `setFilteredEventCount()` method to update filtered count
  - Modified `resetEventCount()` to reset both total and filtered counts
  - Connection module now subscribes to both `eventCount` and `filteredEventCount` changes

#### UI Updates

- **Unified Dashboard Metrics**
  - Metrics panel now detects active filters and updates label accordingly
  - Bootstrap tooltip integration for displaying full count information
  - Dynamic subtitle updates based on filter state

## 0.4.1 - 2025-11-01

### Added

#### Documentation

- **Comprehensive RBAC Configuration Guide** (`docs/rbac-guide.md`)
  - Complete step-by-step guide for setting up Keycloak with CloudEvents Player
  - Quick start with docker-compose including pre-configured test users
  - Detailed Keycloak realm configuration explanation
  - CloudEvents Player environment variable reference
  - User management instructions (creating users, assigning roles, setting passwords)
  - Role permissions matrix table showing all feature access by role
  - Advanced configuration for custom realms and external Keycloak
  - Integration examples for other OIDC providers (Auth0, Okta, Azure AD)
  - Comprehensive troubleshooting section for common authentication issues
  - Security best practices for production deployments
- **Documentation Integration**
  - Added RBAC guide to MkDocs navigation under Security section
  - Added prominent link in authentication.md directing to RBAC guide
  - Added RBAC guide to index.md alongside authentication guide
  - Added RBAC guide to quick-start.md "Next Steps" section

#### Features

- **Custom Gateway URL for Admins**
  - Added "Custom URL..." option to event gateway dropdown (admin-only)
  - Custom gateway input field appears when selected
  - Custom gateway URL persists in localStorage across browser reloads
  - Validation prevents empty custom gateway submissions
  - Auto-focus on custom input when selected
  - Hidden from non-admin users (operators and regular users)
  - Seamless integration with existing form state persistence

### Fixed

- **Custom Gateway URL Feature**
  - Fixed JavaScript error preventing custom gateway feature from working
  - Corrected authentication check to use `authManager.authRequired` property instead of non-existent `isAuthEnabled()` method
  - Feature now properly shows custom input field when admin selects "Custom URL..."
  - Added comprehensive debug logging for troubleshooting

- **Network Error Handling**
  - Enhanced HTTP error handling when posting events to gateway
  - Now gracefully handles connection failures (`httpx.ConnectError`)
  - Added timeout exception handling (`httpx.TimeoutException`)
  - Added generic request error handling (`httpx.RequestError`)
  - Task status properly set to "Failed" on network errors
  - Descriptive error messages with appropriate HTTP status codes:
    - 503 Service Unavailable for connection failures
    - 504 Gateway Timeout for timeout errors
    - 502 Bad Gateway for other request errors
  - Prevents unhandled exceptions from crashing the ASGI application

- **Markdown Formatting**
  - Fixed nested list indentation in usage.md to render correctly in MkDocs
  - Changed from 3-space to 4-space indentation for nested lists
  - Lists now properly nest under numbered items instead of flattening
  - Applied fix to "Views" and "Main Components" sections
- **VS Code Markdown Formatting**
  - Disabled Prettier for markdown files to prevent automatic reformatting
  - Configured markdownlint with correct 4-space indentation rule (MD007)
  - Markdown files no longer auto-formatted on save to preserve correct indentation
  - Markdownlint auto-fix still active with proper indentation rules

### Improved

- **Documentation Quality**
  - Fixed markdown formatting issues throughout documentation
  - Improved table formatting in configuration.md
  - Corrected code block formatting
  - Enhanced readability of nested lists
  - All documentation now follows MkDocs best practices

## 0.4.0 - 2025-10-31

### Fixed

- **Duplicate event submissions**: Fixed form being initialized multiple times causing duplicate events
  - Added idempotent initialization guard to generatorForm controller
  - Removed module-level initialization code from dashboard.js and timeline.js
  - Now properly follows single-page application pattern
- **Duplicate SSE subscriptions**: Fixed events appearing twice in streams
  - Removed duplicate 'filters' event subscription in events controller
  - Ensured loadEventsFromStorage only called once per filter change
- **Search functionality**: Restored and enhanced event search
  - Added search input in dashboard tabs header
  - Deep search through entire event payload (CloudEvent attributes + data)
  - localStorage persistence for search term
  - Debounced search (300ms) for better performance
  - Auto-filters new events as they arrive via SSE
  - Keyboard shortcut (Ctrl/Cmd + F) to focus search
  - Clear button to reset search

### Major UI Redesign

#### Unified Dashboard

- **Single-view architecture**: Consolidated Events, Timeline, and Dashboard into one unified dashboard
  - Eliminates navigation between separate pages
  - All features accessible from a single view
  - Improved workflow and reduced cognitive load

#### Layout Structure

- **Row 1**: Page title with filter indicator and clear button
- **Row 2**: Four real-time metric cards (Total Events, Avg Rate, Event Types, Event Sources)
  - Auto-updates every 5 seconds
  - Color-coded subtle backgrounds
  - Shows contextual information (most common type/source)
- **Row 3**: Tab navigation between Streams and Timeline
  - Export button positioned on right side of tab bar
  - Bootstrap tab component with smooth transitions
- **Row 4**: Tab content area
  - **Streams tab**: Full event list with SSE real-time updates
  - **Timeline tab**: Event activity chart with configurable bucket size
- **Row 5**: Analytics panels (three equal columns)
  - Top Sources chart (click to filter)
  - Top Event Types chart (click to filter)
  - Top Subjects chart (click to filter)
- **Row 6**: Storage utilization indicators
  - Recent Events (Tier 1) progress bar
  - Metadata (Tier 2) progress bar
  - Color-coded based on usage (green/yellow/red)
- **Row 7**: Additional metrics
  - Hourly Distribution chart
  - Events Per Minute chart

#### Technical Implementation

- **unifiedDashboard.js controller**: Coordinates all dashboard components
  - Manages tab switching state
  - Updates metrics cards automatically
  - Lazy-loads charts when tabs become active
  - Handles filter changes across all components
- **Preserved functionality**: All existing features maintained
  - SSE real-time event streaming
  - Global filters with persistence
  - Export functionality (restricted to admin/operator)
  - Authorization and role-based access control
  - Search and keyboard navigation
  - Event generator and background tasks

### Benefits

- **Simplified navigation**: No page switching required
- **Better performance**: Single page load, lazy-loaded charts
- **Improved UX**: All information at a glance
- **Faster workflow**: Quick tab switching vs page navigation
- **More screen space**: Optimized layout for content density

## 0.3.9 - 2025-10-31

### New Features

#### Export Events Functionality

- **Export button**: Added export button to Event Stream view header
  - Positioned at top-right of the page header
  - **Restricted to admin and operator roles only**
- **Export modal**: Interactive modal for selecting export options
  - **Filtered Events**: Export only events matching current filters (type, source, subject, time range)
  - **All Events (Tier 1)**: Export all full events from recent storage
  - Dynamic information showing number of events and active filters
- **JSON file download**: Events exported as formatted JSON files
  - Automatic filename generation with timestamp
  - Filter information included in filename for filtered exports
  - Internal storage attributes (storedAt, insertionOrder, sequenceNumber) removed from export
- **User notifications**: Bootstrap alert notifications for export success/failure
  - Success message shows number of events exported
  - Auto-dismisses after 3 seconds
  - Clean notification UI with icons

### Improvements

#### UI/UX Enhancements

- **Enhanced filter clear buttons**: Made clear filter buttons more visible across all views
  - Changed from subtle outline-secondary to bold btn-danger (dark red)
  - Added "Clear" text label alongside the icon
  - Increased font size from 0.75rem to 0.8rem
  - Applied fw-bold class for better visibility
  - Consistent styling across Events, Timeline, and Dashboard views

### Bug Fixes

- Fixed `appState.getFilters()` error - changed to use `appState.get('filters')`
- Fixed export button not showing for admins/operators - moved initialization to run after authorization is ready
  - Export controller now initializes inside `initAuth()` after `authorizationManager.init()`
  - Added debug logging to help troubleshoot authorization issues
- **Fixed tooltip overlapping and sticking issues**
  - All tooltips now hide immediately when mouse leaves (0ms delay)
  - Added 300ms delay before showing tooltips to prevent accidental triggers
  - Tooltips automatically hide on document scroll or mouse leave
  - Applied consistent behavior across all tooltip instances (events, filters, authorization, connection status)

## 0.3.8 - 2025-10-30

### Improvements

#### UI/UX Enhancements

- **Dashboard metrics cards**: Improved readability with better color contrast
  - Changed from solid dark backgrounds to Bootstrap subtle colors (bg-\*-subtle)
  - Applied dark contrasting text colors (text-_-emphasis, text-_)
  - Primary card: dark blue text on light blue background
  - Success card: dark green text on light green background
  - Info card: dark blue text on light cyan background
  - Warning card: dark orange text on light yellow background
- **Filters in dropdown menu**: Moved filters from offcanvas panel to Bootstrap navbar dropdown
  - Filters now accessible via dropdown menu under "Filters" nav item
  - Compact 400px wide dropdown with proper labels for all controls
  - Active filter count badge visible next to "Filters" text
  - Clear All Filters button at bottom of dropdown
  - Removed Alt/Option keyboard shortcut
  - Removed offcanvas panel completely
- **Responsive event stream**: Page header hidden on viewports < 1400px for better space usage
- **Enhanced chart modals**: Added click-to-filter functionality to all enlarged chart modals
  - Events Per Minute: click to filter by time range
  - Top Types: click to filter by event type
  - Top Sources: click to filter by source
  - Hourly Distribution: click to filter by hour
- **Filter indicators on view titles**: Added red dot indicator with clear button to all view titles when filters are active
- **Contextual information on timeline cards**: Added last event time, update time, peak timestamps, and bucket size info
- **Contextual information on dashboard cards**: Added last event time, update time, most common type/source info
- **Dashboard click-to-filter**: Added click handlers to all dashboard charts for drill-down filtering

## 0.3.7 - 2025-10-30

### Improvements

#### UI/UX Enhancements

- **Badge alignment**: Event type badge now aligned left, source badge centered, and subject badge aligned right in event list
- **Quick filter buttons**: Added discreet filter buttons (type, source, subject) to each event header for quick filtering
  - Buttons visible to all users regardless of authorization level
  - One-click filtering with toast notification feedback
- **Bootstrap tooltips**: Replaced all native browser tooltips with Bootstrap tooltips for better styling and UX
  - Smoother animations and consistent look across the application
  - Applied to filter buttons, connection status, admin controls, and more
- **Filter indicator improvement**: Removed intrusive filter banner, replaced with enhanced tooltip on Filters nav item
  - Displays detailed list of active filters on hover
  - Cleaner interface without blocking content
- **Authorization UX**: Removed distracting tooltip from restricted event headers for unauthorized users
  - Cursor change to "not-allowed" provides sufficient visual feedback

## 0.3.6 - 2025-10-30

### Bug Fixes

#### Authentication UI

- **Fixed authentication icon showing gear instead of user profile when authenticated**
- Root cause: `validateToken()` method fetched `/api/auth/info` but only extracted `userInfo`, not `authRequired` flag
- Result: UI displayed "admin features only" mode (gear icon) even when user was fully authenticated
- Solution: Extract both `authRequired` and `roleMappings` from auth info response during token validation
- Authentication UI now correctly displays user profile with role badge and logout option across all views

#### Template System

- Reverted attempted Jinja2 template inheritance approach that broke Parcel compilation
- Restored multi-page architecture with standalone HTML files for each view (events, timeline, dashboard)
- Parcel now correctly compiles all HTML templates to `static/` directory
- Fixed timeline and dashboard views returning raw unprocessed templates

## 0.3.5 - 2025-10-30

### Features

#### Role Display Enhancement

- Display only highest relevant role in user dropdown instead of all JWT roles
- Reduces UI clutter when users have many Keycloak roles assigned
- Priority order: admin > operator > user
- Backend now provides role mappings to frontend via `/api/auth/info` endpoint
- Frontend determines and displays single badge for highest application role

### Bug Fixes

#### Authentication & Token Management

- Fixed token refresh not updating role mappings in frontend
- After token refresh, now re-fetches auth info to get current role mappings and user data
- Fixed JWKS auto-refresh when signing key not found during Keycloak key rotation
- Invalidates JWKS cache and retries when token kid not found in current key set
- Prevents 401 errors when users have tokens signed with newly rotated keys
- Fixed OAuth redirect URL missing `/auth` prefix for old Keycloak versions (pre-v17)
- Old Keycloak requires `/auth/realms/{realm}/...` URL format

#### Error Handling

- Fixed toast error "Cannot read properties of undefined (reading 'join')"
- Toast now handles three error message formats:
  - FastAPI validation errors: `{detail: [{type, msg, loc}]}`
  - String error messages: `{detail: "Authentication required"}`
  - Unknown formats: JSON stringified as fallback
- Prevents JavaScript errors when displaying simple error messages

#### Code Quality

- Fixed Pylance type checking errors for JWT exceptions
- Import `ExpiredSignatureError` and `JWTClaimsError` from `jose.exceptions` instead of `jwt` module
- Removed unused `BaseHTTPMiddleware` import
- Improved code maintainability and IDE support

## 0.3.4 - 2025-10-27

### Configuration

#### Storage Settings Cleanup

- Removed unused age-based storage settings (`storage_max_recent_age`, `storage_max_metadata_age`)
- Simplified to capacity-based FIFO queue cleanup only
- Updated documentation to reflect unified storage approach
- Both Tier 1 (full events) and Tier 2 (metadata) now use consistent capacity-based cleanup
- Removed misleading configuration options that had no effect

#### Authentication Configuration Simplification

- Removed redundant `auth_mode` setting
  - Simplified to single `auth_required` boolean flag
  - Authentication method now auto-detected (Istio/Service Mesh vs Keycloak OAuth)
  - Updated all templates to remove unused `auth_mode` data attributes
  - Cleaned up docker-compose configuration files

### Bug Fixes

#### SSE Connection Leaks

- Fixed SSE connection leaks during view navigation between events list, timeline, and dashboard
- Added cleanup on `beforeunload` event to properly close SSE connections when navigating away
- SSE connection manager now closes existing connections before creating new ones
- Fixed clients modal SSE connection (`/stream/clients`) leaks with proper cleanup
- Prevents `ERR_CONNECTION_RESET` and `ERR_SOCKET_NOT_CONNECTED` errors
- Fixes slow page loading when switching between views
- Browser connection limits no longer exceeded

#### JavaScript Module Initialization

- Fixed "Cannot read properties of null" errors on dashboard and timeline pages
- Fixed `events.js` null reference errors when DOM elements don't exist on all pages
- Added defensive checks in `actions.js` for elements that don't exist on all pages
- Added defensive checks in `search.js` for page-specific elements
- Added defensive checks in `generatorForm.js` for generator panel elements
- Fixed `bodyElement` undefined error in `app.js`
- Fixed incorrect variable reference (`storageConfig` → `storageOptions`) in `app.js`
- All JavaScript modules now gracefully handle missing DOM elements

#### Authentication UI

- Fixed login button not appearing on timeline and dashboard pages when user is logged out
- Auth container now consistently shows when Keycloak is configured
- Added diagnostic logging to help troubleshoot auth UI rendering issues

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
