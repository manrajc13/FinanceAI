"""Per-client limit for explanation requests that call the hosted LLM."""

from fastapi import Request
from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter

from api.errors import RateLimited


class LlmLimiter:
    """In-memory moving window keyed by client IP (single-process deployment).

    The limit depends on the request body (`use_llm`), so it is checked inside
    the handler rather than by a route decorator. Offline calls are never limited.
    """

    def __init__(self, rate: str):
        self._item = parse(rate)
        self._limiter = MovingWindowRateLimiter(MemoryStorage())

    def check(self, request: Request) -> None:
        client = request.client.host if request.client else "unknown"
        if not self._limiter.hit(self._item, "explain-llm", client):
            raise RateLimited("Too many AI explanation requests; try again in a minute.")
