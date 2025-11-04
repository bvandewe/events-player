# JWT Key ID Mismatch Troubleshooting Guide

## Problem Description

Users see authentication errors with messages like:

```
No matching key found for kid: zqnZ3Uf2FtlrbBvmXGixliHXnZY4L9AHVePLx1qfJWk
Unable to find signing key for token
```

## Root Causes

### 1. **Key Rotation (Most Common)**

Keycloak periodically rotates signing keys for security. When this happens:

- Old keys are removed from JWKS
- New keys are added
- Tokens signed with old keys become invalid
- Cached tokens in browsers fail validation

**Timeline:**

- Keycloak rotates keys
- User's browser still has token signed with old key
- Server fetches new JWKS (without old key)
- Token validation fails

### 2. **Wrong Keycloak Instance/Realm**

Token was issued by a different Keycloak instance or realm than the one configured in the application.

**Check:**

```bash
# Token issuer (from JWT payload)
# Should match: https://keycloak.aws-k.certs.cloud/auth/realms/mozart

# JWKS URL being used by application
# Should be: https://keycloak.aws-k.certs.cloud/auth/realms/mozart/protocol/openid-connect/certs
```

### 3. **Browser Token Caching**

Browser has cached an old token (in localStorage, sessionStorage, or cookies) that's no longer valid.

### 4. **Expired Token After Key Rotation**

Token was issued before key rotation and is now trying to be validated against new keys.

### 5. **Istio/Service Mesh with Different Realm**

When running behind Istio or another service mesh, the JWT may be validated by the mesh layer using a different realm or issuer than what your application expects. The mesh injects the token, but it was issued for a different realm/audience.

**Typical scenario:**

- Istio validates JWT with realm A
- Your application expects JWT from realm B
- Token has valid signature but wrong issuer/kid

## Solutions

### Quick Fix: Enable Trust Mode (Istio/Service Mesh)

If you're running behind Istio or a service mesh that has already validated the JWT, you can skip signature verification:

```bash
# Set trust mode to skip signature/issuer validation
export AUTH_TRUST_MODE=true
export AUTH_REQUIRED=true

# Or in docker-compose.yml / Kubernetes deployment
environment:
  - AUTH_TRUST_MODE=true
  - AUTH_REQUIRED=true
```

⚠️ **Security Note**: Only enable trust mode when:

- Running behind Istio with RequestAuthentication policy configured
- Your proxy/mesh layer validates JWT signatures upstream
- You trust the proxy layer completely
- Tokens are from a different realm than your OAuth configuration

**What trust mode does:**

- ✅ Decodes JWT to extract user info
- ✅ Enforces RBAC based on roles in token
- ❌ Skips signature verification (no JWKS lookup)
- ❌ Skips issuer validation
- ❌ Skips audience validation

### For Users (Quick Fix)

1. **Force Re-login**

   ```javascript
   // Clear browser storage
   localStorage.clear();
   sessionStorage.clear();
   
   // Then refresh and log in again
   ```

2. **Hard Refresh Browser**
   - Chrome/Firefox: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Clear site data in browser DevTools

3. **Check Token Expiry**
   - Open browser DevTools → Application → Local Storage
   - Look for tokens and check their expiry time

### For Administrators

#### 1. Verify Keycloak Configuration

```bash
# Check JWKS endpoint is accessible
curl -s https://keycloak.aws-k.certs.cloud/auth/realms/mozart/protocol/openid-connect/certs | jq

# Should return JSON with "keys" array containing multiple keys
```

#### 2. Check Environment Variables

```bash
# In production deployment, verify these are set correctly:
OAUTH_BASE_URL=https://keycloak.aws-k.certs.cloud/auth
OAUTH_BASE_URL_BACKEND=https://keycloak.aws-k.certs.cloud/auth
OAUTH_REALM=mozart
AUTH_REQUIRED=true

# Optional explicit override:
# AUTH_JWKS_URL=https://keycloak.aws-k.certs.cloud/auth/realms/mozart/protocol/openid-connect/certs
```

#### 3. Check Logs for Available Keys

After the code improvements, logs will show:

```
Available key IDs (kid): ['abc123', 'def456', 'ghi789']
No matching key found for kid: zqnZ3Uf2FtlrbBvmXGixliHXnZY4L9AHVePLx1qfJWk. 
Available kids in JWKS: ['abc123', 'def456', 'ghi789']
```

#### 4. Increase JWKS Cache TTL (If Frequent Rotations)

In `src/api/auth.py`:

```python
self._jwks_cache_ttl = timedelta(minutes=5)  # Default
# Can increase to:
self._jwks_cache_ttl = timedelta(minutes=10)  # Less frequent refreshes
```

#### 5. Configure Keycloak Key Rotation Policy

In Keycloak Admin Console:

1. Go to Realm Settings → Keys → Active tab
2. Check "RS256" algorithm providers
3. Adjust rotation settings:
   - **Priority**: Higher priority keys are used for signing
   - **Enabled**: Toggle to enable/disable specific keys
   - **Passive Keys**: Keep old keys passive longer to handle cached tokens

**Recommended Keycloak Settings:**

- Keep 2-3 keys active (current + 1-2 previous)
- Rotation interval: 90 days (not too frequent)
- Key expiry: 180 days (double the rotation interval)

#### 6. Force Token Refresh for All Users

**Option A: Increment Keycloak Session Max Age**

- Realm Settings → Tokens → Access Token Lifespan
- Temporarily reduce to 5 minutes to force re-authentication

**Option B: Server-Side Token Revocation**

```bash
# Revoke all sessions for the realm (nuclear option)
# Only use if absolutely necessary
```

### For Developers

#### Debug Token Contents

```javascript
// In browser console, decode JWT token
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// Get token from localStorage
const token = localStorage.getItem('access_token');
const header = parseJwt(token.split('.')[0]); // Token header with kid
const payload = parseJwt(token); // Token payload with issuer, exp

console.log('Token KID:', header.kid);
console.log('Token Issuer:', payload.iss);
console.log('Token Expiry:', new Date(payload.exp * 1000));
```

#### Test JWKS Manually

```python
import httpx
import json

# Fetch JWKS
response = httpx.get('https://keycloak.aws-k.certs.cloud/auth/realms/mozart/protocol/openid-connect/certs')
jwks = response.json()

# Print all available key IDs
for key in jwks.get('keys', []):
    print(f"Kid: {key.get('kid')}, Use: {key.get('use')}, Alg: {key.get('alg')}")
```

## Prevention Strategies

### 1. Implement Graceful Token Refresh

Add automatic token refresh in frontend before token expires:

```javascript
// In auth.js
setInterval(async () => {
    const token = getStoredToken();
    if (token && isTokenExpiringSoon(token, 5 * 60 * 1000)) { // 5 minutes before expiry
        await refreshToken();
    }
}, 60000); // Check every minute
```

### 2. Better Error Messages to Users

The code now includes helpful error messages:

```
"Unable to find signing key for token. This may indicate:
1) Token from a different issuer/realm,
2) Key rotation occurred and token is outdated,
3) Token was issued before keys were rotated.
Please try logging out and logging in again."
```

### 3. Monitor Key Rotation Events

Set up alerts for Keycloak key rotation events to proactively notify users.

### 4. Coordinate Key Rotations

When rotating keys in Keycloak:

1. Add new key (keep old key active)
2. Wait for all tokens to expire or be refreshed
3. Then disable/remove old key

## Monitoring

### Logs to Watch

```bash
# Key mismatch errors
grep "No matching key found for kid" /var/log/cloudevent-player.log

# JWKS fetch attempts
grep "Fetched JWKS from" /var/log/cloudevent-player.log

# Token validation failures
grep "Token validation failed" /var/log/cloudevent-player.log
```

### Metrics to Track

- Number of "key not found" errors per hour
- JWKS cache hit/miss ratio
- Token validation success/failure rate
- Average token lifetime before rotation

## Related Files

- `src/api/auth.py` - JWT validation logic
- `src/api/settings.py` - JWKS URL configuration
- `src/ui/js/auth/auth.js` - Frontend token management
- `docs/authentication.md` - User-facing authentication docs

## Additional Resources

- [Keycloak Key Rotation Documentation](https://www.keycloak.org/docs/latest/server_admin/#_rotating_keys)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [JWKS Specification](https://tools.ietf.org/html/rfc7517)
