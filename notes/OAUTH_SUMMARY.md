# OAuth Implementation Summary

## What You Have Now

✅ **Keycloak Service** - Running on port 8090 with:

- Realm: `events-player`
- Roles: `admin`, `operator`, `user`
- Test users: admin/admin123, operator/operator123, user/user123
- Client: `events-player-web` (frontend)
- Client: `events-player-api` (backend)

✅ **Architecture Documentation** - See `OAUTH_ARCHITECTURE.md`:

- Hybrid authentication strategy (Istio + Keycloak)
- Security design and best practices
- Detailed flow diagrams
- Configuration examples

✅ **Implementation Guide** - See `OAUTH_IMPLEMENTATION_GUIDE.md`:

- Step-by-step instructions
- Code examples for all components
- Testing procedures
- Troubleshooting guide

## What Needs to Be Built

### Backend (Python/FastAPI)

#### 1. Authentication Module (`src/api/auth.py`)

```python
# Key Components:
class JWTValidator:
    - fetch_jwks()           # Get public keys from Keycloak/Istio
    - validate_token()       # Verify JWT signature and claims
    - extract_user_info()    # Get email, roles, username from JWT

async def auth_middleware(request, call_next):
    # Extract and validate Authorization header
    # Inject user into request.state.user
    # Continue without blocking if no auth

# Dependency injection
async def get_current_user_optional() -> Optional[Dict]
async def get_current_user_required() -> Dict  # Raises 401
async def require_admin() -> Dict               # Raises 403
async def require_operator() -> Dict            # Raises 403
```

**New Dependencies:**

```bash
poetry add python-jose[cryptography] httpx python-multipart
```

#### 2. Settings Update (`src/api/settings.py`)

```python
class ApiSettings:
    # Add these fields:
    auth_mode: str = "auto"
    auth_jwks_url: str = ""
    auth_issuer: str = ""
    auth_audience: str = ""
    auth_required: bool = False
    keycloak_url: str = ""
    keycloak_realm: str = "events-player"
    keycloak_client_id: str = ""
    keycloak_client_secret: str = ""
```

#### 3. App Integration (`src/api/app.py`)

```python
from .auth import auth_middleware

# Add middleware (after request ID middleware)
app.middleware("http")(auth_middleware)

# Add CORS if not present
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8884", "http://localhost:1234"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 4. Protected Routes (`src/api/routes.py`)

```python
from .auth import get_current_user_optional, get_current_user_required, require_admin

# Add auth endpoints:
@router.get("/api/auth/info")
async def auth_info(user: Optional[Dict] = Depends(get_current_user_optional)):
    # Return current auth status and user info

@router.post("/api/auth/callback")
async def oauth_callback(code: str, redirect_uri: str):
    # Exchange OAuth code for token
    # Return access_token and user_info

# Update existing endpoints:
@router.post("/api/events")
async def create_event(
    event: Event,
    user: Dict = Depends(get_current_user_required)  # Add this
):
    logger.info(f"Event created by {user['email']}")
    # ... existing logic

@router.delete("/api/events/{id}")
async def delete_event(
    id: str,
    user: Dict = Depends(require_admin)  # Add this
):
    # Only admins can delete
```

### Frontend (JavaScript)

#### 1. Auth Manager (`src/ui/js/auth/auth.js`)

```javascript
export class AuthManager {
  constructor() {
    this.token = null;
    this.userInfo = null;
    this.mode = null; // 'istio' | 'keycloak' | 'none'
  }

  async init() {
    // 1. Check sessionStorage for token
    // 2. Check if server already has JWT (Istio mode)
    // 3. Check if Keycloak is configured
    // 4. Handle OAuth callback if present
  }

  async login() {
    // Redirect to Keycloak login
  }

  async logout() {
    // Clear token, redirect to Keycloak logout
  }

  getAuthHeaders() {
    // Return { Authorization: 'Bearer <token>' }
  }

  async handleOAuthCallback() {
    // Extract code from URL
    // Exchange for token via /api/auth/callback
    // Store token in sessionStorage
  }

  async validateToken(token) {
    // Call /api/auth/info to validate
  }
}

export const authManager = new AuthManager();
```

#### 2. Login UI (`src/ui/html/loginModal.html`)

```html
<!-- Login button (when not authenticated) -->
<div id="loginButton" class="d-none">
  <button class="btn btn-primary" onclick="authManager.login()">
    <i class="bi bi-box-arrow-in-right"></i> Login
  </button>
</div>

<!-- User info (when authenticated) -->
<div id="userInfo" class="d-none">
  <div class="dropdown">
    <button class="btn btn-outline-secondary dropdown-toggle">
      <i class="bi bi-person-circle"></i>
      <span id="userName"></span>
      <span id="userRoles" class="badges"></span>
    </button>
    <ul class="dropdown-menu">
      <li><span id="userEmail"></span></li>
      <li><hr class="dropdown-divider" /></li>
      <li><a href="#" onclick="authManager.logout()">Logout</a></li>
    </ul>
  </div>
</div>
```

#### 3. App Integration (`src/ui/js/app.js`)

```javascript
import { authManager } from "./auth/auth";

// Initialize auth first
await authManager.init();

// Render auth UI
if (authManager.userInfo) {
  document.getElementById("userName").textContent = authManager.userInfo.name;
  document.getElementById("userEmail").textContent = authManager.userInfo.email;
  document.getElementById("userInfo").classList.remove("d-none");
} else if (authManager.mode === "keycloak") {
  document.getElementById("loginButton").classList.remove("d-none");
}

// Update all fetch calls to include auth headers
async function fetchWithAuth(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authManager.getAuthHeaders(),
    },
  });
}
```

#### 4. HTML Template (`src/ui/index.html`)

```html
<body
  data-browser_queue_size="{{ browser_queue_size }}"
  data-keycloak-url="{{ keycloak_url }}"
  data-keycloak-realm="{{ keycloak_realm }}"
  data-keycloak-client-id="{{ keycloak_client_id }}"
  data-auth-mode="{{ auth_mode }}"
>
  <nav class="navbar">
    <!-- Existing nav items -->
    <div id="authContainer"></div>
  </nav>

  <!-- Rest of page -->
</body>
```

### Configuration

#### docker-compose.debug.yml

```yaml
services:
  event-player:
    environment:
      # Add these variables:
      api_auth_mode: auto
      api_auth_jwks_url: http://keycloak:8080/realms/events-player/protocol/openid-connect/certs
      api_auth_issuer: http://localhost:8090/realms/events-player
      api_auth_audience: events-player-web
      api_auth_required: "false"
      api_keycloak_url: http://keycloak:8080
      api_keycloak_realm: events-player
      api_keycloak_client_id: events-player-api
      api_keycloak_client_secret: events-player-api-secret
    depends_on:
      - ui-builder
      - keycloak # Add this
```

## Implementation Workflow

### Phase 1: Backend (Estimated: 4-6 hours)

1. **Install dependencies:**

   ```bash
   poetry add python-jose[cryptography] httpx python-multipart
   ```

2. **Create `src/api/auth.py`:**

   - JWTValidator class
   - auth_middleware function
   - Dependency injection functions
   - OAuth callback handler

3. **Update `src/api/settings.py`:**

   - Add auth configuration fields

4. **Update `src/api/app.py`:**

   - Add auth_middleware
   - Add CORS middleware

5. **Update `src/api/routes.py`:**

   - Add `/api/auth/info` endpoint
   - Add `/api/auth/callback` endpoint
   - Protect existing endpoints with dependencies

6. **Test backend:**
   ```bash
   pytest tests/test_auth.py
   ```

### Phase 2: Frontend (Estimated: 4-6 hours)

1. **Create `src/ui/js/auth/auth.js`:**

   - AuthManager class
   - OAuth flow implementation
   - Token management

2. **Create `src/ui/html/loginModal.html`:**

   - Login button
   - User dropdown
   - Role badges

3. **Update `src/ui/js/app.js`:**

   - Initialize authManager
   - Render auth UI
   - Update fetch calls

4. **Update `src/ui/index.html`:**

   - Add data attributes for Keycloak config
   - Add auth container in nav

5. **Update build script:**
   - Ensure new files are included in Parcel build

### Phase 3: Integration & Testing (Estimated: 3-4 hours)

1. **Update docker-compose:**

   - Add auth environment variables
   - Add keycloak dependency

2. **Test Keycloak mode:**

   - Start services: `docker-compose -f docker-compose.debug.yml up`
   - Open http://localhost:8884
   - Click login, authenticate, verify user info displayed
   - Make API calls, verify JWT in request headers
   - Test logout

3. **Test Istio mode (simulated):**

   - Add JWT header manually with browser extension
   - Verify app uses existing JWT
   - Verify no login button shown

4. **Test protected endpoints:**

   ```bash
   # Without auth (should fail)
   curl -X POST http://localhost:8884/api/events

   # With auth (should succeed)
   curl -X POST http://localhost:8884/api/events \
     -H "Authorization: Bearer <token>"

   # Admin endpoint without admin role (should fail 403)
   curl -X DELETE http://localhost:8884/api/events/123 \
     -H "Authorization: Bearer <operator-token>"
   ```

## File Checklist

**New Files to Create:**

- [ ] `src/api/auth.py` (~300 lines)
- [ ] `src/ui/js/auth/auth.js` (~250 lines)
- [ ] `src/ui/html/loginModal.html` (~50 lines)
- [ ] `tests/test_auth.py` (~200 lines)

**Files to Update:**

- [ ] `src/api/app.py` (add middleware, ~10 lines)
- [ ] `src/api/settings.py` (add config, ~15 lines)
- [ ] `src/api/routes.py` (add endpoints + protect existing, ~100 lines)
- [ ] `src/ui/js/app.js` (initialize auth, ~30 lines)
- [ ] `src/ui/index.html` (add data attributes, ~5 lines)
- [ ] `docker-compose.debug.yml` (add env vars, ~10 lines)
- [ ] `pyproject.toml` (add dependencies, ~3 lines)
- [ ] `README.md` (document auth setup, ~50 lines)

## Quick Start

**Ready to implement? Start here:**

1. Read `OAUTH_ARCHITECTURE.md` for design overview
2. Follow `OAUTH_IMPLEMENTATION_GUIDE.md` step-by-step
3. Start with backend (Phase 1) - easier to test in isolation
4. Then frontend (Phase 2)
5. Finally integration testing (Phase 3)

**Estimated total time:** 15-22 hours for complete implementation

## Key Design Decisions

✅ **Optional authentication by default**

- Public access still works
- Graceful degradation
- No breaking changes to existing deployments

✅ **Auto-detect mode (Istio vs Keycloak)**

- Check for Authorization header first
- Fall back to OAuth login if needed
- Single codebase for both scenarios

✅ **SessionStorage for tokens**

- More secure than localStorage
- Cleared on browser close
- No XSS persistence

✅ **Role-based access control**

- admin: Full access
- operator: Read/write
- user: Read-only

✅ **Standard OAuth 2.0 + OIDC**

- PKCE flow for security
- JWT for stateless auth
- Industry best practices

## Next Actions

**Option 1: Implement yourself**

- Follow the implementation guide
- Reference architecture doc for design questions
- Test thoroughly with both modes

**Option 2: Request assistance**

- I can implement Phase 1 (backend) first
- Then Phase 2 (frontend)
- Then testing and integration

Which approach would you prefer?
