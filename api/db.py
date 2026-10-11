"""Saved-plan persistence: SQLite locally, Postgres (e.g. Neon) in production."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy.engine import Engine, make_url
from sqlalchemy.pool import StaticPool
from sqlmodel import Field, SQLModel, create_engine


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Plan(SQLModel, table=True):
    __tablename__ = "plans"

    id: str = Field(default_factory=lambda: uuid4().hex, primary_key=True, max_length=32)
    name: str = Field(max_length=80)
    note: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    amount: str = Field(max_length=16)
    currency: str = Field(max_length=3)
    profile: str = Field(max_length=6)
    hide_dust: bool = False
    dataset_start: str = Field(max_length=10)
    dataset_end: str = Field(max_length=10)
    allocation_json: str  # server-computed, sanitized allocation snapshot


def create_db_engine(url: str) -> Engine:
    """Create the engine and tables. v1 uses create_all; add Alembic before schema changes."""
    kwargs: dict = {}
    parsed = make_url(url)
    if parsed.get_backend_name() == "sqlite":
        kwargs["connect_args"] = {"check_same_thread": False}
        if parsed.database in (None, "", ":memory:"):
            kwargs["poolclass"] = StaticPool
        else:
            Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, **kwargs)
    SQLModel.metadata.create_all(engine)
    return engine
