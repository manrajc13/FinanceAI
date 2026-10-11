from typing import Literal

from pydantic import BaseModel

from api.schemas.common import Breakdown, Diversification, Metadata, ProfileName, Weights


class Selection(BaseModel):
    source: str
    frontier_index: int
    rule: str
    parameters: dict[str, float | str]
    overlaps_with: list[str]


class Profile(BaseModel):
    name: ProfileName
    expected_return: float
    variance: float
    volatility: float
    sharpe_ratio: float
    weights: Weights
    metadata: Metadata
    selection: Selection
    diversification: Diversification
    warnings: list[str]
    disclaimer: str


class ProfilesResponse(BaseModel):
    profiles: dict[ProfileName, Profile]
    breakdowns: dict[ProfileName, Breakdown]
    labels: dict[ProfileName, str]
    disclaimer: str


class ProfileResponse(BaseModel):
    profile: Profile
    breakdown: Breakdown
    label: str
    disclaimer: str


class Bucket(BaseModel):
    name: str
    frontier_index: int
    expected_return: float
    volatility: float
    variance: float
    sharpe_ratio: float
    weights: Weights
    overlaps_with: list[str]
    warnings: list[str]
    diversification: Diversification


class PreferencesOut(BaseModel):
    emphasis: str
    max_volatility: float | None
    min_expected_return: float | None


class FrontierRange(BaseModel):
    min_volatility: float
    max_volatility: float
    min_expected_return: float
    max_expected_return: float


class BucketWindow(BaseModel):
    feasible_points: int
    first_index: int | None = None
    last_index: int | None = None


class BucketsResult(BaseModel):
    preferences: PreferencesOut
    metadata: Metadata
    frontier_range: FrontierRange
    disclaimer: str
    status: Literal["ok", "infeasible"]
    reason: str | None
    closest: Bucket | None
    buckets: dict[str, Bucket]
    recommended: str | None
    window: BucketWindow


class BucketsResponse(BucketsResult):
    breakdowns: dict[str, Breakdown]
