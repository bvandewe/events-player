import typing
from pydantic import BaseModel, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class DefaultGateways(BaseModel):
    """Default gateway URLs for event generation"""

    urls: typing.List[HttpUrl] = [
        HttpUrl("http://localhost:8884/events/pub"),
        HttpUrl("http://host.docker.internal:8884/events/pub"),
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
    tag: str = "0.3.3"
    repository_url: str = "https://github.com/bvandewe/events-player"

    # Logging configs
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    default_generator_gateways: DefaultGateways = DefaultGateways()
    default_generator_event: DefaultEvent = DefaultEvent()
    browser_queue_size: int = 1000

    # HTTP client configuration
    http_client_timeout: float = 30.0

    # Authentication & Authorization
    auth_mode: str = "auto"  # auto, required, disabled
    auth_jwks_url: str = ""  # JWKS endpoint for JWT validation
    auth_issuer: str = ""  # Expected JWT issuer
    auth_audience: str = ""  # Expected JWT audience
    auth_required: bool = False  # Require auth for all endpoints
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
