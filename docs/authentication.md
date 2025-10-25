# Authentication & Authorization

CloudEvent Player supports OAuth 2.0 authentication with Keycloak and role-based access control (RBAC) to secure your event generation and monitoring capabilities.

## Overview

The authentication system provides:

- **OAuth 2.0 / OIDC**: Industry-standard authentication with Keycloak
- **PKCE Flow**: Secure authorization code flow for browser-based apps
- **JWT Validation**: Token-based authentication with RS256 signature verification
- **Role-Based Access Control**: Fine-grained permissions based on user roles
- **Hybrid Mode**: Support for both Istio pre-authentication and Keycloak OAuth

## Authentication Modes

CloudEvent Player supports multiple authentication modes:

### 1. **No Authentication** (Default)

When no authentication is configured, the application runs in open mode with no access restrictions.

```bash
docker run -p 8080:8080 ghcr.io/bvandewe/events-player:latest
```

### 2. **Keycloak OAuth Mode**

Full OAuth 2.0 authentication with Keycloak for local development and standalone deployments.

```bash
docker run -p 8080:8080 \
  -e api_auth_mode=keycloak \
  -e api_keycloak_url=http://keycloak:8080 \
  -e api_keycloak_realm=events-player \
  -e api_keycloak_client_id=events-player-web \
  ghcr.io/bvandewe/events-player:latest
```

### 3. **Istio JWT Mode**

Pre-authenticated mode where JWT tokens are injected by Istio service mesh. The application validates tokens but doesn't handle the login flow.

```bash
docker run -p 8080:8080 \
  -e api_auth_mode=istio \
  -e api_auth_jwks_url=https://keycloak.example.com/realms/events-player/protocol/openid-connect/certs \
  -e api_auth_issuer=https://keycloak.example.com/realms/events-player \
  -e api_auth_audience=events-player-web \
  ghcr.io/bvandewe/events-player:latest
```

### 4. **Auto Mode** (Recommended)

Automatically detects whether JWT is pre-injected (Istio) or if OAuth flow is needed (Keycloak).

```bash
docker run -p 8080:8080 \
  -e api_auth_mode=auto \
  -e api_auth_jwks_url=http://keycloak:8080/realms/events-player/protocol/openid-connect/certs \
  -e api_keycloak_url=http://keycloak:8080 \
  -e api_keycloak_realm=events-player \
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

- Login to Keycloak admin console: http://localhost:8090
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

1. Navigate to http://localhost:8884
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

```
Web Origins: http://localhost:8884
```

## API Endpoints

### Public Endpoints

- `GET /` - Web UI (no auth required)
- `GET /api/health` - Health check
- `GET /api/auth/info` - Authentication status

### Protected Endpoints

- `POST /api/generate` - Generate events (requires `operator` or `admin`)
- `GET /api/tasks` - View tasks (requires authentication)
- `DELETE /api/tasks` - Cancel tasks (requires authentication)

### Authentication Endpoints

- `GET /api/auth/info` - Get current authentication status and config
- `POST /api/auth/callback` - OAuth callback handler for token exchange

## Next Steps

- [Configuration Guide](configuration.md) - Full list of environment variables
- [Deployment Guide](deployment.md) - Deploy with authentication
- [Quick Start](quick-start.md) - Get started with CloudEvent Player
