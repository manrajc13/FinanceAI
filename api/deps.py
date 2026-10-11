"""Request-scoped access to the startup snapshot and the plans database."""

from collections.abc import Iterator
from copy import deepcopy

from fastapi import Request
from sqlmodel import Session

from api.errors import NotFound
from api.state import AnalysisState


def get_state(request: Request) -> AnalysisState:
    return request.app.state.analysis


def get_payload(request: Request) -> dict:
    """Isolated copy, so no handler can mutate the shared snapshot."""
    return deepcopy(request.app.state.analysis.payload)


def get_session(request: Request) -> Iterator[Session]:
    engine = request.app.state.engine
    if engine is None:
        raise NotFound("Saved plans are disabled on this server.")
    with Session(engine) as session:
        yield session
