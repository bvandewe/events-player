# OAuth Architecture - Hybrid Authentication

> **⚠️ Important Update**: The authentication mode detection described in this document has been simplified. The frontend now determines mode from authentication state rather than backend configuration. See [MODE_DETECTION_CASE_STUDY.md](MODE_DETECTION_CASE_STUDY.md) for the actual implementation details.

## Overview

This document describes the OAuth/OIDC authentication architecture for the CloudEvents Player that works seamlessly in two deployment scenarios:

1. **Kubernetes with Istio** - JWT injected by Istio (pre-authenticated)
2. **Local Development** - Direct Keycloak OAuth flow (user login required)

## Architecture Principles

### 1. Authentication Strategy Detection

The application uses a **header-based detection** strategy:

```
┌─────────────────────────────────────────────────────────────┐
│                     Incoming Request                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │ Check Authorization    │
          │ Header Present?        │
          └────────┬───────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌────────┐          ┌─────────────┐
   │  YES   │          │     NO      │
   └────┬───┘          └──────┬──────┘
        │                     │
        ▼                     ▼
┌───────────────┐    ┌──────────────────┐
│ Istio Mode    │    │  Keycloak Mode   │
│ (JWT Present) │    │  (Login Required)│
└───────┬───────┘    └────────┬─────────┘
        │                     │
        ▼                     ▼
┌───────────────┐    ┌──────────────────┐
│ Validate JWT  │    │ Redirect to      │
│ Extract user  │    │ Keycloak Login   │
└───────────────┘    └──────────────────┘
```

### 2. Component Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Frontend (UI)                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              auth.js (Auth Manager)                  │ │
│  │  • Detects auth mode (JWT present or login needed)  │ │
│  │  • Handles Keycloak OAuth flow                       │ │
│  │  • Manages token storage and refresh                 │ │
│  │  • Provides user info to UI                          │ │
│  └──────────────┬───────────────────────────────────────┘ │
│                 │                                          │
│  ┌──────────────┴───────────────────────────────────────┐ │
│  │           loginModal.html (UI Component)             │ │
│  │  • Login/Logout button                               │ │
│  │  • User profile display                              │ │
│  │  • Role badges (admin/operator/user)                 │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬───────────────────────────────────┘
                         │
                         │ HTTP Request + Authorization Header
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         auth.py (Authentication Module)              │ │
│  │  • JWT validation middleware                         │ │
│  │  • Keycloak public key verification                  │ │
│  │  • User/role extraction from JWT                     │ │
│  │  • Optional auth dependency injection                │ │
│  └──────────────┬───────────────────────────────────────┘ │
│                 │                                          │
│  ┌──────────────┴───────────────────────────────────────┐ │
│  │       Protected Routes (routes.py)                   │ │
│  │  • Inject auth dependency where needed               │ │
│  │  • Role-based access control                         │ │
│  │  • Audit logging with user context                   │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬───────────────────────────────────┘
                         │
                         │ Token Validation
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                   Keycloak (Optional)                      │
│  • OIDC Provider (local dev only)                          │
│  • JWT issuer and validator                                │
│  • User/role management                                    │
│  • Token endpoint: /realms/events-player/protocol/...     │
└────────────────────────────────────────────────────────────┘
```

## Deployment Scenarios

### Scenario 1: Kubernetes with Istio

**Flow:**

1. User → Istio Ingress Gateway
2. Istio enforces authentication (OAuth with external IdP)
3. Istio injects JWT in `Authorization: Bearer <token>` header
4. Request → CloudEvents Player API
5. API validates JWT signature using Istio's public key/JWKS
6. API extracts user info and roles from JWT claims
7. UI detects JWT presence → No login modal shown
8. UI displays user info from JWT claims

**Configuration:**

```yaml
# Environment Variables
AUTH_MODE: auto # Auto-detect based on header presence
AUTH_JWKS_URL: "" # Use Istio's JWKS endpoint
AUTH_ISSUER: "" # Istio's issuer URL
AUTH_AUDIENCE: "" # Expected audience claim
AUTH_REQUIRED: false # Optional auth (public access allowed)
```

**JWT Claims Expected:**

```json
{
  "iss": "https://istio.cluster.local",
  "sub": "user@example.com",
  "aud": "cloudevents-player",
  "exp": 1234567890,
  "iat": 1234567890,
  "email": "user@example.com",
  "groups": ["admin", "operator"],
  "preferred_username": "user"
}
```

### Scenario 2: Local Development (Keycloak)

**Flow:**

1. User → CloudEvents Player UI (no JWT)
2. UI detects no Authorization header → Shows login button
3. User clicks login → OAuth redirect to Keycloak
4. User authenticates with Keycloak
5. Keycloak redirects back with authorization code
6. UI exchanges code for JWT access token
7. UI stores token in sessionStorage
8. UI adds `Authorization: Bearer <token>` to all API calls
9. API validates JWT using Keycloak's public key/JWKS
10. UI shows logout button and user profile

**Configuration:**

```yaml
# Environment Variables
AUTH_MODE: auto # Auto-detect
AUTH_JWKS_URL: http://localhost:8090/realms/events-player/protocol/openid-connect/certs
AUTH_ISSUER: http://localhost:8090/realms/events-player
AUTH_AUDIENCE: events-player-web
AUTH_REQUIRED: false # Optional auth

# Frontend (injected via HTML template)
KEYCLOAK_URL: http://localhost:8090
KEYCLOAK_REALM: events-player
KEYCLOAK_CLIENT_ID: events-player-web
```

**JWT Claims Expected:**

```json
{
  "iss": "http://localhost:8090/realms/events-player",
  "sub": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "aud": "events-player-web",
  "exp": 1234567890,
  "iat": 1234567890,
  "email": "admin@events-player.local",
  "realm_roles": ["admin", "operator"],
  "preferred_username": "admin",
  "given_name": "Admin",
  "family_name": "User"
}
```

## Security Features

### 1. JWT Validation

- **Signature verification** using public keys from JWKS endpoint
- **Expiration check** (`exp` claim)
- **Issuer validation** (`iss` claim matches expected issuer)
- **Audience validation** (`aud` claim matches expected audience)
- **Not-before check** (`nbf` claim if present)

### 2. Token Storage

- **SessionStorage** (not localStorage) - cleared on browser close
- **No cookies** - CSRF not applicable
- **Token not logged** - sensitive data protection

### 3. Authorization

- **Role-based access control** (RBAC)
  - `admin`: Full access (CRUD operations)
  - `operator`: Read/write access (no admin functions)
  - `user`: Read-only access
- **Optional authentication** - public endpoints still accessible
- **Graceful degradation** - UI shows limited features without auth

### 4. CORS Configuration

```python
# Allow both Kubernetes and local origins
allowed_origins = [
    "http://localhost:8884",
    "http://localhost:1234",
    "https://*.cluster.local",  # Kubernetes internal
    # Add production domains in production config
]
```

## API Design

### Authentication Middleware

```python
# Optional authentication - doesn't block requests
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Extract and validate JWT if present"""
    auth_header = request.headers.get("authorization")

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            user_info = await validate_jwt(token)
            request.state.user = user_info
        except InvalidTokenError:
            # Invalid token - continue without user
            request.state.user = None
    else:
        request.state.user = None

    response = await call_next(request)
    return response
```

### Dependency Injection

```python
# Optional auth - returns None if not authenticated
async def get_current_user_optional(request: Request) -> Optional[Dict]:
    return getattr(request.state, "user", None)

# Required auth - raises 401 if not authenticated
async def get_current_user_required(
    user: Optional[Dict] = Depends(get_current_user_optional)
) -> Dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

# Admin only - raises 403 if not admin role
async def require_admin(
    user: Dict = Depends(get_current_user_required)
) -> Dict:
    if "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

### Protected Endpoints

```python
# Public endpoint - no auth required
@router.get("/api/health")
async def health():
    return {"status": "healthy"}

# Optional auth - enhanced response if authenticated
@router.get("/api/events")
async def list_events(user: Optional[Dict] = Depends(get_current_user_optional)):
    events = get_all_events()
    if user:
        # Include private events for authenticated users
        events.extend(get_private_events())
    return events

# Required auth - must be authenticated
@router.post("/api/events")
async def create_event(
    event: Event,
    user: Dict = Depends(get_current_user_required)
):
    # Audit log with user context
    logger.info(f"Event created by {user['username']}")
    return create_event_internal(event)

# Admin only endpoint
@router.delete("/api/events/{event_id}")
async def delete_event(
    event_id: str,
    user: Dict = Depends(require_admin)
):
    logger.info(f"Event {event_id} deleted by admin {user['username']}")
    return delete_event_internal(event_id)
```

## Frontend Implementation

### Auth Manager (auth.js)

```javascript
class AuthManager {
  constructor() {
    this.token = null;
    this.userInfo = null;
    this.keycloakConfig = null;
    this.mode = null; // 'istio' or 'keycloak' or 'none'
  }

  async init() {
    // 1. Check for existing JWT in session
    this.token = sessionStorage.getItem("access_token");

    if (this.token) {
      // Validate token and get user info
      this.userInfo = await this.validateToken(this.token);
      if (this.userInfo) {
        this.mode = "authenticated";
        return;
      }
    }

    // 2. Check if we're in Istio mode (JWT in response headers)
    try {
      const response = await fetch("/api/auth/info");
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          // Istio injected JWT - server already validated it
          this.userInfo = data.user;
          this.mode = "istio";
          return;
        }
      }
    } catch (error) {
      console.warn("Failed to check auth info:", error);
    }

    // 3. Check if Keycloak is configured
    const keycloakUrl = document.body.dataset.keycloakUrl;
    if (keycloakUrl) {
      this.keycloakConfig = {
        url: keycloakUrl,
        realm: document.body.dataset.keycloakRealm,
        clientId: document.body.dataset.keycloakClientId,
      };
      this.mode = "keycloak";

      // Check for OAuth callback
      await this.handleOAuthCallback();
    } else {
      this.mode = "none";
    }
  }

  async login() {
    if (this.mode !== "keycloak") {
      console.warn("Login not available in current mode:", this.mode);
      return;
    }

    const state = this.generateRandomState();
    sessionStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
      client_id: this.keycloakConfig.clientId,
      response_type: "code",
      redirect_uri: window.location.origin + "/oauth/callback",
      state: state,
      scope: "openid profile email",
    });

    const authUrl = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/auth?${params}`;
    window.location.href = authUrl;
  }

  async handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    if (!code) return;

    // Validate state
    const savedState = sessionStorage.getItem("oauth_state");
    if (state !== savedState) {
      console.error("OAuth state mismatch");
      return;
    }

    // Exchange code for token
    try {
      const response = await fetch("/api/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirect_uri: window.location.origin + "/oauth/callback",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.access_token;
        sessionStorage.setItem("access_token", this.token);
        this.userInfo = data.user_info;

        // Clean up URL
        window.history.replaceState({}, document.title, "/");
      }
    } catch (error) {
      console.error("Token exchange failed:", error);
    }
  }

  logout() {
    this.token = null;
    this.userInfo = null;
    sessionStorage.removeItem("access_token");

    if (this.mode === "keycloak") {
      const logoutUrl = `${this.keycloakConfig.url}/realms/${
        this.keycloakConfig.realm
      }/protocol/openid-connect/logout?redirect_uri=${encodeURIComponent(
        window.location.origin
      )}`;
      window.location.href = logoutUrl;
    } else {
      window.location.reload();
    }
  }

  getAuthHeaders() {
    if (this.token) {
      return { Authorization: `Bearer ${this.token}` };
    }
    return {};
  }
}

export const authManager = new AuthManager();
```

### UI Components

**Login Modal (loginModal.html):**

```html
<div id="authContainer" class="d-none">
  <!-- Not authenticated -->
  <div id="loginButton" class="d-none">
    <button class="btn btn-primary" onclick="authManager.login()">
      <i class="bi bi-box-arrow-in-right"></i> Login
    </button>
  </div>

  <!-- Authenticated -->
  <div id="userInfo" class="d-none">
    <div class="dropdown">
      <button
        class="btn btn-outline-secondary dropdown-toggle"
        data-bs-toggle="dropdown"
      >
        <i class="bi bi-person-circle"></i>
        <span id="userName"></span>
        <span id="userRoles" class="badges"></span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><span class="dropdown-item-text" id="userEmail"></span></li>
        <li><hr class="dropdown-divider" /></li>
        <li>
          <a class="dropdown-item" href="#" onclick="authManager.logout()">
            <i class="bi bi-box-arrow-right"></i> Logout
          </a>
        </li>
      </ul>
    </div>
  </div>
</div>
```

## Configuration Management

### Environment Variables (Backend)

| Variable                 | Description                               | Default | Example                                                                    |
| ------------------------ | ----------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `AUTH_MODE`              | Auth mode: `auto`, `required`, `disabled` | `auto`  | `auto`                                                                     |
| `AUTH_JWKS_URL`          | JWKS endpoint for JWT validation          | `""`    | `http://localhost:8090/realms/events-player/protocol/openid-connect/certs` |
| `AUTH_ISSUER`            | Expected JWT issuer                       | `""`    | `http://localhost:8090/realms/events-player`                               |
| `AUTH_AUDIENCE`          | Expected JWT audience                     | `""`    | `events-player-web`                                                        |
| `AUTH_REQUIRED`          | Require auth for all endpoints            | `false` | `false`                                                                    |
| `AUTH_ALGORITHM`         | JWT signature algorithm                   | `RS256` | `RS256`                                                                    |
| `KEYCLOAK_URL`           | Keycloak base URL (for token exchange)    | `""`    | `http://localhost:8090`                                                    |
| `KEYCLOAK_REALM`         | Keycloak realm                            | `""`    | `events-player`                                                            |
| `KEYCLOAK_CLIENT_ID`     | Keycloak client ID                        | `""`    | `events-player-api`                                                        |
| `KEYCLOAK_CLIENT_SECRET` | Keycloak client secret                    | `""`    | `events-player-api-secret`                                                 |

### HTML Template Variables (Frontend)

Injected via Jinja2 templates in `index.html`:

```html
<body
  data-keycloak-url="{{ keycloak_url }}"
  data-keycloak-realm="{{ keycloak_realm }}"
  data-keycloak-client-id="{{ keycloak_client_id }}"
  data-auth-mode="{{ auth_mode }}"
></body>
```

## Implementation Phases

### Phase 1: Backend Authentication Module ✅

1. Create `src/api/auth.py` with JWT validation
2. Add authentication middleware
3. Create dependency injection functions
4. Add `/api/auth/info` endpoint (check current auth status)
5. Add `/api/auth/callback` endpoint (OAuth code exchange)
6. Update `settings.py` with auth configuration
7. Install required packages: `python-jose[cryptography]`, `httpx`

### Phase 2: Frontend Authentication Manager ✅

1. Create `src/ui/js/auth/auth.js` with AuthManager class
2. Implement OAuth PKCE flow for Keycloak
3. Add token storage and refresh logic
4. Create login/logout UI components
5. Update `app.js` to initialize AuthManager

### Phase 3: Protected Endpoints 🔄

1. Add optional auth to existing endpoints
2. Create admin-only endpoints
3. Add audit logging with user context
4. Update OpenAPI docs with security schemes

### Phase 4: UI Integration 📋

1. Show/hide features based on auth status
2. Display user info and roles
3. Add role-based UI elements
4. Graceful degradation for unauthenticated users

### Phase 5: Testing & Documentation 📋

1. Unit tests for JWT validation
2. Integration tests for OAuth flow
3. E2E tests for both modes (Istio + Keycloak)
4. Update README with auth setup instructions

## Testing Strategy

### Unit Tests

- JWT signature validation
- Token expiration checking
- Role extraction from claims
- JWKS key caching

### Integration Tests

- OAuth code exchange flow
- Token refresh flow
- Protected endpoint access
- Role-based authorization

### E2E Tests

- **Istio Mode**: Mock JWT injection, verify UI behavior
- **Keycloak Mode**: Full OAuth flow with real Keycloak instance
- **No Auth Mode**: Verify public access still works

## Monitoring & Logging

### Metrics

- Authentication success/failure rates
- Token validation duration
- OAuth flow completion rate
- Protected endpoint access patterns

### Audit Logs

```json
{
  "timestamp": "2025-10-25T10:30:00Z",
  "action": "event.create",
  "user": "admin@events-player.local",
  "roles": ["admin"],
  "ip": "10.0.0.1",
  "request_id": "a1b2c3d4-5678-90ab-cdef",
  "outcome": "success"
}
```

## Security Considerations

1. **Never log tokens** - Sensitive data leak prevention
2. **Short token lifespan** - 5 minutes access token, 30 days refresh token
3. **HTTPS only in production** - Token interception prevention
4. **CORS whitelist** - XSS attack prevention
5. **Rate limiting** - Brute force prevention on auth endpoints
6. **Token rotation** - Refresh tokens invalidated after use
7. **Secure storage** - SessionStorage (not localStorage)
8. **PKCE flow** - Authorization code interception prevention

## Migration Path

### Existing Deployments

1. **Add auth configuration** to environment variables
2. **Auth is optional by default** - no breaking changes
3. **Gradual rollout**: Enable auth per environment
4. **Backward compatible**: Works with and without JWT

### Rollout Strategy

1. **Development**: Test with local Keycloak
2. **Staging**: Test with Istio JWT injection
3. **Production**: Enable required auth after validation

## Future Enhancements

- [ ] Token refresh automation
- [ ] Multi-tenancy support (organization-based isolation)
- [ ] Fine-grained permissions (beyond role-based)
- [ ] OAuth device flow (CLI access)
- [ ] API key authentication (service accounts)
- [ ] SAML support (enterprise SSO)
- [ ] Session management (active sessions view)
- [ ] Two-factor authentication (MFA)
