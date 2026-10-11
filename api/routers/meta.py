from fastapi import APIRouter, Depends, Request

from agent.profiles import DISCLAIMER
from api.deps import get_state
from api.sanitize import public
from api.schemas.responses import HealthResponse, MetadataResponse
from api.state import CURRENCY_NOTICE, AnalysisState, llm_configured


router = APIRouter(tags=["meta"])


@router.get("/health", response_model=HealthResponse)
def health(request: Request):
    return {"status": "ok", "dataset_loaded": getattr(request.app.state, "analysis", None) is not None,
            "llm_configured": llm_configured(), "plans_enabled": request.app.state.engine is not None}


@router.get("/metadata", response_model=MetadataResponse)
def metadata(state: AnalysisState = Depends(get_state)):
    return {**public(state.payload["metadata"]), "disclaimer": DISCLAIMER, "currency_notice": CURRENCY_NOTICE}
