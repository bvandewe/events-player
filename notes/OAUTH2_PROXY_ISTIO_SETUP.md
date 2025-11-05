# OAuth2 Proxy + Istio Authentication Setup

## Overview

This document explains how the CloudEvents Player integrates with OAuth2 Proxy and Istio for authentication in production environments.

> **🔍 Critical Discovery:** The frontend determines authentication mode from **authentication state**, not from backend configuration! See [Mode Detection Case Study](MODE_DETECTION_CASE_STUDY.md) for the full story. This resilient design means the system works even with minimal backend configuration.

## Architecture

### High-Level Flow

```
Browser Request
     ↓
OAuth2 Proxy (Authentication Layer)
  - Manages OAuth flow with Keycloak
  - Stores tokens in encrypted cookie
  - Injects JWT into request headers
     ↓
Istio Service Mesh (Optional)
  - Routes traffic
  - May validate JWTs (RequestAuthentication)
  - Enforces policies
     ↓
CloudEvents Player Backend
  - Extracts JWT from headers
  - Validates user and roles
  - Enforces RBAC
     ↓
Response with user info
```

### Why Browser Never Sees JWT

**OAuth2 Proxy manages tokens server-side:**

```
1. User logs in → Keycloak returns tokens
2. OAuth2 Proxy stores tokens in encrypted cookie: _oauth2_proxy_mozart=...
3. For each request:
   Browser sends: Cookie: _oauth2_proxy_mozart=...
   OAuth2 Proxy adds: Authorization: Bearer eyJhbG... (JWT)
4. Backend receives JWT in Authorization header
5. Browser never sees the actual JWT token!
```

**Benefits of this approach:**

- ✅ JWT never exposed to JavaScript (XSS protection)
- ✅ All token management server-side
- ✅ No token refresh logic needed in frontend
- ✅ Simpler frontend code

## Authentication Flow Details

### 1. Initial Login (OAuth2 Proxy Handles This)

```
1. User visits: https://events.expert.certs.cloud/
2. No auth cookie → OAuth2 Proxy redirects to Keycloak
3. User logs into Keycloak
4. Keycloak redirects back with authorization code
5. OAuth2 Proxy exchanges code for tokens (access + refresh)
6. OAuth2 Proxy stores tokens in encrypted cookie
7. OAuth2 Proxy redirects user to original URL
```

**Frontend never sees this!** The OAuth flow happens entirely between OAuth2 Proxy and Keycloak.

### 2. Authenticated Requests

**Browser Request:**

```http
GET / HTTP/1.1
Host: events.expert.certs.cloud
Cookie: _oauth2_proxy_mozart=X29hdXRoMl9wcm94eV9tb3phcnQtNjNjYjA...
```

**OAuth2 Proxy adds JWT (server-side):**

```http
GET / HTTP/1.1
Host: backend-service:8080
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Cookie: _oauth2_proxy_mozart=X29hdXRoMl9wcm94eV9tb3phcnQtNjNjYjA...
```

**Backend receives:**

- Full JWT in `Authorization` header
- Can validate and extract user info

### 3. Backend Token Extraction

The backend middleware checks multiple sources for JWT tokens:

```python
# src/api/auth.py - auth_middleware()

# 1. Standard OAuth (for API calls from frontend)
Authorization: Bearer <token>

# 2. OAuth2 Proxy (for browser requests)
X-Auth-Request-Access-Token: <token>

# 3. Alternative proxy header
X-Forwarded-Access-Token: <token>
```

**In your production setup:** OAuth2 Proxy injects JWT in standard `Authorization` header.

### 4. Frontend Mode Detection

**CRITICAL:** The frontend determines mode from **authentication state**, NOT from backend's `mode` field!

```javascript
// src/ui/js/auth/auth.js - init()

const response = await fetch('/api/auth/info');
const data = await response.json();

if (data.authenticated) {
    // User authenticated → Frontend INDEPENDENTLY decides mode
    console.log('[Auth] Istio mode detected, user pre-authenticated:', data.user.username);
    this.userInfo = data.user;
    this.mode = 'istio';  // ← Frontend sets mode itself!
    this.renderAuthUI();
    return;
}

// Not authenticated? Check for OAuth config
if (data.oauth_config && data.oauth_config.url) {
    this.oauthConfig = data.oauth_config;
    this.mode = 'oauth';  // ← Frontend handles OAuth flow
} else {
    this.mode = 'none';   // ← No authentication
}
```

**Backend response when authenticated:**

```json
{
  "authenticated": true,
  "auth_required": true,
  "user": {
    "user_id": "f63c8873-ebfe-4942-b893-3ffe0d7aefb7",
    "email": "root@mozart.org",
    "username": "root@mozart.org",
    "full_name": "Root Mozart",
    "roles": ["admin", "operator", "epm-manager", ...],
    "groups": ["/admins"]
  },
  "mode": "istio",  // ← Informational only, NOT used by frontend!
  "role_mappings": {
    "admin": "admin",
    "operator": "epm-manager",
    "user": "default-roles-mozart"
  }
}
```

**Key Insight:** The `mode` field from backend is **informational only**. Frontend makes its own decision:

- `authenticated: true` → mode = `'istio'` (someone else handled auth)
- `authenticated: false` + `oauth_config` present → mode = `'oauth'` (we handle auth)
- Neither → mode = `'none'`

This design makes the system resilient to backend configuration issues!

## Istio Mode vs OAuth Mode

### Istio Mode (Your Production Setup)

**Characteristics:**

- OAuth2 Proxy handles authentication
- JWT managed server-side
- Frontend has **no token** (only userInfo)
- Authentication detected via `/api/auth/info` response

**Environment Variables:**

```bash
AUTH_REQUIRED=true
AUTH_JWKS_URL=https://keycloak.example.com/.../certs
AUTH_TRUST_MODE=true  # Skip verification (OAuth2 Proxy already validated)
# OAUTH_SERVER_URL is NOT set!
```

**Frontend Detection:**

```javascript
isAuthenticated() {
    if (this.mode === 'istio') {
        return this.userInfo !== null;  // Check userInfo, not token!
    }
    // ... OAuth mode checks token
}
```

### OAuth Mode (Local Development)

**Characteristics:**

- Frontend handles OAuth flow directly
- JWT stored in browser sessionStorage
- Frontend manages token refresh
- No proxy layer

**Environment Variables:**

```bash
AUTH_REQUIRED=true
OAUTH_SERVER_URL=http://localhost:8090
OAUTH_REALM=events-player
OAUTH_CLIENT_ID=events-player-client
```

**Frontend Detection:**

```javascript
isAuthenticated() {
    if (this.mode === 'oauth') {
        return this.token !== null && !isExpired();
    }
}
```

## Token Structure

### Keycloak JWT Claims

Your production tokens contain:

```json
{
  "exp": 1730851728,
  "iat": 1730851428,
  "jti": "d7e5f6a8-1234-5678-90ab-cdef12345678",
  "iss": "https://keycloak.expert.certs.cloud/realms/mozart",
  "aud": ["istio-oauth2-proxy"],
  "sub": "f63c8873-ebfe-4942-b893-3ffe0d7aefb7",
  "typ": "Bearer",
  "azp": "istio-oauth2-proxy",
  "email_verified": true,
  "name": "Root Mozart",
  "preferred_username": "root@mozart.org",
  "given_name": "Root",
  "family_name": "Mozart",
  "email": "root@mozart.org",
  
  "roles": [                          ← Priority: Checked BEFORE groups
    "default-roles-mozart",
    "epm",
    "offline_access",
    "admin",                          ← Application role
    "sme",
    "uma_authorization",
    "proctor",
    "epm-manager"                     ← Application role (operator)
  ],
  
  "groups": ["/admins"]               ← Keycloak group path (fallback)
}
```

### Role Extraction Priority

The backend checks claims in this order:

```python
# src/api/auth.py - extract_user_info()

1. realm_roles           # Keycloak realm roles (if present)
2. realm_access.roles    # Keycloak realm access (if present)
3. roles                 # Generic roles claim ← YOUR PRODUCTION USES THIS
4. groups                # Keycloak groups (fallback, contains paths like /admins)
```

**Why this order matters:**

- `roles` claim contains actual application roles: `["admin", "epm-manager"]`
- `groups` claim contains organizational paths: `["/admins"]`
- We want roles, not group paths!

## Role Mapping Configuration

### Backend Role Mapping

Map JWT token roles to application roles:

```bash
# Environment variables
API_AUTH_ROLE_ADMIN=admin           # Maps to "admin" role in JWT
API_AUTH_ROLE_OPERATOR=epm-manager  # Maps to "epm-manager" role in JWT
API_AUTH_ROLE_USER=default-roles-mozart
```

### Frontend Authorization

The frontend receives role mappings from backend:

```javascript
// From /api/auth/info response
{
  "role_mappings": {
    "admin": "admin",
    "operator": "epm-manager",
    "user": "default-roles-mozart"
  }
}

// Authorization checks
authorizationManager.isAdmin()     // Checks if user has "admin" role
authorizationManager.isOperator()  // Checks if user has "epm-manager" OR "admin"
```

## Keycloak Client Configuration

### OAuth2 Proxy Client (`istio-oauth2-proxy`)

**Client Settings:**

- Client ID: `istio-oauth2-proxy`
- Client Protocol: `openid-connect`
- Access Type: `confidential` (has client secret)
- Valid Redirect URIs: `https://events.expert.certs.cloud/oauth2/callback`
- Web Origins: `https://events.expert.certs.cloud`

**Protocol Mappers:**

1. **Roles Mapper**
   - Mapper Type: `User Realm Role`
   - Token Claim Name: `roles`
   - Claim JSON Type: `String`
   - Add to access token: Yes

2. **Groups Mapper**
   - Mapper Type: `Group Membership`
   - Token Claim Name: `groups`
   - Full group path: Yes
   - Add to access token: Yes

3. **Audience Mapper**
   - Mapper Type: `Audience`
   - Included Client Audience: `istio-oauth2-proxy`
   - Add to access token: Yes

## Trust Mode (AUTH_TRUST_MODE)

When `AUTH_TRUST_MODE=true`, the backend skips JWT verification:

```python
# src/api/auth.py - validate_token()

if settings.auth_trust_mode:
    # Skip all verification checks:
    # - Signature verification (no JWKS lookup)
    # - Issuer validation
    # - Audience validation
    # - at_hash validation (OpenID Connect)
    
    payload = jwt.decode(token, "", options={
        "verify_signature": False,
        "verify_exp": False,
        "verify_nbf": False,
        "verify_iat": False,
        "verify_aud": False,
        "verify_iss": False,
        "verify_at_hash": False
    })
    
    return payload  # Just decode and extract claims
```

**⚠️ Security Warning:**
Only use Trust Mode when:

- OAuth2 Proxy has already validated the JWT
- OR Istio RequestAuthentication has validated the JWT
- The network between proxy and backend is trusted

**Why it's safe in your setup:**

- OAuth2 Proxy validates tokens against Keycloak
- Backend only decodes to extract user info
- RBAC still enforced based on roles

## Troubleshooting

### Issue: User Authenticated on Backend but UI Shows Unauthenticated

**Symptoms:**

- Backend logs show: `✓ Roles extracted from 'roles': ['admin', ...]`
- Frontend logs show: `[Auth] token exists: false`, `isAuthenticated(): false`
- UI doesn't show admin features

**Root Cause:**
Frontend's `isAuthenticated()` was checking for token in sessionStorage, but in Istio mode there is no token (managed server-side).

**Solution (v0.4.9):**

```javascript
isAuthenticated() {
    // In Istio mode, check userInfo instead of token
    if (this.mode === 'istio') {
        return this.userInfo !== null;
    }
    
    // In OAuth mode, check token
    if (!this.token || !this.userInfo) {
        return false;
    }
    // ... check expiration
}
```

### Issue: Backend Not Finding JWT Token

**Symptoms:**

- Backend logs: `Request authenticated: 0 role(s)` or no auth logs
- Frontend receives: `authenticated: false`

**Possible Causes:**

1. **OAuth2 Proxy not injecting JWT**
   - Check OAuth2 Proxy configuration
   - Verify `--set-authorization-header=true` flag

2. **Wrong header name**
   - Backend checks: `Authorization`, `X-Auth-Request-Access-Token`, `X-Forwarded-Access-Token`
   - Add custom header to middleware if needed

3. **Trust mode not enabled**
   - Backend trying to verify JWT signature
   - Enable `AUTH_TRUST_MODE=true`

### Issue: Wrong Roles Extracted (Groups Instead of Roles)

**Symptoms:**

- Backend logs: `✓ Roles extracted from 'groups': ['/admins']`
- Should extract from `'roles'` claim

**Root Cause (Fixed in v0.4.8):**
Backend was checking `groups` before `roles` claim.

**Solution:**
Priority changed to: `realm_roles` → `realm_access.roles` → **`roles`** → `groups`

## Version History

### v0.4.9 - Frontend Istio Authentication Detection

- Fixed `isAuthenticated()` for Istio mode (check userInfo, not token)
- UI now correctly detects authenticated users in proxy-based auth

### v0.4.8 - Backend OAuth2 Proxy Support

- Added OAuth2 Proxy JWT header extraction
- Fixed role extraction priority (roles before groups)
- Added role mapping configuration support

### v0.4.7 - Security & Trust Mode

- Removed sensitive PII from logs
- Added `verify_at_hash=False` for OpenID Connect tokens

### v0.4.5 - Trust Mode Feature

- Added `AUTH_TRUST_MODE` for Istio/service mesh deployments
- Skip JWT verification when proxy has already validated

## References

- [OAuth2 Proxy Documentation](https://oauth2-proxy.github.io/oauth2-proxy/)
- [Istio RequestAuthentication](https://istio.io/latest/docs/reference/config/security/request_authentication/)
- [Keycloak Protocol Mappers](https://www.keycloak.org/docs/latest/server_admin/#_protocol-mappers)
- [OpenID Connect Core Specification](https://openid.net/specs/openid-connect-core-1_0.html)

## Summary

**Key Takeaways:**

1. **OAuth2 Proxy manages all tokens** - Frontend never sees JWT
2. **Backend extracts JWT from headers** - Added by OAuth2 Proxy
3. **Frontend detects mode via `/api/auth/info`** - Checks `authenticated` flag
4. **Istio mode uses `userInfo`, not `token`** - Different from OAuth mode
5. **Role extraction order matters** - `roles` before `groups` claim
6. **Trust mode skips verification** - Safe when proxy validates upstream

This architecture provides:

- ✅ Enhanced security (no token in browser)
- ✅ Simplified frontend (no OAuth flow)
- ✅ Flexible deployment (works with or without Istio)
- ✅ Proper RBAC enforcement
