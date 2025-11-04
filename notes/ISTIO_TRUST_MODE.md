# Istio Trust Mode Configuration Example

This example shows how to configure the CloudEvent Player when running behind Istio service mesh where JWT validation is handled by Istio's RequestAuthentication policy.

## Scenario

You have:

- Istio service mesh with RequestAuthentication configured
- Keycloak issuing JWTs from realm "mozart"
- Istio validating tokens at the ingress gateway
- CloudEvent Player receiving pre-validated tokens from Istio

## Problem

The token's Key ID (kid) doesn't match your application's configured JWKS because:

- Token is from a different realm than your OAuth configuration
- Token has already been validated by Istio
- You don't want the application to re-validate what Istio already validated

## Solution: Enable Trust Mode

### Environment Variables

```bash
# Required: Enable authentication
AUTH_REQUIRED=true

# Required: Enable trust mode to skip verification
AUTH_TRUST_MODE=true

# Optional: OAuth settings (for frontend login flow if needed)
OAUTH_SERVER_URL=https://keycloak.aws-k.certs.cloud/auth
OAUTH_REALM=mozart
OAUTH_CLIENT_ID=events-player-web

# Not needed in trust mode (token validation skipped):
# AUTH_JWKS_URL - no JWKS lookup performed
# AUTH_ISSUER - issuer not validated
# AUTH_AUDIENCE - audience not validated
```

### Docker Compose Example

```yaml
version: '3.8'

services:
  events-player:
    image: ghcr.io/bvandewe/events-player:latest
    ports:
      - "8080:8080"
    environment:
      # Enable authentication with trust mode
      - AUTH_REQUIRED=true
      - AUTH_TRUST_MODE=true
      
      # OAuth config for frontend (if using OAuth login)
      - OAUTH_SERVER_URL=https://keycloak.aws-k.certs.cloud/auth
      - OAUTH_REALM=mozart
      - OAUTH_CLIENT_ID=events-player-web
      
      # Role mapping
      - AUTH_ROLE_ADMIN=admin
      - AUTH_ROLE_OPERATOR=operator
      - AUTH_ROLE_USER=user
```

### Kubernetes Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: events-player
  namespace: events
spec:
  replicas: 1
  selector:
    matchLabels:
      app: events-player
  template:
    metadata:
      labels:
        app: events-player
    spec:
      containers:
      - name: events-player
        image: ghcr.io/bvandewe/events-player:latest
        ports:
        - containerPort: 8080
        env:
        # Trust mode for Istio
        - name: AUTH_REQUIRED
          value: "true"
        - name: AUTH_TRUST_MODE
          value: "true"
        
        # OAuth configuration (for frontend)
        - name: OAUTH_SERVER_URL
          value: "https://keycloak.aws-k.certs.cloud/auth"
        - name: OAUTH_REALM
          value: "mozart"
        - name: OAUTH_CLIENT_ID
          value: "events-player-web"
        
        # Role mapping
        - name: AUTH_ROLE_ADMIN
          value: "admin"
        - name: AUTH_ROLE_OPERATOR
          value: "operator"
        - name: AUTH_ROLE_USER
          value: "user"
---
apiVersion: v1
kind: Service
metadata:
  name: events-player
  namespace: events
spec:
  selector:
    app: events-player
  ports:
  - port: 8080
    targetPort: 8080
```

### Istio RequestAuthentication Example

This is typically configured at the ingress gateway level:

```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: istio-system
spec:
  selector:
    matchLabels:
      istio: ingressgateway
  jwtRules:
  - issuer: "https://keycloak.aws-k.certs.cloud/auth/realms/mozart"
    jwksUri: "https://keycloak.aws-k.certs.cloud/auth/realms/mozart/protocol/openid-connect/certs"
    audiences:
    - "events-player-web"
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: require-jwt
  namespace: events
spec:
  selector:
    matchLabels:
      app: events-player
  action: ALLOW
  rules:
  - from:
    - source:
        requestPrincipals: ["*"]
```

## How It Works

### Normal Flow (Without Trust Mode)

1. User logs in via OAuth → gets JWT token
2. Browser sends request with Authorization header
3. Istio validates JWT signature using JWKS
4. Application receives request, validates JWT **again** using JWKS
5. If token kid doesn't match application's JWKS → **ERROR**

### Trust Mode Flow (With Trust Mode)

1. User logs in via OAuth → gets JWT token
2. Browser sends request with Authorization header
3. Istio validates JWT signature using JWKS
4. Application receives request, **decodes JWT without validation**
5. Application extracts user info and roles
6. Application enforces RBAC based on roles
7. ✅ Success - no kid mismatch errors

## Security Considerations

### Trust Mode is Safe When

✅ Running behind Istio with RequestAuthentication configured
✅ Istio is properly validating JWT signatures
✅ Network is secured (no direct access to application, only through Istio)
✅ You trust the mesh layer completely

### Trust Mode is NOT Safe When

❌ Application is directly exposed to the internet
❌ No proxy/mesh layer validating JWTs upstream
❌ Untrusted network access to the application
❌ You need to validate tokens from multiple issuers

## Verification

### Check Logs

With trust mode enabled, you should see:

```
INFO - Trust mode enabled - decoding token without verification
DEBUG - Token decoded in trust mode for user: john.doe@example.com
```

### Test Authentication

1. Access the application through Istio ingress
2. Log in with a valid user
3. Check that user info is displayed correctly
4. Verify RBAC works (admin/operator/user roles)

### Debug Token Contents

If you need to verify what's in the token:

```python
import base64
import json

# Get the token from browser localStorage or Authorization header
token = "eyJhbGci..." 

# Decode payload (second part of JWT)
payload = token.split('.')[1]
# Add padding if needed
payload += '=' * (4 - len(payload) % 4)
decoded = base64.b64decode(payload)
token_data = json.loads(decoded)

print("Issuer:", token_data.get('iss'))
print("Subject:", token_data.get('sub'))
print("Roles:", token_data.get('realm_access', {}).get('roles', []))
print("Kid (from header):", json.loads(base64.b64decode(token.split('.')[0]))['kid'])
```

## Troubleshooting

### Still Getting 401 Errors

If you still get authentication errors with trust mode enabled:

1. **Check AUTH_REQUIRED is true**

   ```bash
   echo $AUTH_REQUIRED  # Should be "true"
   ```

2. **Check AUTH_TRUST_MODE is true**

   ```bash
   echo $AUTH_TRUST_MODE  # Should be "true"
   ```

3. **Verify token is being sent**
   - Open browser DevTools → Network tab
   - Check Authorization header is present
   - Format should be: `Bearer eyJhbGci...`

4. **Check Istio is injecting the token**

   ```bash
   # In the pod, check environment or headers
   kubectl exec -it <pod-name> -n events -- env | grep -i auth
   ```

### Token Not Being Forwarded

If Istio is validating but not forwarding the token:

```yaml
# Add to VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: events-player
spec:
  hosts:
  - events-player.example.com
  gateways:
  - istio-system/ingressgateway
  http:
  - match:
    - uri:
        prefix: /
    route:
    - destination:
        host: events-player
        port:
          number: 8080
    headers:
      request:
        set:
          # Ensure Authorization header is forwarded
          Authorization: "%REQ(Authorization)%"
```

## Migration Path

If you need to migrate from full validation to trust mode:

1. **Current**: Full JWT validation with JWKS lookup

   ```bash
   AUTH_REQUIRED=true
   AUTH_JWKS_URL=https://keycloak.../certs
   AUTH_ISSUER=https://keycloak.../realms/mozart
   ```

2. **Enable trust mode** (can be done immediately):

   ```bash
   AUTH_REQUIRED=true
   AUTH_TRUST_MODE=true
   # Remove AUTH_JWKS_URL and AUTH_ISSUER (not needed)
   ```

3. **Test thoroughly** with different user roles

4. **Monitor logs** for any issues

## Related Documentation

- [Authentication Guide](../docs/authentication.md)
- [JWT Key Mismatch Troubleshooting](JWT_KEY_MISMATCH_TROUBLESHOOTING.md)
- [RBAC Configuration Guide](../docs/rbac-guide.md)
- [Istio RequestAuthentication](https://istio.io/latest/docs/reference/config/security/request_authentication/)
