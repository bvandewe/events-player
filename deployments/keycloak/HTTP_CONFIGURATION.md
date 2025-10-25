# Keycloak HTTP Configuration for Development

## Overview

The Keycloak instance has been configured to allow HTTP access in development mode. This is necessary to access the admin console at `http://localhost:8090` without HTTPS requirements.

⚠️ **SECURITY WARNING**: This configuration is for development only and should NEVER be used in production!

## Configuration Details

### Server-Level Settings

The following environment variables in `docker-compose.debug.yml` configure Keycloak for HTTP:

```yaml
KC_HTTP_ENABLED: "true" # Enable HTTP listener
KC_HOSTNAME_STRICT: "false" # Disable strict hostname checking
KC_HOSTNAME_STRICT_HTTPS: "false" # Disable strict HTTPS enforcement
KC_HOSTNAME_URL: http://localhost:8090 # Set base URL to HTTP
KC_HOSTNAME_ADMIN_URL: http://localhost:8090 # Set admin URL to HTTP
KC_PROXY: "none" # No reverse proxy
```

### Realm-Level SSL Configuration

Keycloak requires per-realm SSL configuration. The master realm is automatically configured on startup through an entrypoint wrapper script.

#### Automatic Configuration

The `deployments/keycloak/entrypoint-wrapper.sh` script:

1. Starts Keycloak in the background
2. Waits for Keycloak to be ready
3. Uses `kcadm.sh` to update the master realm: `sslRequired=NONE`
4. Brings Keycloak to the foreground

#### Custom Realms

The `events-player` realm is pre-configured in the import file with:

```json
{
    "realm": "events-player",
    "sslRequired": "none",
    ...
}
```

## Accessing the Admin Console

- **URL**: http://localhost:8090
- **Username**: admin
- **Password**: admin

## Troubleshooting

### "HTTPS required" Error

If you see this error, the realm SSL requirement wasn't properly set. To fix manually:

```bash
# Execute kcadm inside the container
docker exec cloudevent-player-keycloak-1 /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user admin \
  --password admin

# Update master realm
docker exec cloudevent-player-keycloak-1 /opt/keycloak/bin/kcadm.sh update realms/master \
  -s sslRequired=NONE

# Update events-player realm (if needed)
docker exec cloudevent-player-keycloak-1 /opt/keycloak/bin/kcadm.sh update realms/events-player \
  -s sslRequired=NONE
```

### Container Restart

The configuration persists in the Keycloak H2 database volume (`keycloak_data`). If you delete this volume:

```bash
docker-compose -f docker-compose.debug.yml down -v
```

The entrypoint wrapper will automatically reconfigure the master realm on next startup.

## SSL Modes Reference

From Keycloak documentation, the three SSL modes are:

- **External requests**: SSL required except from private IP addresses (localhost, 192.168.x.x, etc.)
- **None**: No SSL required (development only)
- **All requests**: SSL required for all connections (production)

## Production Deployment

For production, you MUST:

1. Set `sslRequired: "external"` or `sslRequired: "all"` for all realms
2. Configure proper SSL certificates
3. Remove the entrypoint wrapper
4. Use proper proxy settings if behind a reverse proxy
5. Set `KC_HOSTNAME_STRICT_HTTPS: "true"`

## References

- [Keycloak SSL Configuration](https://www.keycloak.org/docs/latest/server_admin/index.html#_ssl_modes)
- [Keycloak Server Configuration](https://www.keycloak.org/server/all-config)
