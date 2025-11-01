# Configuration

CloudEvent Player can be configured through environment variables to customize its behavior for different environments and use cases.

## Zero Configuration Required

**CloudEvent Player works out of the box with no configuration.** All settings have sensible defaults, so you can start using it immediately:

```bash
docker run -p 8884:8080 ghcr.io/bvandewe/events-player:latest
```

Only configure environment variables when you need to customize behavior for your specific use case.

## Configuration Methods

CloudEvent Player supports multiple configuration methods, in order of precedence:

1. **Environment Variables** - Set directly in your shell or container
2. **Environment Files** - `.env` or `.env.prod` files in the application root
3. **Default Values** - Built-in defaults if no configuration is provided

## Environment Variable Naming

Environment variables can use either format:

- **Lowercase with underscores**: `api_log_level=DEBUG`
- **Uppercase**: `API_LOG_LEVEL=DEBUG`

Both formats are equivalent (case-insensitive). The docs use lowercase for consistency.

## Core Settings

### Application Version

#### `api_tag`

- **Description**: Application version/tag
- **Type**: String
- **Default**: `"0.4.0"`
- **Example**: `api_tag=v0.4.0`

Used for version identification in logs and API responses.

#### `api_repository_url`

- **Description**: Repository URL for the application
- **Type**: String (URL)
- **Default**: `"https://github.com/bvandewe/events-player"`
- **Example**: `api_repository_url=https://github.com/myorg/events-player`

Displayed in the UI and API documentation.

### Logging Configuration

#### `api_log_level`

- **Description**: Logging level for the application
- **Type**: String
- **Default**: `"INFO"`
- **Valid Values**: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- **Example**: `api_log_level=DEBUG`

Controls the verbosity of application logs. Use `DEBUG` for development and troubleshooting, `INFO` for production.

#### `api_log_format`

- **Description**: Python logging format string
- **Type**: String
- **Default**: `"%(asctime)s - %(name)s - %(levelname)s - %(message)s"`
- **Example**: `api_log_format="%(levelname)s - %(message)s"`

Customize log output format. See [Python logging documentation](https://docs.python.org/3/library/logging.html#logrecord-attributes) for available attributes.

### Frontend Display Settings

#### `api_browser_queue_size`

- **Description**: Maximum number of event accordion items rendered in the DOM
- **Type**: Integer
- **Default**: `1000`
- **Recommended**: 1000-3000
- **Example**: `api_browser_queue_size=2000`

**What it controls:**

- How many events appear in the Streams tab scrollable list
- Higher values: More events visible but slower DOM performance
- Lower values: Faster UI rendering but fewer events immediately visible
- Events beyond this limit are still stored in IndexedDB and can be searched

**Note:** This is a UI display limit only, not a storage limit.

### Client-Side Storage (IndexedDB)

CloudEvent Player uses a two-tier storage system in the browser:

- **Tier 1 (Recent Events)**: Full event objects with complete data
- **Tier 2 (Metadata)**: Lightweight metadata for timeline/dashboard

Both tiers use capacity-based cleanup (FIFO) - oldest events removed when limit exceeded.

#### `api_storage_max_recent_events`

- **Description**: Maximum number of complete event objects stored (Tier 1)
- **Type**: Integer
- **Default**: `5000`
- **Recommended**: 5000-10000 for normal use, 20000+ for high-volume analysis
- **Example**: `api_storage_max_recent_events=10000`

**Impact:**

- Determines how far back users can view full event details
- Higher values use more browser memory/disk
- When exceeded, oldest events are removed (FIFO)

#### `api_storage_max_metadata_events`

- **Description**: Maximum number of metadata entries stored (Tier 2)
- **Type**: Integer
- **Default**: `100000`
- **Recommended**: 50000-200000 depending on event volume
- **Example**: `api_storage_max_metadata_events=200000`

**Impact:**

- Determines how far back the timeline and dashboard charts extend
- Higher values provide longer history but slower queries
- When exceeded, oldest metadata is removed (FIFO)

### Default Event Generator Settings

These settings pre-populate the event generator form:

#### `api_default_generator_gateways`

- **Description**: Default gateway URLs for event generation
- **Type**: JSON string with `urls` array
- **Default**: `{"urls": ["http://host.docker.internal:8080/events/pub", "http://event-player:8080/events/pub"]}`
- **Example**:

```bash
api_default_generator_gateways='{"urls": ["http://localhost:8884/events/pub", "http://my-service:8080/events"]}'
```

**Important:** Must be valid JSON with a `urls` array.

#### `api_default_generator_event__event_source`

- **Description**: Default CloudEvent source attribute
- **Type**: String (URI)
- **Default**: `"https://dummy.source.com/sys-admin"`
- **Example**: `api_default_generator_event__event_source=https://myapp.com/orders`

The source context in which the event occurred.

#### `api_default_generator_event__event_type`

- **Description**: Default CloudEvent type attribute
- **Type**: String
- **Default**: `"com.source.dummy.test.requested.v1"`
- **Example**: `api_default_generator_event__event_type=com.myapp.order.created.v1`

The type of event. Use reverse-DNS naming convention.

#### `api_default_generator_event__event_subject`

- **Description**: Default CloudEvent subject attribute
- **Type**: String
- **Default**: `"some.interesting.concept.key_abcde12345"`
- **Example**: `api_default_generator_event__event_subject=order.12345`

The subject of the event in the context of the event producer.

#### `api_default_generator_event__event_data`

- **Description**: Default CloudEvent data payload
- **Type**: JSON string
- **Default**: `{"foo": "bar"}`
- **Example**: `api_default_generator_event__event_data={"orderId": "12345", "amount": 99.99}`

The event payload data. Must be valid JSON.

### HTTP Client Configuration

#### `api_http_client_timeout`

- **Description**: Timeout for HTTP client requests (in seconds)
- **Type**: Float
- **Default**: `30.0`
- **Example**: `api_http_client_timeout=60.0`

Used when the application makes HTTP requests to external services.

## Authentication & Authorization

**Authentication is disabled by default.** Set `api_auth_required=true` to enable.

For detailed authentication setup, see the [Authentication & Authorization](authentication.md) guide.

### Master Authentication Switch

#### `api_auth_required`

- **Description**: Master switch to enable/disable authentication
- **Type**: Boolean (string)
- **Default**: `"false"` _(authentication disabled)_
- **Example**: `api_auth_required=true`

**When `api_auth_required=false` (default):**

- Application works immediately without any authentication setup
- All features accessible without login
- No OAuth/OIDC configuration required
- Admin features available via gear icon in navigation

**When `api_auth_required=true`:**

- OAuth 2.0/OIDC authentication is enforced
- Users must log in to access protected features
- Role-based access control (admin, operator, user) is active
- Event generation requires operator or admin role

The authentication method is auto-detected when enabled:

- **Istio/Service Mesh**: JWT validated by mesh, user info from headers
- **OAuth/OIDC**: OAuth 2.0 + OIDC flow when OAuth server configured

### OAuth/OIDC Settings

Only required when `api_auth_required=true`.

#### `api_oauth_server_url`

- **Description**: OAuth/OIDC server URL (frontend access)
- **Type**: String (URL)
- **Required**: When using OAuth/OIDC authentication
- **Example**: `api_oauth_server_url=https://keycloak.example.com`

The base URL of your OAuth/OIDC server accessible from browsers.

**Auto-derivation:** When set, `api_auth_issuer` and `api_auth_jwks_url` are automatically derived if not explicitly configured.

#### `api_oauth_server_url_backend`

- **Description**: OAuth/OIDC server URL for backend server-to-server calls
- **Type**: String (URL)
- **Default**: Falls back to `api_oauth_server_url`
- **Example**: `api_oauth_server_url_backend=http://keycloak:8080`

Use when Docker internal URL differs from external URL (e.g., `keycloak:8080` vs `localhost:8090`).

#### `api_oauth_legacy_keycloak`

- **Description**: Enable legacy Keycloak URL format (< v17)
- **Type**: Boolean
- **Default**: `false`
- **Example**: `api_oauth_legacy_keycloak=true`

Set to `true` for Keycloak versions before v17 that require `/auth` prefix.  
Automatically converts `https://keycloak.example.com` to `https://keycloak.example.com/auth`.

#### `api_oauth_realm`

- **Description**: OAuth/OIDC realm name
- **Type**: String
- **Default**: `"events-player"`
- **Example**: `api_oauth_realm=my-realm`

#### `api_oauth_client_id`

- **Description**: OAuth/OIDC client ID for the web application
- **Type**: String
- **Default**: `"events-player-web"`
- **Example**: `api_oauth_client_id=events-player-web`

Must be a public client configured with PKCE support.

#### `api_oauth_client_secret`

- **Description**: Client secret (leave empty for public clients)
- **Type**: String
- **Default**: `""` (empty)
- **Example**: `api_oauth_client_secret=`

Public clients using PKCE don't require a client secret.

### JWT Validation Settings

#### `api_auth_jwks_url`

- **Description**: JWKS endpoint URL for JWT validation
- **Type**: String (URL)
- **Default**: Auto-derived from `api_oauth_server_url` + `api_oauth_realm`
- **Example**: `api_auth_jwks_url=http://oauth.example.com/realms/my-realm/protocol/openid-connect/certs`

**When to set explicitly:**

- Using Istio/Service Mesh without OAuth
- Using a non-standard OIDC provider
- For Keycloak, this is automatically derived

#### `api_auth_issuer`

- **Description**: Expected JWT issuer (iss claim)
- **Type**: String
- **Default**: Auto-derived from `api_oauth_server_url` + `api_oauth_realm`
- **Example**: `api_auth_issuer=http://oauth.example.com/realms/my-realm`

**When to set explicitly:**

- Using Istio/Service Mesh without OAuth
- Using a non-standard OIDC provider
- For Keycloak, this is automatically derived

#### `api_auth_audience`

- **Description**: Expected JWT audience (aud claim)
- **Type**: String
- **Default**: `""` (not validated)
- **Example**: `api_auth_audience=events-player-web`

The intended audience for the JWT token. Leave empty to skip audience validation.

#### `api_auth_algorithm`

- **Description**: JWT signature algorithm
- **Type**: String
- **Default**: `"RS256"`
- **Example**: `api_auth_algorithm=RS256`

### Role Mapping Configuration

Maps JWT token roles to application roles.

#### `api_auth_role_admin`

- **Description**: Role name in JWT that grants admin privileges
- **Type**: String
- **Default**: `"admin"`
- **Example**: `api_auth_role_admin=app-admin`

**Admin permissions:**

- View and cancel running event generation tasks
- Clear browser storage
- View active SSE client connections
- All operator and user permissions

#### `api_auth_role_operator`

- **Description**: Role name in JWT that grants operator privileges
- **Type**: String
- **Default**: `"operator"`
- **Example**: `api_auth_role_operator=app-operator`

**Operator permissions:**

- Generate events
- Export events to JSON
- All user permissions

#### `api_auth_role_user`

- **Description**: Role name in JWT that grants user privileges
- **Type**: String
- **Default**: `"user"`
- **Example**: `api_auth_role_user=app-user`

**User permissions:**

- View events in real-time
- Search and filter events
- View dashboard and analytics
- View timeline charts

## Complete Configuration Examples

### Minimal Setup (No Authentication)

Start CloudEvent Player with defaults - **no configuration needed**:

```bash
docker run -p 8884:8080 ghcr.io/bvandewe/events-player:latest
```

### Custom Event Defaults

Pre-configure the event generator form:

```bash
docker run -p 8884:8080 \
  -e api_default_generator_gateways='{"urls": ["http://my-service:8080/events"]}' \
  -e api_default_generator_event__event_source="https://myapp.com/service" \
  -e api_default_generator_event__event_type="com.myapp.order.created.v1" \
  -e api_default_generator_event__event_subject="order.123" \
  ghcr.io/bvandewe/events-player:latest
```

### High-Volume Setup

Configure for high event volume:

```bash
docker run -p 8884:8080 \
  -e api_browser_queue_size=3000 \
  -e api_storage_max_recent_events=20000 \
  -e api_storage_max_metadata_events=500000 \
  ghcr.io/bvandewe/events-player:latest
```

### OAuth/Keycloak Setup (Modern)

Enable authentication with Keycloak v17+:

```bash
docker run -p 8884:8080 \
  -e api_auth_required=true \
  -e api_oauth_server_url=https://keycloak.example.com \
  -e api_oauth_realm=my-realm \
  -e api_oauth_client_id=events-player-web \
  ghcr.io/bvandewe/events-player:latest
```

**Note:** `api_auth_jwks_url` and `api_auth_issuer` are auto-derived.

### OAuth/Keycloak Setup (Legacy)

For Keycloak versions < v17:

```bash
docker run -p 8884:8080 \
  -e api_auth_required=true \
  -e api_oauth_server_url=https://keycloak.example.com \
  -e api_oauth_legacy_keycloak=true \
  -e api_oauth_realm=my-realm \
  -e api_oauth_client_id=events-player-web \
  ghcr.io/bvandewe/events-player:latest
```

The `/auth` prefix is automatically added to all OAuth URLs.

### Docker Internal Network Setup

Different URLs for frontend (browser) and backend (server-to-server):

```bash
docker run -p 8884:8080 \
  -e api_auth_required=true \
  -e api_oauth_server_url=http://localhost:8090 \
  -e api_oauth_server_url_backend=http://keycloak:8080 \
  -e api_oauth_realm=events-player \
  -e api_oauth_client_id=events-player-web \
  ghcr.io/bvandewe/events-player:latest
```

### Custom Role Mapping

Map corporate roles to application roles:

```bash
docker run -p 8884:8080 \
  -e api_auth_required=true \
  -e api_oauth_server_url=https://oauth.corp.com \
  -e api_oauth_realm=corp \
  -e api_auth_role_admin=SuperAdmin \
  -e api_auth_role_operator=PowerUser \
  -e api_auth_role_user=StandardUser \
  ghcr.io/bvandewe/events-player:latest
```

### Development Mode with Debug Logging

```bash
docker run -p 8884:8080 \
  -e api_log_level=DEBUG \
  -e api_log_format="%(levelname)s - %(message)s" \
  ghcr.io/bvandewe/events-player:latest
```

## Docker Compose Examples

### Basic Setup

```yaml
services:
  event-player:
    image: ghcr.io/bvandewe/events-player:latest
    ports:
      - "8884:8080"
    restart: unless-stopped
```

### With Custom Configuration

```yaml
services:
  event-player:
    image: ghcr.io/bvandewe/events-player:latest
    ports:
      - "8884:8080"
    environment:
      api_log_level: DEBUG
      api_browser_queue_size: 2000
      api_storage_max_recent_events: 10000
      api_default_generator_gateways: '{"urls": ["http://localhost:8884/events/pub", "http://other-service/events"]}'
    restart: unless-stopped
```

### With OAuth/Keycloak

```yaml
services:
  event-player:
    image: ghcr.io/bvandewe/events-player:latest
    ports:
      - "8884:8080"
    environment:
      api_auth_required: "true"
      api_oauth_server_url: http://localhost:8090
      api_oauth_server_url_backend: http://keycloak:8080
      api_oauth_realm: events-player
      api_oauth_client_id: events-player-web
    restart: unless-stopped
    depends_on:
      - keycloak

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    ports:
      - "8090:8080"
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    command: start-dev
```

## Environment Variable Reference Summary

| Variable                          | Default               | Required        | Description              |
| --------------------------------- | --------------------- | --------------- | ------------------------ |
| `api_tag`                         | `"0.4.0"`             | No              | Application version      |
| `api_log_level`                   | `"INFO"`              | No              | Logging level            |
| `api_browser_queue_size`          | `1000`                | No              | Max events in DOM        |
| `api_storage_max_recent_events`   | `5000`                | No              | Max full events (Tier 1) |
| `api_storage_max_metadata_events` | `100000`              | No              | Max metadata (Tier 2)    |
| `api_auth_required`               | `"false"`             | No              | Enable authentication    |
| `api_oauth_server_url`            | `""`                  | If auth enabled | OAuth server URL         |
| `api_oauth_realm`                 | `"events-player"`     | If auth enabled | OAuth realm name         |
| `api_oauth_client_id`             | `"events-player-web"` | If auth enabled | OAuth client ID          |

## Troubleshooting Configuration

### Issue: Environment variables not taking effect

**Solution:**

- Verify variable names (case-insensitive, but check spelling)
- Use `api_` prefix for all settings
- For nested settings like generator defaults, use double underscores: `api_default_generator_event__event_source`
- Check Docker logs: `docker logs event-player`

### Issue: OAuth authentication not working

**Solution:**

1. Verify `api_auth_required=true` (must be string "true")
2. Check OAuth server URL is accessible from browser
3. For Docker networks, set both `api_oauth_server_url` and `api_oauth_server_url_backend`
4. For legacy Keycloak (< v17), set `api_oauth_legacy_keycloak=true`
5. Check logs for JWKS fetch errors

### Issue: Events not persisting across page reload

**Solution:**

- This is expected behavior - IndexedDB stores events client-side
- Increase `api_storage_max_recent_events` if events are being removed too quickly
- Check browser IndexedDB storage limits (varies by browser)

### Issue: UI performance degradation

**Solution:**

- Reduce `api_browser_queue_size` to render fewer events
- Keep `api_storage_max_recent_events` reasonable (5000-10000)
- Clear browser storage periodically (gear icon → Clear Storage)

## Next Steps

- [Quick Start Guide](quick-start.md) - Get up and running
- [Authentication Guide](authentication.md) - Detailed OAuth/OIDC setup
- [Deployment Guide](deployment.md) - Production deployment patterns
- [Usage Guide](usage.md) - Feature walkthrough

CloudEvent Player supports configurable role mapping, allowing you to map JWT token roles to application roles without code changes. This is essential for integrating with identity providers that use different role naming conventions.

#### `AUTH_ROLE_ADMIN`

- **Description**: Role name in JWT that grants administrator privileges
- **Type**: String
- **Default**: `"admin"`
- **Example**: `AUTH_ROLE_ADMIN=administrator`

**Effect on Authorization:**

Users with this role in their JWT token receive full administrative access:

- Generate unlimited events (no iteration/delay limits)
- Access all views and features
- Manage system settings

**Use Cases:**

- Custom identity provider uses "administrator" instead of "admin"
- Integration with Active Directory using "Administrators" group
- Multi-tenant deployments with role prefixes like "tenant1_admin"

#### `AUTH_ROLE_OPERATOR`

- **Description**: Role name in JWT that grants operator privileges
- **Type**: String
- **Default**: `"operator"`
- **Example**: `AUTH_ROLE_OPERATOR=power_user`

**Effect on Authorization:**

Users with this role receive operational access:

- Generate events with standard limits
- Access all views
- Cannot modify system settings

**Use Cases:**

- Enterprise systems using "PowerUser" or "Operator" roles
- DevOps teams with custom role naming conventions
- Service mesh deployments with specific role requirements

#### `AUTH_ROLE_USER`

- **Description**: Role name in JWT that grants basic user privileges
- **Type**: String
- **Default**: `"user"`
- **Example**: `AUTH_ROLE_USER=viewer`

**Effect on Authorization:**

Users with this role receive read-only access:

- View events in all views
- Cannot generate events
- Cannot modify system settings

**Use Cases:**

- Read-only access for monitoring teams
- Auditor or compliance roles
- External stakeholders needing visibility without control

#### Role Mapping Examples

**Example 1: Active Directory Integration**

```ini
# Map AD groups to application roles
AUTH_ROLE_ADMIN=Domain Admins
AUTH_ROLE_OPERATOR=DevOps Team
AUTH_ROLE_USER=All Employees
```

**Example 2: Multi-Tenant Environment**

```ini
# Tenant-specific role prefixes
AUTH_ROLE_ADMIN=tenant_admin
AUTH_ROLE_OPERATOR=tenant_operator
AUTH_ROLE_USER=tenant_user
```

**Example 3: Service Mesh (Istio)**

```ini
# Istio RequestAuthentication with custom claims
AUTH_ROLE_ADMIN=mesh-admin
AUTH_ROLE_OPERATOR=mesh-operator
AUTH_ROLE_USER=mesh-viewer
```

**Example 4: Corporate Standards**

```ini
# Organization-wide role naming
AUTH_ROLE_ADMIN=ADMIN
AUTH_ROLE_OPERATOR=POWER_USER
AUTH_ROLE_USER=READ_ONLY
```

#### Role Hierarchy

The application enforces a role hierarchy:

```
admin > operator > user
```

- Users with `admin` role automatically have `operator` privileges
- Users with `operator` role do NOT automatically have `admin` privileges
- All authenticated users have at least `user` privileges

**Important**: Role names are **case-sensitive** in JWT tokens. Ensure your identity provider issues tokens with matching case.

### Default Gateway URLs

#### `DEFAULT_GENERATOR_GATEWAYS__URLS`

- **Description**: List of default gateway URLs for event publishing
- **Type**: JSON Array of URLs
- **Default**:

  ```json
  [
    "http://localhost:8884/events/pub",
    "http://host.docker.internal:8884/events/pub",
    "http://event-player:8080/events/pub"
  ]
  ```

- **Example**: `DEFAULT_GENERATOR_GATEWAYS__URLS='["https://events.myapp.com/publish"]'`

URLs that appear in the gateway dropdown in the UI. The first URL is selected by default.

### Performance Settings

#### `BROWSER_QUEUE_SIZE`

- **Description**: Maximum number of event accordion items rendered in the DOM
- **Type**: Integer
- **Default**: `1000`
- **Example**: `BROWSER_QUEUE_SIZE=3000`

Controls the visual list size in the main event view. This is a UI display limit that affects DOM rendering performance.

**Effect on User Experience:**

- **Higher values** (2000-3000): More events visible in the scrollable list, but slower DOM rendering
- **Lower values** (500-1000): Faster UI rendering, fewer events immediately visible
- **Recommended**: 1000-3000 for balance between visibility and performance

**Important**: This only controls what's displayed in the UI. Events beyond this limit are still stored in IndexedDB (controlled by storage settings below) and can be searched/filtered.

#### `HTTP_CLIENT_TIMEOUT`

- **Description**: HTTP client timeout in seconds
- **Type**: Float
- **Default**: `30.0`
- **Example**: `HTTP_CLIENT_TIMEOUT=60.0`

Timeout for HTTP requests when publishing events to gateway URLs.

### Frontend Storage Configuration

CloudEvent Player uses a tiered storage system in the browser's IndexedDB to manage events efficiently. Both tiers use capacity-based cleanup for predictable behavior.

#### Storage Architecture Overview

The application implements a two-tier storage strategy with **capacity-based cleanup** (FIFO queues):

- **Tier 1 (Recent Events)**: Full event objects with complete data payload - **capacity-based** cleanup (FIFO queue)
- **Tier 2 (Metadata Only)**: Lightweight event metadata for analytics - **capacity-based** cleanup (FIFO queue)

Both tiers operate as FIFO (First-In-First-Out) queues. When capacity is exceeded, the oldest entries are automatically removed to make room for new ones. This provides predictable storage behavior regardless of event timing.

#### `STORAGE_MAX_RECENT_EVENTS`

- **Description**: Maximum number of complete event objects stored in IndexedDB Tier 1
- **Type**: Integer
- **Default**: `5000`
- **Example**: `STORAGE_MAX_RECENT_EVENTS=10000`
- **Cleanup Method**: **CAPACITY-BASED** (FIFO queue)

**How It Works:**

Tier 1 operates as a FIFO (First-In-First-Out) queue. When the count exceeds this limit, the oldest events are automatically removed to make room for new ones. Cleanup is purely capacity-based, not age-based.

**Effect on User Experience:**

Controls how many events users can click to view full details without requiring a server request. Once capacity is reached, oldest events are removed even if they're very recent.

- **Higher values** (10000-20000): More events available for detailed inspection
- **Lower values** (2000-5000): Less browser memory/disk usage, faster queries
- **Recommended**: 5000-10000 for normal use, 20000+ for high-volume analysis scenarios

**Business Impact**: Determines how far back users can investigate event details. In high-volume environments, this is typically measured in time (e.g., "last 30 minutes") rather than event count.

#### `STORAGE_MAX_METADATA_EVENTS`

- **Description**: Maximum number of metadata entries stored in Tier 2
- **Type**: Integer
- **Default**: `100000`
- **Example**: `STORAGE_MAX_METADATA_EVENTS=200000`
- **Cleanup Method**: **CAPACITY-BASED** (FIFO queue)

**How It Works:**

Tier 2 operates as a FIFO (First-In-First-Out) queue. When the count exceeds this limit, the oldest metadata entries are automatically removed to make room for new ones. Cleanup is purely capacity-based, not age-based.

**Effect on User Experience:**

Defines how far back the event timeline and dashboard charts can extend. Once capacity is reached, oldest metadata is removed to make room for new events.

**Metadata Structure** (lightweight, ~100-200 bytes per event):

- Event ID
- Timestamp
- Type
- Source
- Subject
- Data length
- Content type

**Capacity Examples:**

- **Higher values** (150000-200000): Longer event history visible in charts and lists
- **Lower values** (50000-100000): Faster queries, less storage overhead
- **Recommended**: 50000-200000 depending on event volume and retention needs

**Business Impact**: Determines the time window for trend analysis, dashboard metrics, and historical reporting. Metadata is lightweight, so higher values are feasible without significant performance impact.

### Storage Cleanup Behavior Summary

| Tier                       | Cleanup Method        | Setting                       |
| -------------------------- | --------------------- | ----------------------------- |
| **Tier 1 (Recent Events)** | Capacity-based (FIFO) | `storage_max_recent_events`   |
| **Tier 2 (Metadata)**      | Capacity-based (FIFO) | `storage_max_metadata_events` |

**Key Insight:** Both tiers use the **same cleanup strategy**:

- **Capacity-based FIFO queues**: When limit is reached, oldest entries are removed
- **Predictable behavior**: Storage limits are enforced consistently regardless of event timing
- **Simple tuning**: Adjust capacity based on your event volume and retention needs

### Storage Configuration Hierarchy

Understanding the relationship between these settings:

```
Display Layer (UI/DOM):
├─ BROWSER_QUEUE_SIZE (1000)
│  └─ What users see in the event list (accordion items)

Storage Layer (IndexedDB) - BOTH CAPACITY-BASED:
├─ Tier 1 - Full Event Objects (CAPACITY-BASED):
│  ├─ STORAGE_MAX_RECENT_EVENTS (5000)
│  └─ FIFO queue: Removes oldest when full
│
└─ Tier 2 - Metadata Only (CAPACITY-BASED):
   ├─ STORAGE_MAX_METADATA_EVENTS (100K)
   └─ FIFO queue: Removes oldest when full
```

### Storage Configuration Examples

#### Development/Low Volume

```ini
BROWSER_QUEUE_SIZE=1000
STORAGE_MAX_RECENT_EVENTS=5000      # 5K full events
STORAGE_MAX_METADATA_EVENTS=50000   # 50K metadata entries
```

**Use Case**: Local development, testing, or low-volume event streams.

#### Production/Normal Volume

```ini
BROWSER_QUEUE_SIZE=2000
STORAGE_MAX_RECENT_EVENTS=10000     # 10K full events
STORAGE_MAX_METADATA_EVENTS=100000  # 100K metadata entries
```

**Use Case**: Production environments with moderate event throughput (100-1000 events/minute).

#### Production/High Volume

```ini
BROWSER_QUEUE_SIZE=3000
STORAGE_MAX_RECENT_EVENTS=20000     # 20K full events
STORAGE_MAX_METADATA_EVENTS=200000  # 200K metadata entries
```

**Use Case**: High-throughput production systems requiring extended retention for analysis (1000+ events/minute).

#### Analytics/Forensics

```ini
BROWSER_QUEUE_SIZE=2000
STORAGE_MAX_RECENT_EVENTS=15000     # 15K full events
STORAGE_MAX_METADATA_EVENTS=300000  # 300K metadata entries
```

**Use Case**: Environments where users need maximum event history for detailed analysis and trend identification.

### Storage Performance Considerations

#### Browser Impact

- **IndexedDB Storage**: Each browser has storage limits (typically 50-100 GB, or 10-50% of available disk)
- **Query Performance**: Larger datasets require more time for filtering and search operations
- **Memory Usage**: Full events in Tier 1 consume more memory than metadata-only Tier 2

#### Tuning Guidelines

1. **Monitor browser storage usage**: Use browser DevTools → Application → Storage
2. **Adjust based on event size**: Large event payloads may require lower `MAX_RECENT_EVENTS`
3. **Balance display vs. storage**: `BROWSER_QUEUE_SIZE` should be ≤ `STORAGE_MAX_RECENT_EVENTS`
4. **Calculate retention window**: In high-volume environments, capacity translates to time (e.g., 10K events at 100/min = ~100 minutes)
5. **Test with realistic data**: Validate configuration with production-like event volumes

#### Common Issues and Solutions

**Issue**: "Browser storage quota exceeded"

- **Solution**: Reduce `STORAGE_MAX_RECENT_EVENTS` or `STORAGE_MAX_METADATA_EVENTS`

**Issue**: "Slow filtering/search performance"

- **Solution**: Reduce `STORAGE_MAX_METADATA_EVENTS` to speed up queries

**Issue**: "Recent events not showing full details"

- **Solution**: Increase `STORAGE_MAX_RECENT_EVENTS` to store more full events

**Issue**: "Dashboard charts not showing enough historical data"

- **Solution**: Increase `STORAGE_MAX_METADATA_EVENTS` to extend the time window

**Issue**: "Events disappearing too quickly in high-volume scenarios"

- **Solution**: Increase both `STORAGE_MAX_RECENT_EVENTS` and `STORAGE_MAX_METADATA_EVENTS` to extend retention

## Configuration Examples

### Development Environment

Create a `.env` file in the project root:

```ini
# .env
TAG=dev
LOG_LEVEL=DEBUG
DEFAULT_GENERATOR_EVENT__EVENT_SOURCE=https://dev.myapp.com/events
DEFAULT_GENERATOR_EVENT__EVENT_TYPE=com.myapp.test.v1
BROWSER_QUEUE_SIZE=100
```

### Production Environment

Create a `.env.prod` file:

```ini
# .env.prod
TAG=v1.0.0
LOG_LEVEL=INFO
DEFAULT_GENERATOR_EVENT__EVENT_SOURCE=https://prod.myapp.com/events
DEFAULT_GENERATOR_EVENT__EVENT_TYPE=com.myapp.production.v1
DEFAULT_GENERATOR_GATEWAYS__URLS='["https://events.prod.myapp.com/publish"]'
BROWSER_QUEUE_SIZE=5000
HTTP_CLIENT_TIMEOUT=60.0
```

### Docker Compose Configuration

```yaml
services:
  event-player:
    image: event-player:latest
    ports:
      - "8884:8080"
    environment:
      - TAG=v1.0.0
      - LOG_LEVEL=INFO
      - DEFAULT_GENERATOR_EVENT__EVENT_SOURCE=https://myapp.com/events
      - DEFAULT_GENERATOR_EVENT__EVENT_TYPE=com.myapp.event.v1
      - BROWSER_QUEUE_SIZE=2000
    restart: unless-stopped
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: event-player-config
data:
  TAG: "v1.0.0"
  LOG_LEVEL: "INFO"
  DEFAULT_GENERATOR_EVENT__EVENT_SOURCE: "https://myapp.com/events"
  DEFAULT_GENERATOR_EVENT__EVENT_TYPE: "com.myapp.event.v1"
  BROWSER_QUEUE_SIZE: "2000"
  HTTP_CLIENT_TIMEOUT: "60.0"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-player
spec:
  template:
    spec:
      containers:
        - name: event-player
          image: event-player:latest
          envFrom:
            - configMapRef:
                name: event-player-config
```

## Configuration Best Practices

### Security

1. **Don't commit secrets**: Never commit `.env` files containing sensitive information
2. **Use environment-specific files**: Separate configuration for dev/staging/production
3. **Limit gateway URLs**: Only include trusted event gateway endpoints

### Performance

1. **Tune queue size**: Adjust `BROWSER_QUEUE_SIZE` based on expected event volume
2. **Set appropriate timeouts**: Configure `HTTP_CLIENT_TIMEOUT` for your network conditions
3. **Use appropriate log levels**: `INFO` or `WARNING` for production, `DEBUG` only for troubleshooting

### Maintainability

1. **Use meaningful defaults**: Configure sensible defaults for your organization
2. **Document custom settings**: Keep track of non-standard configurations
3. **Version configuration**: Track configuration changes alongside code changes

## Environment Variable Naming

The configuration uses Pydantic's nested settings feature. Double underscores (`__`) represent nesting:

```
DEFAULT_GENERATOR_EVENT__EVENT_SOURCE
│   │                     │   │
│   │                     │   └─ Field name (event_source)
│   │                     └───── Nested object separator
│   └─────────────────────────── Object name (default_generator_event)
└─────────────────────────────── Prefix (api_)
```

This allows structured configuration while maintaining compatibility with environment variable conventions.

## Validation

CloudEvent Player uses Pydantic for configuration validation. Invalid values will cause the application to fail at startup with a clear error message:

```bash
# Invalid log level
LOG_LEVEL=INVALID

# Error:
# ValidationError: 1 validation error for ApiSettings
# log_level
#   Input should be 'DEBUG', 'INFO', 'WARNING', 'ERROR', or 'CRITICAL'
```

## Troubleshooting

### Configuration Not Applied

1. **Check environment variable names**: Ensure correct prefix and casing
2. **Verify .env file location**: Must be in the application root directory
3. **Check file permissions**: Ensure .env files are readable
4. **Inspect logs**: Application logs show loaded configuration values (except secrets)

### Default Values Not Working

1. **Check for typos**: Variable names are case-insensitive but must be spelled correctly
2. **Verify JSON format**: For complex values like `EVENT_DATA`, ensure valid JSON
3. **Check for overrides**: Environment variables take precedence over .env files

### Application Won't Start

1. **Review validation errors**: Check startup logs for configuration validation failures
2. **Test configuration values**: Validate JSON strings and URLs before setting
3. **Check required fields**: Ensure all required configuration is provided

## Next Steps

- [Usage Guide](usage.md) - Learn how to use the configured application
- [Deployment Guide](deployment.md) - Deploy with custom configuration
- [Quick Start](quick-start.md) - Get started quickly with defaults
