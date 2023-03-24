from pydantic import BaseSettings


# Initialize datasettings before apisettings
# (as apisettings.start_date.default depends on datasettings)


class ApiSettings(BaseSettings):

    # Logging configs
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(levelname)s - %(message)s"

    class Config:  # pyright: ignore
        # .env file must be present in parent directory when starting the app from uvicorn
        env_prefix = 'api_'  # all names must start with this in env. or docker-compose!
        env_file = '.env', '.env.prod'
        env_file_encoding = 'utf-8'  # just to be safe, depending on who checks out the repo...
        case_sensitive = False
