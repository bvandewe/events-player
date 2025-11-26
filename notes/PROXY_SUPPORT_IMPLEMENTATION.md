# Proxy Support Implementation

## Overview

Implemented support for running the Event Player under a subpath (e.g., `/events/`) behind a reverse proxy.

## Changes

### Backend

- **Middleware**: Added `proxy_middleware` in `src/api/app.py` to detect `X-Forwarded-Prefix` header and store it in `request.state.base_path`.
- **Routes**:
  - Updated `get_ui` in `src/api/routes.py` to inject `base_path` into the `index.html` template context.
  - Updated `get_auth_info` in `src/api/routes.py` to return `base_path` in the JSON response.

### Frontend

- **Configuration**: `index.html` now includes `data-base-path` attribute on the `<body>` tag.
- **Auth Manager**: `src/ui/js/auth/auth.js` reads `data-base-path` and uses it to construct the correct `redirect_uri` for OAuth flows and for `window.history.replaceState`.
- **API Client**: `src/ui/js/utils/apiClient.js` automatically prepends the base path to all API requests made via `apiFetch`.
- **SSE**: Updated `src/ui/js/sse/metadata.js`, `src/ui/js/sse/connection.js`, and `src/ui/js/sse/task.js` to use the base path for `EventSource` connections.
- **Clients Modal**: Updated `src/ui/js/ui/clientsModal.js` to use `apiFetch` instead of raw `fetch` to benefit from base path handling.

## Verification

- **Standalone**: Should continue to work as before (base path `/`).
- **Proxy**: When `X-Forwarded-Prefix` is set (e.g., `/events`), the app should:
  - Generate correct OAuth redirect URIs (e.g., `.../events/login/callback`).
  - Make API calls to correct paths (e.g., `/events/api/...`).
  - Connect to SSE streams at correct paths (e.g., `/events/stream/...`).
