"""One JSON error envelope: {"error": {"code", "message", "details"?}}."""

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


logger = logging.getLogger("financeai.api")
STATUS_CODES = {400: "bad_request", 404: "not_found", 405: "method_not_allowed", 429: "rate_limited"}


class ApiError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidInput(ApiError):
    status_code = 422
    code = "invalid_input"


class NotFound(ApiError):
    status_code = 404
    code = "not_found"


class RateLimited(ApiError):
    status_code = 429
    code = "rate_limited"


@contextmanager
def domain_errors() -> Iterator[None]:
    """Turn agent/analytics ValueErrors (fixed, user-safe messages) into 422s.

    Use only around calls into `agent` or `analytics`; never register a global
    ValueError handler, which could expose library internals.
    """
    try:
        yield
    except ValueError as error:
        raise InvalidInput(str(error)) from error


def _body(code: str, message: str, details: list | None = None) -> dict:
    error = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(request: Request, error: ApiError):
        return JSONResponse(_body(error.code, error.message), status_code=error.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        details = [{"loc": [str(part) for part in item.get("loc", ())], "msg": item.get("msg", ""),
                    "type": item.get("type", "")} for item in error.errors()]
        return JSONResponse(_body("validation_error", "Request validation failed.", details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, error: StarletteHTTPException):
        code = STATUS_CODES.get(error.status_code, "http_error")
        message = error.detail if isinstance(error.detail, str) else "Request failed."
        return JSONResponse(_body(code, message), status_code=error.status_code, headers=error.headers)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, error: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(_body("internal_error", "An unexpected error occurred."), status_code=500)
