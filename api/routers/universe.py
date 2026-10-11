from fastapi import APIRouter, Depends, Query

from agent.profiles import DISCLAIMER
from analytics.universe import asset_stats, correlation_matrix, normalized_prices
from api.deps import get_state
from api.errors import domain_errors
from api.sanitize import public
from api.schemas.common import ERROR_RESPONSES, Freq, RangeKey
from api.schemas.responses import CorrelationResponse, PriceHistoryResponse, UniverseResponse
from api.state import AnalysisState


router = APIRouter(prefix="/universe", tags=["universe"], responses=ERROR_RESPONSES)


@router.get("", response_model=UniverseResponse)
def universe(state: AnalysisState = Depends(get_state)):
    return {"assets": asset_stats(state.payload, state.reference),
            "metadata": public(state.payload["metadata"]), "disclaimer": DISCLAIMER}


@router.get("/correlation", response_model=CorrelationResponse)
def correlation(state: AnalysisState = Depends(get_state)):
    with domain_errors():
        return correlation_matrix(state.payload)


@router.get("/prices", response_model=PriceHistoryResponse)
def prices(state: AnalysisState = Depends(get_state),
           range_key: RangeKey = Query("5Y", alias="range"), freq: Freq = "M"):
    with domain_errors():
        return normalized_prices(state.prices, range_key, freq)
