# OAuth Implementation Guide

## Quick Start

This guide provides step-by-step instructions to implement OAuth authentication for the CloudEvents Player.

## Prerequisites

- Python 3.10+
- Node.js 20+
- Docker & Docker Compose
- Keycloak 22.0.5 (included in docker-compose.debug.yml)

## Implementation Steps

### Step 1: Install Backend Dependencies

Add required packages to `pyproject.toml`:

```bash
poetry add python-jose[cryptography] httpx python-multipart
```

**Packages:**

- `python-jose[cryptography]`: JWT validation and signature verification
- `httpx`: Async HTTP client for Keycloak token exchange
- `python-multipart`: Form data parsing for OAuth callbacks

### Step 2: Create Authentication Module

Create `src/api/auth.py`:

**File Structure:**

```
src/api/
├── auth.py          (NEW - Authentication logic)
├── app.py
├── routes.py
├── settings.py      (UPDATE - Add auth config)
└── ...
```

**Key Components:**

1. **JWT Validation**

   - Fetch JWKS from Keycloak/Istio
   - Verify JWT signature using RS256
   - Validate expiration, issuer, audience
   - Extract user claims (email, roles, username)

2. **Middleware**

   - Extract `Authorization` header
   - Validate JWT if present
   - Inject user info into `request.state.user`
   - Continue without user if no JWT (optional auth)

3. **Dependencies**

   - `get_current_user_optional()` - Returns user or None
   - `get_current_user_required()` - Returns user or 401
   - `require_admin()` - Returns user or 403
   - `require_operator()` - Returns user or 403

4. **OAuth Endpoints**
   - `GET /api/auth/info` - Current auth status
   - `POST /api/auth/callback` - OAuth code exchange
   - `POST /api/auth/refresh` - Token refresh (optional)

### Step 3: Update Settings

Update `src/api/settings.py`:

```python
class ApiSettings(BaseSettings):
    # ... existing settings ...

    # Authentication settings
    auth_mode: str = "auto"  # auto, required, disabled
    auth_jwks_url: str = ""
    auth_issuer: str = ""
    auth_audience: str = ""
    auth_required: bool = False
    auth_algorithm: str = "RS256"

    # Keycloak settings (for OAuth flow)
    keycloak_url: str = ""
    keycloak_realm: str = "events-player"
    keycloak_client_id: str = "events-player-web"
    keycloak_client_secret: str = "events-player-web-secret"
```

### Step 4: Update docker-compose.debug.yml

Add auth environment variables to event-player service:

```yaml
services:
  event-player:
    # ... existing config ...
    environment:
      # ... existing vars ...
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
      - keycloak # Add dependency
```

**Note:** Use `keycloak:8080` for internal Docker network, `localhost:8090` for browser URLs.

### Step 5: Integrate Middleware

Update `src/api/app.py`:

```python
from .auth import auth_middleware

# Add after request ID middleware
app.middleware("http")(auth_middleware)
```

### Step 6: Protect API Endpoints

Update `src/api/routes.py`:

**Public Endpoints (no changes needed):**

```python
@router.get("/api/health")
async def health():
    return {"status": "healthy"}
```

**Optional Auth (enhanced for authenticated users):**

```python
from .auth import get_current_user_optional

@router.get("/api/events")
async def list_events(
    user: Optional[Dict] = Depends(get_current_user_optional)
):
    # Return different data based on auth status
    pass
```

**Required Auth:**

```python
from .auth import get_current_user_required

@router.post("/api/events")
async def create_event(
    event: Event,
    user: Dict = Depends(get_current_user_required)
):
    logger.info(f"Event created by {user['email']}")
    # Only authenticated users can create
    pass
```

**Admin Only:**

```python
from .auth import require_admin

@router.delete("/api/events/{id}")
async def delete_event(
    id: str,
    user: Dict = Depends(require_admin)
):
    logger.info(f"Event deleted by admin {user['email']}")
    # Only admins can delete
    pass
```

### Step 7: Create Frontend Auth Manager

Create `src/ui/js/auth/auth.js`:

**File Structure:**

```
src/ui/js/
├── auth/
│   └── auth.js      (NEW - Auth manager)
├── app.js           (UPDATE - Initialize auth)
├── sse/
├── ui/
└── ux/
```

**Key Features:**

- Auto-detect auth mode (Istio JWT vs Keycloak OAuth)
- Handle OAuth PKCE flow
- Manage token storage (sessionStorage)
- Provide auth headers for API calls
- User info and role management

### Step 8: Create Login UI Component

Create `src/ui/html/loginModal.html`:

**Features:**

- Login button (when not authenticated)
- User dropdown (when authenticated)
  - Display name and email
  - Role badges (admin/operator/user)
  - Logout button

**Integration:**
Place in navigation bar (update `nav.html`):

```html
<nav class="navbar navbar-expand-lg">
  <!-- ... existing nav items ... -->

  <div id="authContainer"></div>
</nav>
```

### Step 9: Update Main App

Update `src/ui/js/app.js`:

```javascript
// Add at the top
import { authManager } from "./auth/auth";

// Initialize auth first
await authManager.init();

// Update all fetch calls to include auth headers
const response = await fetch("/api/events", {
  headers: {
    ...authManager.getAuthHeaders(),
    "Content-Type": "application/json",
  },
});
```

### Step 10: Update HTML Template

Update `src/ui/index.html` to inject auth config:

```html
<body
  data-browser_queue_size="{{ browser_queue_size }}"
  data-keycloak-url="{{ keycloak_url }}"
  data-keycloak-realm="{{ keycloak_realm }}"
  data-keycloak-client-id="{{ keycloak_client_id }}"
  data-auth-mode="{{ auth_mode }}"
></body>
```

### Step 11: Update Template Rendering

Update where `index.html` is rendered (likely in `routes.py`):

```python
from .settings import settings

@router.get("/", response_class=HTMLResponse)
async def index():
    with open("static/index.html") as f:
        html = f.read()

    # Inject auth config
    html = html.replace(
        '{{ keycloak_url }}',
        settings.keycloak_url or ''
    )
    html = html.replace(
        '{{ keycloak_realm }}',
        settings.keycloak_realm
    )
    html = html.replace(
        '{{ keycloak_client_id }}',
        settings.keycloak_client_id
    )
    html = html.replace(
        '{{ auth_mode }}',
        settings.auth_mode
    )

    return HTMLResponse(content=html)
```

**Or use Jinja2 templates** (recommended):

```python
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="static")

@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "keycloak_url": settings.keycloak_url,
        "keycloak_realm": settings.keycloak_realm,
        "keycloak_client_id": settings.keycloak_client_id,
        "auth_mode": settings.auth_mode,
        "browser_queue_size": settings.browser_queue_size
    })
```

### Step 12: Add OAuth Callback Route

Add to `src/ui/html/` directory:

Create `src/ui/html/oauth-callback.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>OAuth Callback</title>
  </head>
  <body>
    <script type="module">
      import { authManager } from "../js/auth/auth.js";

      // Handle OAuth callback
      await authManager.handleOAuthCallback();

      // Redirect to main app
      window.location.href = "/";
    </script>
  </body>
</html>
```

Or handle in main app.js with URL routing.

### Step 13: Update Package Build

Update `package.json` to include new files:

```json
{
  "scripts": {
    "start": "npm run copy && parcel serve src/ui/index.html src/ui/html/*.html --public-url /static/ --dist-dir static",
    "dev": "npm run copy && parcel serve src/ui/index.html src/ui/html/*.html --public-url /static/ --dist-dir static --hmr-port 1234",
    "build": "npm run copy && parcel build src/ui/index.html src/ui/html/*.html --public-url /static/ --dist-dir static"
  }
}
```

### Step 14: Test Setup

Create test file `tests/test_auth.py`:

**Test Cases:**

1. JWT validation with valid token
2. JWT validation with expired token
3. JWT validation with invalid signature
4. JWT validation with wrong issuer
5. OAuth code exchange flow
6. Protected endpoint without auth (401)
7. Protected endpoint with valid auth (200)
8. Admin endpoint without admin role (403)
9. Optional auth endpoint (works with and without token)

### Step 15: Start Services

```bash
# Build and start all services
docker-compose -f docker-compose.debug.yml up --build

# Or use Makefile
make docker-dev
```

**Services Started:**

- event-player: http://localhost:8884
- ui-builder: http://localhost:1234
- keycloak: http://localhost:8090

### Step 16: Test Authentication

**Test Keycloak Mode (Local Dev):**

1. Open http://localhost:8884
2. Should see "Login" button (no JWT present)
3. Click "Login"
4. Redirects to Keycloak login page
5. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
6. Redirects back to app
7. Should see user dropdown with:
   - Name: "Admin User"
   - Email: "admin@events-player.local"
   - Roles: [admin]
   - Logout button

**Test Istio Mode (Simulated):**

Add header to browser request (use browser extension):

```
Authorization: Bearer <valid-jwt-token>
```

App should:

1. Not show login button
2. Automatically show user info from JWT
3. Use JWT for all API calls

**Test API Protection:**

```bash
# Without auth - should fail (401)
curl -X POST http://localhost:8884/api/events \
  -H "Content-Type: application/json" \
  -d '{"type": "test"}'

# With auth - should succeed
curl -X POST http://localhost:8884/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"type": "test"}'

# Admin endpoint without admin role - should fail (403)
curl -X DELETE http://localhost:8884/api/events/123 \
  -H "Authorization: Bearer <operator-token>"
```

## Configuration Examples

### Local Development (Keycloak)

```bash
# .env file
api_auth_mode=auto
api_auth_jwks_url=http://localhost:8090/realms/events-player/protocol/openid-connect/certs
api_auth_issuer=http://localhost:8090/realms/events-player
api_auth_audience=events-player-web
api_auth_required=false
api_keycloak_url=http://localhost:8090
api_keycloak_realm=events-player
api_keycloak_client_id=events-player-api
api_keycloak_client_secret=events-player-api-secret
```

### Kubernetes with Istio

```yaml
# ConfigMap / Environment
AUTH_MODE: auto
AUTH_JWKS_URL: https://istio.cluster.local/jwks
AUTH_ISSUER: https://istio.cluster.local
AUTH_AUDIENCE: cloudevents-player
AUTH_REQUIRED: true # Enforce auth in production
KEYCLOAK_URL: "" # Empty - no OAuth flow needed
```

## Troubleshooting

### Issue: "Invalid token signature"

**Cause:** JWKS key mismatch or expired

**Solution:**

1. Check `AUTH_JWKS_URL` is accessible
2. Verify Keycloak is running
3. Check JWT issuer matches config
4. Try clearing JWKS cache

### Issue: "OAuth redirect loop"

**Cause:** State mismatch or session issue

**Solution:**

1. Clear sessionStorage
2. Check redirect URI matches Keycloak config
3. Verify `KEYCLOAK_URL` is correct

### Issue: "CORS error"

**Cause:** Origin not in CORS whitelist

**Solution:**
Add to `app.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8884", "http://localhost:1234"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: "Token expired"

**Cause:** Access token lifetime exceeded (5 minutes default)

**Solution:**

1. Implement token refresh flow
2. Redirect to login on 401
3. Increase token lifetime in Keycloak (dev only)

### Issue: "403 Forbidden - insufficient permissions"

**Cause:** User lacks required role

**Solution:**

1. Check user roles in Keycloak
2. Verify role mapping in JWT claims
3. Update role extraction logic in `auth.py`

## Security Checklist

- [ ] HTTPS enabled in production
- [ ] Token expiration checked
- [ ] JWT signature verified
- [ ] Issuer validation enabled
- [ ] Audience validation enabled
- [ ] Sensitive data not logged
- [ ] CORS properly configured
- [ ] Rate limiting on auth endpoints
- [ ] sessionStorage used (not localStorage)
- [ ] PKCE flow implemented
- [ ] State parameter validated
- [ ] Redirect URI validated
- [ ] Admin actions logged

## Next Steps

After implementing OAuth:

1. **Add Role-Based Features**

   - Show/hide UI elements based on roles
   - Admin panel for configuration
   - Operator tools for event management

2. **Implement Token Refresh**

   - Auto-refresh before expiration
   - Background token renewal
   - Logout on refresh failure

3. **Add Audit Logging**

   - Log all admin actions
   - Include user context in logs
   - Export logs to SIEM

4. **Performance Optimization**

   - Cache JWKS keys (5 min TTL)
   - Optimize JWT validation
   - Add auth metrics

5. **Documentation**
   - Update README with auth setup
   - Create user guide
   - Document API security

## File Checklist

New files to create:

- [ ] `src/api/auth.py` - Authentication logic
- [ ] `src/ui/js/auth/auth.js` - Frontend auth manager
- [ ] `src/ui/html/loginModal.html` - Login UI component
- [ ] `tests/test_auth.py` - Authentication tests

Files to update:

- [ ] `src/api/app.py` - Add auth middleware
- [ ] `src/api/routes.py` - Protect endpoints, add auth routes
- [ ] `src/api/settings.py` - Add auth config
- [ ] `src/ui/js/app.js` - Initialize auth, add headers
- [ ] `src/ui/index.html` - Add auth config data attributes
- [ ] `docker-compose.debug.yml` - Add auth environment variables
- [ ] `pyproject.toml` - Add auth dependencies
- [ ] `README.md` - Document auth setup

## Estimated Implementation Time

- **Phase 1** (Backend): 4-6 hours
- **Phase 2** (Frontend): 4-6 hours
- **Phase 3** (Protected Endpoints): 2-3 hours
- **Phase 4** (UI Integration): 2-3 hours
- **Phase 5** (Testing): 3-4 hours

**Total**: 15-22 hours

## Support

For questions or issues:

1. Check OAUTH_ARCHITECTURE.md for detailed design
2. Review Keycloak admin console logs
3. Check browser console for frontend errors
4. Review FastAPI logs for backend errors
5. Test with curl to isolate frontend/backend issues
