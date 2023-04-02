import typing
from pydantic import BaseSettings, BaseModel, SecretStr, AnyUrl


class DefaultGateways(BaseModel):
    urls: typing.List[AnyUrl] = [
        AnyUrl(url="http://localhost/events/pub", scheme="http")]


class DefaultEvent(BaseModel):
    event_source: str = "https://dummy.source.com/sys-admin"
    event_type: str = "com.source.dummy.test.requested.v1"
    event_subject: str = ""
    event_data: typing.Dict[str, typing.Any] = {"foo": "bar"}


class ApiSettings(BaseSettings):

    # Logging configs
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(levelname)s - %(message)s"

    default_generator_gateways: DefaultGateways = DefaultGateways()
    default_generator_event: DefaultEvent = DefaultEvent()
    browser_queue_size: int = 2

    class Config:
        # .env file must be present in parent directory when starting the app from uvicorn
        env_prefix = 'api_'  # all names must start with this in env. or docker-compose!
        env_file = '.env', '.env.prod'
        env_file_encoding = 'utf-8'  # just to be safe, depending on who checks out the repo...
        case_sensitive = False


settings = ApiSettings()
