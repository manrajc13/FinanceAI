"""FastAPI application. Run: uvicorn api.main:app --reload --port 8000 (from FinanceAI/)."""

from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from api.config import ApiSettings
from api.db import create_db_engine
from api.errors import register_error_handlers
from api.ratelimit import LlmLimiter
from api.routers import allocation, explain, frontier, meta, performance, plans, profiles, universe
from api.state import AnalysisState, load_state


FROZEN_GET_PREFIXES = ("/api/metadata", "/api/universe", "/api/frontier", "/api/profiles", "/api/performance")


def create_app(state_loader: Callable[[], AnalysisState] = load_state,
               settings: ApiSettings | None = None) -> FastAPI:
    settings = settings or ApiSettings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Runs the frozen-data pipeline once; a missing or invalid dataset fails startup.
        app.state.analysis = state_loader()
        app.state.engine = create_db_engine(settings.database_url) if settings.enable_plans else None
        app.state.llm_limiter = LlmLimiter(settings.explain_llm_rate_limit)
        try:
            yield
        finally:
            if app.state.engine is not None:
                app.state.engine.dispose()

    app = FastAPI(title="FinanceAI API", version="0.1.0", lifespan=lifespan,
                  description="Historical in-sample MPT analysis over a frozen dataset. "
                              "Figures are estimates, not forecasts or personalized investment advice.")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                       allow_origin_regex=settings.cors_origin_regex,
                       allow_methods=["GET", "POST", "DELETE"], allow_headers=["*"])

    @app.middleware("http")
    async def cache_frozen_reads(request: Request, call_next):
        response = await call_next(request)
        if (request.method == "GET" and response.status_code == 200
                and request.url.path.startswith(FROZEN_GET_PREFIXES)):
            response.headers.setdefault("Cache-Control", "public, max-age=3600")
        return response

    register_error_handlers(app)
    routers = [meta, universe, frontier, profiles, performance, allocation, explain]
    if settings.enable_plans:
        routers.append(plans)
    for module in routers:
        app.include_router(module.router, prefix="/api")
    return app


app = create_app()
