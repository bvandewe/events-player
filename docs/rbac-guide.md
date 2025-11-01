# RBAC Configuration Guide

This guide provides step-by-step instructions for setting up Role-Based Access Control (RBAC) with Keycloak and CloudEvents Player.

## Overview

CloudEvents Player uses OAuth 2.0/OIDC authentication with Keycloak to provide secure, role-based access control. The system supports three user roles with different permission levels:

- **Admin**: Full access to all features including bulk event generation
- **Operator**: Can generate single events and view all event details
- **User**: Read-only access to view incoming events

## Prerequisites

- Docker and Docker Compose installed
- Basic understanding of OAuth 2.0 and OIDC concepts
- Port 8884 (CloudEvents Player) and 8885 (Keycloak) available

## Quick Start with Docker Compose

The easiest way to get started is using the provided `docker-compose.debug.yml` configuration which includes a pre-configured Keycloak instance.

### 1. Start the Services

```bash
cd /path/to/cloudevents-player
docker-compose -f docker-compose.debug.yml up -d
```

This will start:

- **CloudEvents Player** at `http://localhost:8884`
- **Keycloak** at `http://localhost:8885`

### 2. Test User Accounts

The sample realm comes with three pre-configured users (all with password `test`):

| Username | Password | Role | Email |
|----------|----------|------|-------|
| admin | test | admin | <admin@events-player.local> |
| operator | test | operator | <operator@events-player.local> |
| user | test | user | <user@events-player.local> |

### 3. Access the Application

1. Navigate to `http://localhost:8884`
2. Click the login button
3. Sign in with one of the test accounts
4. Explore the features available based on your role

## Keycloak Configuration

### Accessing Keycloak Admin Console

1. Navigate to `http://localhost:8885`
2. Click "Administration Console"
3. Login with credentials:
   - **Username**: `admin`
   - **Password**: `admin`

### Understanding the Realm Configuration

The pre-configured `events-player` realm includes:

#### Realm Roles

Three roles are defined with specific permissions:

```json
"roles": {
  "realm": [
    {
      "name": "admin",
      "description": "Administrator role with full access"
    },
    {
      "name": "operator",
      "description": "Operator role with event management access"
    },
    {
      "name": "user",
      "description": "Basic user role with read-only access"
    }
  ]
}
```

#### Client Configuration

Two clients are configured:

**1. events-player-web** (Public Client)

- Used by the browser-based UI
- Uses PKCE for secure authentication
- Supports the authorization code flow

```json
{
  "clientId": "events-player-web",
  "publicClient": true,
  "redirectUris": [
    "http://localhost:8884/*",
    "http://localhost:1234/*"
  ],
  "webOrigins": [
    "http://localhost:8884",
    "http://localhost:1234"
  ]
}
```

**2. events-player-api** (Bearer-Only Client)

- Used by the backend API
- Validates tokens issued to the web client
- Uses client secret for authentication

```json
{
  "clientId": "events-player-api",
  "secret": "events-player-api-secret",
  "bearerOnly": true
}
```

## CloudEvents Player Configuration

### Environment Variables

All authentication and authorization settings use the `api_` prefix and are case-insensitive.

#### Required Settings

```bash
# Enable authentication
api_auth_required=true

# OAuth Server URLs
api_oauth_server_url=http://localhost:8885        # For browser access
api_oauth_server_url_backend=http://keycloak:8080 # For backend (Docker internal)

# Realm and Client Configuration
api_oauth_realm=events-player
api_oauth_client_id=events-player-web
api_auth_audience=events-player-web
```

#### Optional Settings

```bash
# Legacy Keycloak Support (< v17)
api_oauth_legacy_keycloak=false  # Set to true for Keycloak < v17

# JWT Configuration (auto-derived if not specified)
api_auth_algorithm=RS256
api_auth_jwks_url=http://keycloak:8080/realms/events-player/protocol/openid-connect/certs
api_auth_issuer=http://localhost:8885/realms/events-player

# Role Mapping (customize to match your IDP)
api_auth_role_admin=admin
api_auth_role_operator=operator
api_auth_role_user=user
```

### Complete Docker Compose Example

```yaml
services:
  event-player:
    image: ghcr.io/bvandewe/cloudevents-player:latest
    ports:
      - 8884:8080
    environment:
      # Authentication & Authorization
      api_auth_required: "true"
      api_auth_audience: events-player-web
      api_auth_algorithm: RS256
      
      # Role Mapping
      api_auth_role_admin: "admin"
      api_auth_role_operator: "operator"
      api_auth_role_user: "user"
      
      # OAuth/OIDC Configuration
      api_oauth_server_url: http://localhost:8885
      api_oauth_server_url_backend: http://keycloak:8080
      api_oauth_legacy_keycloak: "false"
      api_oauth_realm: events-player
      api_oauth_client_id: events-player-web
      api_oauth_client_secret: ""
    depends_on:
      - keycloak

  keycloak:
    image: quay.io/keycloak/keycloak:22.0.5
    entrypoint: ["/opt/keycloak/entrypoint-wrapper.sh"]
    command:
      - "start-dev"
      - "--import-realm"
    ports:
      - 8885:8080
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_HTTP_PORT: 8080
      KC_HOSTNAME_STRICT: "false"
      KC_HOSTNAME_STRICT_HTTPS: "false"
      KC_HTTP_ENABLED: "true"
      KC_HEALTH_ENABLED: "true"
      KC_METRICS_ENABLED: "true"
      KC_HOSTNAME_URL: http://localhost:8885
      KC_HOSTNAME_ADMIN_URL: http://localhost:8885
      KC_PROXY: "none"
    volumes:
      - keycloak_data:/opt/keycloak/data
      - ./deployments/keycloak/events-player-realm-export.json:/opt/keycloak/data/import/events-player-realm-export.json:ro
      - ./deployments/keycloak/entrypoint-wrapper.sh:/opt/keycloak/entrypoint-wrapper.sh:ro

volumes:
  keycloak_data:
```

## Managing Users and Roles

### Creating a New User in Keycloak

1. Access Keycloak Admin Console at `http://localhost:8885`
2. Select the `events-player` realm from the dropdown
3. Navigate to **Users** in the left menu
4. Click **Add user**
5. Fill in the required fields:
   - Username (required)
   - Email (optional)
   - First Name (optional)
   - Last Name (optional)
   - Email Verified (recommended: ON)
6. Click **Create**

### Assigning Roles

1. After creating the user, go to the **Role mapping** tab
2. Click **Assign role**
3. Select one of the available roles:
   - `admin` - Full administrative access
   - `operator` - Event generation and monitoring
   - `user` - Read-only access
4. Click **Assign**

### Setting a Password

1. Go to the **Credentials** tab
2. Click **Set password**
3. Enter the password
4. Set **Temporary** to OFF (user won't need to change password on first login)
5. Click **Save**

## Role Permissions Matrix

| Feature | Admin | Operator | User |
|---------|-------|----------|------|
| View event stream | ✅ | ✅ | ✅ |
| View event details | ✅ | ✅ | ❌ |
| Expand event headers | ✅ | ✅ | ❌ |
| Access generator panel | ✅ | ✅ | ❌ |
| Generate single event | ✅ | ✅ | ❌ |
| Generate multiple events (iterations) | ✅ | ❌ | ❌ |
| Customize delay between events | ✅ | ❌ | ❌ |
| Export events | ✅ | ✅ | ❌ |
| Manage tasks | ✅ | ✅ | ❌ |
| View analytics and charts | ✅ | ✅ | ✅ |
| Use search functionality | ✅ | ✅ | ✅ |
| Configure custom gateway URLs | ✅ | ❌ | ❌ |

## Advanced Configuration

### Using a Custom Keycloak Realm

If you want to create your own realm instead of using the provided sample:

1. **Create a New Realm**
   - In Keycloak Admin Console, click **Create Realm**
   - Enter a realm name (e.g., `my-company`)
   - Click **Create**

2. **Create Realm Roles**
   - Go to **Realm roles** → **Create role**
   - Create three roles: `admin`, `operator`, `user`
   - Add descriptions for each role

3. **Create a Public Client**
   - Go to **Clients** → **Create client**
   - Set Client ID: `events-player-web`
   - Set Client authentication: OFF (public client)
   - Enable Standard flow
   - Set Valid redirect URIs: `http://localhost:8884/*`
   - Set Web origins: `http://localhost:8884`
   - Under Advanced → Proof Key for Code Exchange: S256

4. **Create a Bearer-Only Client** (optional)
   - Create another client: `events-player-api`
   - Set Client authentication: ON
   - Generate a client secret
   - Under Client scopes, add realm roles

5. **Update CloudEvents Player Configuration**

   ```bash
   api_oauth_realm=my-company
   api_oauth_client_id=events-player-web
   ```

### Using External Keycloak

For production environments, you'll typically run Keycloak separately:

```bash
# Point to external Keycloak
api_oauth_server_url=https://keycloak.example.com
api_oauth_server_url_backend=https://keycloak.example.com  # Same URL for external
api_oauth_realm=production
api_oauth_client_id=events-player-web

# Update redirect URIs in Keycloak client to match your domain
# https://your-domain.com/*
```

### Using Other OIDC Providers

CloudEvents Player works with any OIDC-compliant identity provider (Auth0, Okta, Azure AD, etc.):

```bash
# Example: Auth0
api_oauth_server_url=https://your-tenant.auth0.com
api_oauth_realm=your-realm  # May not be needed for some providers
api_oauth_client_id=your-client-id

# Explicitly set JWKS and issuer
api_auth_jwks_url=https://your-tenant.auth0.com/.well-known/jwks.json
api_auth_issuer=https://your-tenant.auth0.com/

# Map roles to your IDP's role names
api_auth_role_admin=admin
api_auth_role_operator=operator
api_auth_role_user=user
```

## Troubleshooting

### Cannot Login - Redirect URI Mismatch

**Symptom**: After clicking login, you get an error about invalid redirect URI.

**Solution**: Ensure the client's redirect URIs in Keycloak match your application URL:

- Go to Keycloak → Clients → events-player-web → Settings
- Add your URL pattern to Valid redirect URIs (e.g., `http://localhost:8884/*`)
- Add your origin to Web origins (e.g., `http://localhost:8884`)

### Token Validation Fails

**Symptom**: Login succeeds but API calls fail with 401 Unauthorized.

**Solution**: Check that:

- `api_auth_issuer` matches the issuer in the JWT token
- `api_auth_audience` matches the audience in the JWT token
- `api_auth_jwks_url` is accessible from the backend container

Use browser dev tools → Application → Storage → Local Storage to inspect the token.

### Roles Not Working

**Symptom**: User has a role assigned but doesn't have the expected permissions.

**Solution**:

1. Verify role mapping in Keycloak:
   - Go to Users → [username] → Role mapping
   - Ensure the correct role is assigned
2. Check environment variable names:

   ```bash
   api_auth_role_admin=admin      # Role name in JWT
   api_auth_role_operator=operator
   api_auth_role_user=user
   ```

3. Inspect the JWT token to see what roles are included:
   - Use [jwt.io](https://jwt.io) to decode the token
   - Look for the `realm_access.roles` claim

### Keycloak Not Accessible from Backend

**Symptom**: Frontend can reach Keycloak but backend validation fails.

**Solution**: Use different URLs for frontend and backend:

```bash
api_oauth_server_url=http://localhost:8885        # Browser access
api_oauth_server_url_backend=http://keycloak:8080 # Docker internal
```

### Legacy Keycloak (< v17) Issues

**Symptom**: URLs don't work with older Keycloak versions.

**Solution**: Enable legacy mode:

```bash
api_oauth_legacy_keycloak=true  # Adds /auth prefix to URLs
```

## Sample Realm Export

The complete realm configuration is available in the repository at:

```
deployments/keycloak/events-player-realm-export.json
```

This includes:

- Pre-configured realm with roles
- Sample users (admin, operator, user)
- Client configurations
- Token settings
- Security policies

You can import this realm into any Keycloak instance for a quick setup.

## Security Best Practices

1. **Change Default Passwords**: The sample users have password `test` - change these in production!

2. **Use HTTPS**: Always use HTTPS in production:

   ```bash
   api_oauth_server_url=https://keycloak.example.com
   ```

3. **Enable Token Rotation**: Configure refresh token rotation in Keycloak client settings

4. **Set Appropriate Token Lifetimes**:
   - Access token: 5-15 minutes
   - Refresh token: 30 minutes
   - SSO session: 8 hours

5. **Restrict Redirect URIs**: Only allow specific redirect URIs, avoid wildcards in production

6. **Enable Brute Force Protection**: Keycloak's brute force detection is enabled in the sample realm

7. **Audit Logs**: Enable Keycloak's event logging for security auditing

## Next Steps

- [Authentication Overview](authentication.md) - Detailed authentication architecture
- [Configuration Reference](configuration.md) - Complete list of environment variables
- [Deployment Guide](deployment.md) - Production deployment patterns
- [Quick Start](quick-start.md) - Getting started without authentication

## Support

For issues or questions:

- GitHub Issues: [bvandewe/events-player](https://github.com/bvandewe/events-player/issues)
- Documentation: Check other guides in the docs folder
