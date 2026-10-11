from fastapi import APIRouter, Depends

from api.deps import get_state
from api.schemas.responses import FrontierResponse
from api.state import AnalysisState


router = APIRouter(tags=["frontier"])


@router.get("/frontier", response_model=FrontierResponse)
def frontier(state: AnalysisState = Depends(get_state)):
    """Sampled efficient frontier with Sharpe, GMV / Max Sharpe, profile indices and single assets."""
    return state.frontier
