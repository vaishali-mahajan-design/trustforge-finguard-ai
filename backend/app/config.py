from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = 'local'
    cors_origins: str = 'http://localhost:5173,http://localhost:3000'
    mock_gemini: bool = True
    google_cloud_project: str | None = None
    google_cloud_location: str = 'global'
    google_genai_use_vertexai: bool = True
    gemini_model: str = 'gemini-2.5-flash'
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(',') if item.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
