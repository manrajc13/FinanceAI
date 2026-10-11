"""Runtime configuration from FINANCEAI_* environment variables or FinanceAI/.env."""

from pydantic_settings import BaseSettings, SettingsConfigDict

from src.config import PROJECT_ROOT


DEFAULT_DATABASE_URL = f"sqlite:///{(PROJECT_ROOT / 'data' / 'app' / 'financeai.db').as_posix()}"


class ApiSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FINANCEAI_", env_file=PROJECT_ROOT / ".env", extra="ignore",
    )

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    cors_origin_regex: str | None = None
    database_url: str = DEFAULT_DATABASE_URL
    explain_llm_rate_limit: str = "10/minute"
    enable_plans: bool = True
    # FINANCEAI_DATASET_URL / _SHA256 / _TOKEN are read by api/bootstrap.py, not here.
