from fastapi import APIRouter, Depends

from agent.preferences import Preferences, select_buckets
from agent.profiles import DISCLAIMER
from agent.tools import AnalysisTools
from analytics.breakdown import breakdown
from api.deps import get_payload, get_state
from api.errors import domain_errors
from api.sanitize import public
from api.schemas.common import ERROR_RESPONSES, ProfileName
from api.schemas.profiles import BucketsResponse, ProfileResponse, ProfilesResponse
from api.schemas.requests import PreferencesRequest
from api.state import PROFILE_LABELS, PROFILE_NAMES, AnalysisState


router = APIRouter(tags=["profiles"], responses=ERROR_RESPONSES)


@router.get("/profiles", response_model=ProfilesResponse)
def profiles(state: AnalysisState = Depends(get_state)):
    """Low / medium / high profiles passed through unchanged, plus display breakdowns."""
    return {"profiles": public({name: state.profiles[name] for name in PROFILE_NAMES}),
            "breakdowns": state.breakdowns, "labels": PROFILE_LABELS, "disclaimer": DISCLAIMER}


@router.get("/profiles/{name}", response_model=ProfileResponse)
def profile(name: ProfileName, state: AnalysisState = Depends(get_state)):
    return {"profile": public(state.profiles[name]), "breakdown": state.breakdowns[name],
            "label": PROFILE_LABELS[name], "disclaimer": DISCLAIMER}


@router.post("/buckets", response_model=BucketsResponse)
def buckets(body: PreferencesRequest, payload: dict = Depends(get_payload),
            state: AnalysisState = Depends(get_state)):
    """Conservative / balanced / growth frontier points inside the user's limits.

    An infeasible window is a normal 200 result with status "infeasible".
    """
    with domain_errors():
        result = select_buckets(AnalysisTools(payload), Preferences(**body.model_dump()))
    chosen = dict(result["buckets"])
    if result["closest"] is not None:
        chosen["closest"] = result["closest"]
    breakdowns = {name: breakdown(bucket["weights"], state.reference) for name, bucket in chosen.items()}
    return {**public(result), "breakdowns": breakdowns}
