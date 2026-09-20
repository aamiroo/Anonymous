from pydantic_settings import BaseSettings

class Settings (BaseSettings):
    eitaa_bot_token: str
    jwt_secret_key: str

    class Config:
        env_file = ".env"


settings = Settings()