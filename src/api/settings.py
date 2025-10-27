import typing
from pydantic import BaseModel, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class DefaultGateways(BaseModel):
    """Default gateway URLs for event generation"""

    urls: typing.List[HttpUrl] = [
        HttpUrl("http://host.docker.internal:8080/events/pub"),
        HttpUrl("http://event-player:8080/events/pub"),
    ]


class DefaultEvent(BaseModel):
    """Default CloudEvent attributes"""

    event_source: str = "https://dummy.source.com/sys-admin"
    event_type: str = "com.source.dummy.test.requested.v1"
    event_subject: str = "some.interesting.concept.key_abcde12345"
    event_data: typing.Dict[str, typing.Any] = {"foo": "bar"}


class ApiSettings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_prefix="api_",
        env_file=(".env", ".env.prod"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App version
    tag: str = "0.3.4"
    repository_url: str = "https://github.com/bvandewe/events-player"

    # Logging configs
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    default_generator_gateways: DefaultGateways = DefaultGateways()
    default_generator_event: DefaultEvent = DefaultEvent()

    # Frontend display queue size
    # browser_queue_size: Maximum number of event accordion items rendered in the DOM
    #   - Controls the visual list size in the main event view
    #   - Higher values: More events visible in the UI but slower DOM performance
    #   - Lower values: Faster UI rendering but fewer events immediately visible
    #   - Recommended: 1000-3000 (balance between visibility and performance)
    #   - Impact: Determines how many events appear in the scrollable list
    #   - Note: This is a UI display limit. Events beyond this limit are still stored
    #     in IndexedDB (controlled by storage settings) and can be searched/filtered
    browser_queue_size: int = 1000

    # Frontend storage configuration (IndexedDB)
    # These settings control the browser's client-side event storage behavior.
    # The application uses a tiered storage system in IndexedDB to manage events efficiently.
    # Both tiers use CAPACITY-BASED cleanup (FIFO queues) - oldest events removed when limit exceeded.
    # - Tier 1 (Recent): Full event objects with complete data for detailed viewing
    # - Tier 2 (Metadata): Lightweight event metadata for list display and filtering
    #
    # storage_max_recent_events: Maximum number of complete event objects stored in Tier 1
    #   - Tier 1 uses CAPACITY-BASED cleanup (FIFO queue)
    #   - When this limit is exceeded, oldest events are removed
    #   - Higher values: More events available for detailed viewing without re-fetching
    #   - Lower values: Less browser memory/disk usage
    #   - Recommended: 5000-10000 for normal use, 20000+ for high-volume analysis
    #   - Impact: Determines how far back users can view full event details
    #
    # storage_max_metadata_events: Maximum number of metadata entries stored in Tier 2
    #   - Tier 2 uses CAPACITY-BASED cleanup (FIFO queue)
    #   - When this limit is exceeded, oldest metadata entries are removed
    #   - Higher values: Longer event history visible in timeline/dashboard
    #   - Lower values: Faster queries and less storage overhead
    #   - Recommended: 50000-200000 depending on event volume and retention needs
    #   - Impact: Determines how far back the event timeline and dashboard charts extend
    storage_max_recent_events: int = 5000  # Tier 1: Max full events (capacity-based)
    storage_max_metadata_events: int = 100000  # Tier 2: Max metadata entries (capacity-based)

    # HTTP client configuration
    http_client_timeout: float = 30.0

    # Authentication & Authorization
    # When auth_required=True, all endpoints require valid authentication
    # The authentication method is auto-detected:
    #   - Istio/Service Mesh: JWT already validated, user info extracted from headers
    #   - Keycloak: OAuth 2.0 + OIDC flow when keycloak_url is configured
    #   - None: When auth_required=False, authentication is optional
    auth_required: bool = False  # Require authentication for all endpoints
    auth_jwks_url: str = ""  # JWKS endpoint for JWT validation (Istio mode)
    auth_issuer: str = ""  # Expected JWT issuer
    auth_audience: str = ""  # Expected JWT audience
    auth_algorithm: str = "RS256"  # JWT signature algorithm

    # Role mapping configuration
    # Maps JWT token roles to application roles (admin, operator, user)
    auth_role_admin: str = "admin"  # Role name in JWT that grants admin privileges
    auth_role_operator: str = "operator"  # Role name in JWT that grants operator privileges
    auth_role_user: str = "user"  # Role name in JWT that grants user privileges

    # Keycloak OAuth settings (for local development)
    keycloak_url: str = ""  # Keycloak base URL (for backend API calls)
    keycloak_url_external: str = ""  # Keycloak URL for browser (frontend)
    keycloak_realm: str = "events-player"  # Keycloak realm name
    keycloak_client_id: str = ""  # OAuth client ID
    keycloak_client_secret: str = ""  # OAuth client secret


settings = ApiSettings()
