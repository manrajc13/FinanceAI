from typing import Literal

from fastapi import APIRouter, Depends, Query

from analytics.performance import performance_report
from api.deps import get_state
from api.errors import InvalidInput, domain_errors
from api.schemas.common import ERROR_RESPONSES, MONEY_PATTERN, Currency, Freq, ProfileName, RangeKey
from api.schemas.responses import PerformanceResponse
from api.state import CURRENCY_NOTICE, AnalysisState


router = APIRouter(tags=["performance"], responses=ERROR_RESPONSES)


@router.get("/performance", response_model=PerformanceResponse)
def performance(
    state: AnalysisState = Depends(get_state),
    amount: str = Query(..., pattern=MONEY_PATTERN, examples=["1000000.00"]),
    currency: Currency = "USD",
    profile: ProfileName | None = None,
    frontier_index: int | None = Query(None, ge=0),
    range_key: RangeKey = Query("5Y", alias="range"),
    freq: Freq = "M",
    benchmark: Literal["equal_weight", "none"] = "equal_weight",
):
    """In-sample buy-and-hold value of `amount` for one profile or frontier point (hindsight)."""
    if (profile is None) == (frontier_index is None):
        raise InvalidInput("Provide exactly one of profile or frontier_index.")
    if profile is not None:
        weights = state.profiles[profile]["weights"]
        index = state.profiles[profile]["selection"]["frontier_index"]
    else:
        points = state.payload["efficient_frontier"]
        if frontier_index >= len(points):
            raise InvalidInput("Invalid frontier index.")
        weights, index = points[frontier_index]["weights"], frontier_index
    with domain_errors():
        report = performance_report(state.prices, weights, amount, currency, range_key, freq,
                                    state.payload["metadata"]["trading_days"], benchmark == "equal_weight")
    return {"portfolio": {"kind": "profile" if profile else "frontier_point", "profile": profile,
                          "frontier_index": index},
            **report, "currency_notice": CURRENCY_NOTICE}
