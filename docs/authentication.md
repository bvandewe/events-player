# Authentication & Authorization

CloudEvent Player supports OAuth 2.0 authentication with Keycloak and role-based access control (RBAC) to secure your event generation and monitoring capabilities.

> **🚀 Quick Start**: For a complete step-by-step guide to set up RBAC with Keycloak, see the [RBAC Configuration Guide](rbac-guide.md).

> **🔍 Mode Detection**: The frontend automatically detects authentication mode from the authentication state, not from backend configuration. This makes the system resilient to configuration issues. See [Technical Details](#mode-detection-internals) below.

## Overview

The authentication system provides:

- **OAuth 2.0 / OIDC**: Industry-standard authentication with Keycloak
- **OAuth2 Proxy / Istio Support**: Works with proxy-based authentication
- **PKCE Flow**: Secure authorization code flow for browser-based apps
- **JWT Validation**: Token-based authentication with RS256 signature verification
- **Role-Based Access Control**: Fine-grained permissions based on user roles
- **Automatic Mode Detection**: Frontend adapts to deployment environment

## Authentication Modes

CloudEvent Player automatically detects and adapts to different authentication scenarios:

### 1. **No Authentication** (Default)

When no authentication is configured, the application runs in open mode with no access restrictions.

```bash
docker run -p 8080:8080 ghcr.io/bvandewe/events-player:latest
```

### 2. **Istio/Proxy Mode** (Production - Recommended)

Pre-authenticated mode where JWT tokens are injected by OAuth2 Proxy or Istio service mesh. The backend validates tokens but the frontend doesn't handle the login flow.

**How it works:**
1. OAuth2 Proxy handles the OAuth flow with Keycloak
2. OAuth2 Proxy stores tokens in encrypted cookie
3. OAuth2 Proxy injects JWT in request headers to backend
4. Backend validates JWT and extracts user information
5. Frontend calls `/api/auth/info` and sees `authenticated: true`
6. Frontend automatically enters "Istio mode" - no login button needed

```bash
docker run -p 8080:8080 \
  -e AUTH_REQUIRED=true \
  -e AUTH_TRUST_MODE=true \
  ghcr.io/bvandewe/events-player:latest
```

**Environment Variables:**
- `AUTH_REQUIRED=true` - Enable authentication
- `AUTH_TRUST_MODE=true` - Skip JWT verification (proxy already validated)
- `AUTH_JWKS_URL` - Optional, for JWT validation if not using trust mode
- No `OAUTH_SERVER_URL` needed - OAuth handled by proxy

**Key Benefit:** JWT never exposed to browser JavaScript (enhanced security)

### 3. **OAuth/Keycloak Mode** (Development)

Full OAuth 2.0 authentication with Keycloak for local development and standalone deployments.

**How it works:**
1. Frontend calls `/api/auth/info` and receives OAuth configuration
2. Frontend shows login button when user not authenticated
3. User clicks login → Redirects to Keycloak
4. After successful login → Token stored in browser sessionStorage
5. Frontend includes token in all API requests

```bash
docker run -p 8080:8080 \
  -e AUTH_REQUIRED=true \
  -e OAUTH_SERVER_URL=http://keycloak:8080 \
  -e OAUTH_REALM=events-player \
  -e OAUTH_CLIENT_ID=events-player-web \
  ghcr.io/bvandewe/events-player:latest
```

## User Roles

CloudEvent Player defines three user roles with different permission levels:

### **Admin Role**

Full administrative access to all features.

**Permissions:**

- ✅ View event headers
- ✅ Expand and view event details
- ✅ Access generator panel
- ✅ Generate events with custom parameters
- ✅ Use iterations control (1-100 events)
- ✅ Use delay control (1-2000ms)

### **Operator Role**

Operational access for event generation and monitoring.

**Permissions:**

- ✅ View event headers
- ✅ Expand and view event details
- ✅ Access generator panel
- ✅ Generate single events (iterations locked to 1)
- ❌ Cannot change iterations (locked to 1)
- ❌ Cannot change delay (locked to 150ms)

### **User Role**

Read-only access to view incoming events.

**Permissions:**

- ✅ View event headers (collapsed)
- ❌ Cannot expand event details
- ❌ Cannot access generator panel
- ❌ Cannot generate events

## Role-Based Access Control

### Backend Authorization

The API enforces role-based access at the endpoint level:

#### Generator Endpoint (`/api/generate`)

- **Required Role**: `operator` or `admin`
- **Admin-Only Features**:
    - `iterations > 1`: Only admins can generate multiple events
    - `delay != 150`: Only admins can customize delay between events

**Example Response (403 Forbidden):**

```json
{
  "detail": "Only administrators can use iterations or custom delay settings"
}
```

### Frontend Authorization

The UI automatically adapts based on user permissions:

#### For Users (Basic Role)

- Generator link hidden from navigation
- Keyboard shortcuts disabled (Ctrl/Meta+Up)
- Event accordion buttons disabled
- "Expand all" button hidden
- Can only view collapsed event headers

#### For Operators

- Generator accessible in navigation and via keyboard
- Iterations slider disabled (locked to 1)
- Delay slider disabled (locked to 150ms)
- Can expand events to view full details
- Form validates permissions before submission

#### For Admins

- Full access to all UI features
- All controls enabled
- Can adjust iterations (1-100)
- Can adjust delay (1-2000ms)

## Keycloak Configuration

### Setting Up Keycloak

1. **Start Keycloak** (example using Docker):

```bash
docker run -d \
  --name keycloak \
  -p 8090:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:22.0.5 \
  start-dev
```

2. **Create a Realm**

- Login to Keycloak admin console: <http://localhost:8090>
- Create a new realm named `events-player`

3. **Create Realm Roles**

Create three realm roles:

- `admin` - Full administrative access
- `operator` - Operational access
- `user` - Read-only access

4. **Create Client for Frontend**

Create a public client for the web UI:

- **Client ID**: `events-player-web`
- **Client Type**: OpenID Connect
- **Access Type**: Public
- **Valid Redirect URIs**: `http://localhost:8884/*`
- **Web Origins**: `http://localhost:8884`
- **Standard Flow Enabled**: ON
- **Direct Access Grants Enabled**: ON
- **PKCE Code Challenge Method**: S256

**Important**: No additional client configuration is needed for token refresh. The application automatically requests the `offline_access` scope during OAuth login, which instructs Keycloak to issue refresh tokens. This is standard OIDC behavior.

5. **Create Client for Backend** (optional)

Create a bearer-only client for JWT validation:

- **Client ID**: `events-player-api`
- **Client Type**: OpenID Connect
- **Access Type**: Bearer-only
- **Standard Flow Enabled**: OFF

6. **Create Users**

Create test users and assign roles:

```
Username: admin
Password: admin123
Roles: admin

Username: operator
Password: operator123
Roles: operator

Username: user
Password: user123
Roles: user
```

### Environment Variables for Keycloak

#### `API_AUTH_MODE`

- **Description**: Authentication mode
- **Type**: String
- **Default**: `"none"`
- **Valid Values**: `none`, `keycloak`, `istio`, `auto`
- **Example**: `API_AUTH_MODE=auto`

#### `API_AUTH_JWKS_URL`

- **Description**: JWKS endpoint URL for JWT validation
- **Type**: String (URL)
- **Required**: When auth_mode is `istio` or `auto`
- **Example**: `API_AUTH_JWKS_URL=http://keycloak:8080/realms/events-player/protocol/openid-connect/certs`

The JWKS (JSON Web Key Set) endpoint provides public keys for JWT signature verification.

#### `API_AUTH_ISSUER`

- **Description**: Expected JWT issuer (iss claim)
- **Type**: String
- **Required**: When auth_mode is `istio` or `auto`
- **Example**: `API_AUTH_ISSUER=http://localhost:8090/realms/events-player`

Must match the issuer in JWT tokens. Use the external URL accessible from browsers.

#### `API_AUTH_AUDIENCE`

- **Description**: Expected JWT audience (aud claim)
- **Type**: String
- **Required**: When auth_mode is `istio` or `auto`
- **Example**: `API_AUTH_AUDIENCE=events-player-web`

The intended audience for the JWT token, typically the client ID.

#### `API_AUTH_REQUIRED`

- **Description**: Whether authentication is required for all endpoints
- **Type**: Boolean (string)
- **Default**: `"false"`
- **Example**: `API_AUTH_REQUIRED=false`

When false, authentication is optional. Protected endpoints still require authentication, but public endpoints remain accessible.

#### `API_AUTH_TRUST_MODE`

- **Description**: Skip JWT signature verification (trust mode)
- **Type**: Boolean (string)
- **Default**: `"false"`
- **Example**: `API_AUTH_TRUST_MODE=true`

⚠️ **Use with caution**: When enabled, the application will decode JWT tokens without verifying:

- Signature (no JWKS lookup required)
- Issuer validation
- Audience validation

**When to use:**

- Running behind Istio/service mesh with RequestAuthentication policy
- Proxy layer (e.g., Istio) has already validated the JWT
- Token issuer/realm differs from your configured OAuth settings
- Troubleshooting key ID mismatch issues

**Security implications:**

- Only enable in trusted environments where JWT validation is handled upstream
- The application still extracts user info and enforces RBAC
- Ensure your proxy/mesh is properly configured to validate tokens

**Example with Istio:**

```bash
docker run -p 8080:8080 \
  -e AUTH_REQUIRED=true \
  -e AUTH_TRUST_MODE=true \
  ghcr.io/bvandewe/events-player:latest
```

#### `API_KEYCLOAK_URL`

- **Description**: Internal Keycloak URL (for backend)
- **Type**: String (URL)
- **Required**: When auth_mode is `keycloak` or `auto`
- **Example**: `API_KEYCLOAK_URL=http://keycloak:8080`

Used by backend for token exchange. Can be internal Docker hostname.

#### `API_KEYCLOAK_URL_EXTERNAL`

- **Description**: External Keycloak URL (for frontend)
- **Type**: String (URL)
- **Required**: When auth_mode is `keycloak` or `auto`
- **Example**: `API_KEYCLOAK_URL_EXTERNAL=http://localhost:8090`

URL accessible from browsers for OAuth redirects. Use localhost or public hostname.

#### `API_KEYCLOAK_REALM`

- **Description**: Keycloak realm name
- **Type**: String
- **Default**: `"events-player"`
- **Example**: `API_KEYCLOAK_REALM=events-player`

#### `API_KEYCLOAK_CLIENT_ID`

- **Description**: Keycloak client ID for the web application
- **Type**: String
- **Default**: `"events-player-web"`
- **Example**: `API_KEYCLOAK_CLIENT_ID=events-player-web`

Must be a public client configured with PKCE support.

#### `API_KEYCLOAK_CLIENT_SECRET`

- **Description**: Client secret (leave empty for public clients)
- **Type**: String
- **Default**: `""`
- **Example**: `API_KEYCLOAK_CLIENT_SECRET=`

Public clients using PKCE don't require a client secret.

## Docker Compose Example

Here's a complete docker-compose setup with Keycloak authentication:

```yaml
version: "3.8"

services:
  keycloak:
    image: quay.io/keycloak/keycloak:22.0.5
    container_name: keycloak
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_HOSTNAME: localhost
      KC_HOSTNAME_PORT: 8090
      KC_HOSTNAME_STRICT: false
      KC_HTTP_ENABLED: true
      KC_HOSTNAME_STRICT_HTTPS: false
    ports:
      - "8090:8080"
    volumes:
      - ./deployments/keycloak/events-player-realm-export.json:/opt/keycloak/data/import/events-player-realm-export.json
    command:
      - start-dev
      - --import-realm

  events-player:
    image: ghcr.io/bvandewe/events-player:latest
    container_name: events-player
    ports:
      - "8884:8080"
    environment:
      # Authentication configuration
      api_auth_mode: auto
      api_auth_jwks_url: http://keycloak:8080/realms/events-player/protocol/openid-connect/certs
      api_auth_issuer: http://localhost:8090/realms/events-player
      api_auth_audience: events-player-web
      api_auth_required: "false"
      # Keycloak OAuth configuration
      api_keycloak_url: http://keycloak:8080
      api_keycloak_url_external: http://localhost:8090
      api_keycloak_realm: events-player
      api_keycloak_client_id: events-player-web
      api_keycloak_client_secret: ""
    depends_on:
      - keycloak
```

## Testing Authentication

### Test as Admin

1. Navigate to <http://localhost:8884>
2. Click the "Login" button
3. Login with:
   - Username: `admin`
   - Password: `admin123`
4. Verify:
   - ✅ Generator link visible
   - ✅ All controls enabled
   - ✅ Can adjust iterations and delay
   - ✅ Can expand events

### Test as Operator

1. Logout (if logged in)
2. Login with:
   - Username: `operator`
   - Password: `operator123`
3. Verify:
   - ✅ Generator link visible
   - ❌ Iterations slider disabled (locked to 1)
   - ❌ Delay slider disabled (locked to 150ms)
   - ✅ Can expand events

### Test as User

1. Logout (if logged in)
2. Login with:
   - Username: `user`
   - Password: `user123`
3. Verify:
   - ❌ Generator link hidden
   - ❌ Cannot expand events
   - ✅ Can view event headers

## Security Features

### PKCE (Proof Key for Code Exchange)

CloudEvent Player implements OAuth 2.0 with PKCE for enhanced security:

- Generates `code_verifier` (random 43-128 character string)
- Creates `code_challenge` using SHA-256 hash
- Sends `code_challenge` during authorization
- Sends `code_verifier` during token exchange
- Keycloak validates that hash(code_verifier) == code_challenge

### JWT Validation

Backend validates all JWT tokens:

- **Signature Verification**: RS256 with public key from JWKS
- **Expiration Check**: Rejects expired tokens
- **Issuer Validation**: Verifies token issuer matches configuration
- **Audience Validation**: Ensures token is intended for this application
- **JWKS Caching**: Public keys cached for 5 minutes

### Defense in Depth

Authorization is enforced at multiple layers:

1. **Backend API**: Role checks on protected endpoints
2. **Frontend UI**: Disabled controls and hidden elements
3. **Form Validation**: Client-side checks before submission
4. **HTTP Headers**: Authorization header with Bearer token

## Troubleshooting

### Login Redirect Issues

**Problem**: After login, redirected to wrong URL

**Solution**: Check `api_keycloak_url_external` matches the URL in browser

```bash
# Should be browser-accessible URL, not Docker internal hostname
api_keycloak_url_external=http://localhost:8090  # ✅ Correct
api_keycloak_url_external=http://keycloak:8080   # ❌ Wrong (internal)
```

### Bearer-Only Error

**Problem**: "Bearer-only applications are not allowed to initiate browser login"

**Solution**: Ensure client is configured as **public**, not confidential or bearer-only

```json
{
  "clientId": "events-player-web",
  "publicClient": true, // Must be true
  "bearerOnly": false // Must be false
}
```

### PKCE Code Verifier Error

**Problem**: "PKCE code verifier not specified"

**Solution**: Clear browser sessionStorage and try again

```javascript
// In browser console
sessionStorage.clear();
location.reload();
```

### Roles Not Appearing

**Problem**: User roles not showing in JWT

**Solution**: Add protocol mapper in Keycloak client:

1. Go to client → Client Scopes → Dedicated scope
2. Add mapper → By configuration → User Realm Role
3. Token Claim Name: `realm_access.roles`
4. Claim JSON Type: String
5. Add to access token: ON

### CORS Errors

**Problem**: Cross-origin request blocked

**Solution**: Check Web Origins in Keycloak client configuration

```text
Web Origins: http://localhost:8884
```

### Token Refresh Not Working

**Problem**: Automatic token refresh fails, user forced to log in again

**Solution**: Ensure the OAuth flow requests the `offline_access` scope

The application automatically requests this scope during login. If you've customized the OAuth flow, verify:

```javascript
// In auth.js - OAuth authorization request
scope: "openid profile email offline_access"; // offline_access required
```

**Keycloak Configuration**: No special client configuration needed. The `offline_access` scope is a standard OIDC scope that instructs Keycloak to issue refresh tokens.

**Debugging**:

1. Open browser DevTools → Application → Session Storage
2. Check for `refresh_token` key after login
3. If missing, verify the OAuth scope parameter includes `offline_access`

## Token Management

### Automatic Token Refresh

CloudEvent Player implements automatic OIDC token refresh to prevent user session interruptions:

#### How It Works

1. **Proactive Refresh**: Tokens are automatically refreshed 5 minutes before expiry
2. **Background Monitoring**: System checks token expiry every 60 seconds
3. **Seamless Updates**: Refresh happens in background without user interaction
4. **401 Retry**: API calls that fail with 401 automatically retry after refresh

#### Token Storage

Tokens are stored in browser sessionStorage:

- `access_token`: Current JWT access token
- `refresh_token`: Token used to obtain new access tokens
- `token_expires_at`: Timestamp for proactive refresh calculation

#### Refresh Flow

1. System detects token will expire within 5 minutes
2. Calls `/api/auth/refresh` endpoint with refresh token
3. Backend exchanges refresh token with Keycloak for new access token
4. New tokens stored in sessionStorage
5. User session continues uninterrupted

#### Manual Token Refresh

Tokens also refresh automatically when:

- Any API call receives a 401 response
- User attempts an operation requiring authentication
- Token validation detects expiry

#### Session Expiry

If token refresh fails (e.g., refresh token expired or revoked):

1. User sees notification about session expiry
2. Application switches to read-only mode
3. User prompted to log in again
4. All stored tokens cleared from sessionStorage

### Token Validation

The application validates tokens on every API request:

- Checks token presence in sessionStorage
- Verifies token expiry timestamp
- Automatically refreshes if expired or expiring soon
- Falls back to login if refresh fails

## API Endpoints

### Public Endpoints

- `GET /` - Web UI (no auth required)
- `GET /api/health` - Health check
- `GET /api/auth/info` - Authentication status

### Protected Endpoints

#### Event Generation

- `POST /api/generate` - Generate events (requires `operator` or `admin`)
    - Submits background task for event generation
    - Returns task ID for tracking
    - Validates OAuth token before processing

#### Task Management

- `GET /api/tasks` - View all active tasks (requires `admin`)

    - Lists running, pending, completed, and failed tasks
    - Returns task status, progress, and timestamps
    - Admin-only endpoint

- `POST /api/task/{task_id}/cancel` - Cancel specific task (requires `admin`)

    - Gracefully stops event generation task
    - Events generated before cancellation are preserved
    - Admin-only endpoint

- `POST /api/tasks/cancel-all` - Cancel all running tasks (requires `admin`)
    - Bulk cancellation for all active tasks
    - Emergency control feature
    - Admin-only endpoint

#### Authentication Management

- `GET /api/auth/info` - Get current authentication status and config

    - Returns user info if authenticated
    - Provides Keycloak configuration for login
    - Public endpoint

- `POST /api/auth/callback` - OAuth callback handler for token exchange

    - Exchanges authorization code for tokens
    - PKCE verification
    - Returns access_token, refresh_token, and user info

- `POST /api/auth/refresh` - Refresh access token
    - Exchanges refresh_token for new access_token
    - Extends user session without re-login
    - Returns new tokens and updated expiry

### Authorization Rules

| Endpoint                     | Anonymous | User | Operator | Admin |
| ---------------------------- | --------- | ---- | -------- | ----- |
| `GET /`                      | ✅        | ✅   | ✅       | ✅    |
| `GET /api/health`            | ✅        | ✅   | ✅       | ✅    |
| `GET /api/auth/info`         | ✅        | ✅   | ✅       | ✅    |
| `POST /api/auth/callback`    | ✅        | ✅   | ✅       | ✅    |
| `POST /api/auth/refresh`     | ✅        | ✅   | ✅       | ✅    |
| `POST /api/generate`         | ❌        | ❌   | ✅       | ✅    |
| `GET /api/tasks`             | ❌        | ❌   | ❌       | ✅    |
| `POST /api/task/*/cancel`    | ❌        | ❌   | ❌       | ✅    |
| `POST /api/tasks/cancel-all` | ❌        | ❌   | ❌       | ✅    |

## Mode Detection Internals

### How Frontend Detects Authentication Mode

The frontend automatically determines the authentication mode by examining the `/api/auth/info` response:

```javascript
// Frontend logic (src/ui/js/auth/auth.js)

const response = await fetch('/api/auth/info');
const data = await response.json();

if (data.authenticated) {
    // User is already authenticated → Istio/Proxy mode
    this.mode = 'istio';
    this.userInfo = data.user;
} else if (data.oauth_config) {
    // OAuth config provided → OAuth mode
    this.mode = 'oauth';
    this.oauthConfig = data.oauth_config;
} else {
    // No authentication → Open mode
    this.mode = 'none';
}
```

**Key Insight:** The frontend does NOT use the `mode` field from the backend response. Instead, it independently determines the mode based on authentication state. This makes the system resilient to backend configuration issues.

### Authentication State Logic

```
┌────────────────────────────────────────┐
│  Frontend: GET /api/auth/info          │
└──────────────┬─────────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ authenticated: true? │
    └──────┬───────────────┘
           │
      ┌────┴────┐
      │         │
      ▼         ▼
    YES        NO
      │         │
      │         └──> Check oauth_config
      │                    │
      │              ┌─────┴─────┐
      │              │           │
      │             YES         NO
      │              │           │
      ▼              ▼           ▼
  mode='istio'  mode='oauth'  mode='none'
```

### Why This Design is Resilient

1. **Works with minimal configuration**: Backend can have no `AUTH_JWKS_URL` or `OAUTH_SERVER_URL` and still function correctly if user is authenticated
2. **Adapts to deployment**: Automatically handles OAuth2 Proxy, Istio, or direct OAuth scenarios
3. **Frontend independence**: Frontend doesn't depend on backend environment variables
4. **Simple logic**: Only three states to handle based on actual authentication state

### Example: OAuth2 Proxy + Istio

In production with OAuth2 Proxy:

1. OAuth2 Proxy intercepts browser request
2. OAuth2 Proxy handles OAuth flow with Keycloak
3. OAuth2 Proxy injects JWT in request header
4. Backend extracts JWT, validates user
5. Backend returns `/api/auth/info` with `authenticated: true`
6. Frontend sees `authenticated: true` → Sets `mode = 'istio'`
7. No login button shown, user already authenticated ✅

**Backend configuration can be minimal:**
```bash
AUTH_REQUIRED=true
AUTH_TRUST_MODE=true
# No AUTH_JWKS_URL needed!
# No OAUTH_SERVER_URL needed!
```

See `notes/MODE_DETECTION_CASE_STUDY.md` for the full technical analysis.

## Next Steps

- [Configuration Guide](configuration.md) - Full list of environment variables
- [Deployment Guide](deployment.md) - Deploy with authentication
- [Quick Start](quick-start.md) - Get started with CloudEvent Player
