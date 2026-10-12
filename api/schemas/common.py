from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


MONEY_PATTERN = r"^\d{1,12}(\.\d{1,2})?$"

Money = Annotated[str, Field(pattern=MONEY_PATTERN, examples=["1000000.00"],
                             description="Positive decimal string with at most two decimals.")]
Currency = Literal["USD", "INR"]
ProfileName = Literal["low", "medium", "high"]
RangeKey = Literal["1Y", "3Y", "5Y"]
Freq = Literal["M", "Q"]
Emphasis = Literal["lower_risk", "balanced", "higher_return"]
Weights = dict[str, float]


class StrictModel(BaseModel):
    """Request bodies reject unknown fields."""

    model_config = ConfigDict(extra="forbid")


class Constraints(BaseModel):
    fully_invested: bool
    long_only: bool
    leverage_allowed: bool


class Metadata(BaseModel):
    assets: list[str]
    asset_count: int
    observations: int
    start_date: str
    end_date: str
    trading_days: int
    risk_free_rate: float
    frontier_point_count: int
    constraints: Constraints


class Diversification(BaseModel):
    concentration_threshold: float
    concentrated_assets: list[str]
    material_weight_threshold: float
    minimum_material_holdings: int
    material_holdings: int


class TickerWeight(BaseModel):
    ticker: str
    name: str
    sector: str
    group: str
    weight: float


class GroupWeight(BaseModel):
    group: str
    weight: float
    tickers: list[str]


class Breakdown(BaseModel):
    by_ticker: list[TickerWeight]
    by_group: list[GroupWeight]
    top_groups: list[GroupWeight]


class ErrorDetail(BaseModel):
    loc: list[str]
    msg: str
    type: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


# Explicit descriptions: FastAPI otherwise uses Python's status phrase, and 3.13
# renamed 422 ("Unprocessable Entity" -> "Content"), so the generated GUI types
# differed between local 3.11 and CI 3.13.
ERROR_RESPONSES = {422: {"model": ErrorResponse, "description": "Invalid input"},
                   500: {"model": ErrorResponse, "description": "Internal error"}}
