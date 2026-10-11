"""Shared range and sampling rules for time-series views of the frozen data."""

import pandas as pd


RANGE_YEARS = {"1Y": 1, "3Y": 3, "5Y": None}
FREQUENCIES = ("M", "Q")


def range_start(index: pd.DatetimeIndex, range_key: str) -> pd.Timestamp:
    """First trading day of the range; 5Y means the full frozen window."""
    if range_key not in RANGE_YEARS:
        raise ValueError(f"Range must be one of {', '.join(RANGE_YEARS)}.")
    if len(index) < 2:
        raise ValueError("At least two observations are required.")
    years = RANGE_YEARS[range_key]
    if years is None:
        return index[0]
    cutoff = index[-1] - pd.DateOffset(years=years)
    eligible = index[index > cutoff]
    if len(eligible) < 2:
        raise ValueError("The selected range contains fewer than two observations.")
    return eligible[0]


def sample_dates(index: pd.DatetimeIndex, freq: str) -> pd.DatetimeIndex:
    """Last trading day of each month/quarter, always including both endpoints."""
    if freq not in FREQUENCIES:
        raise ValueError(f"Frequency must be one of {', '.join(FREQUENCIES)}.")
    dates = pd.Series(index, index=index)
    period_ends = dates.groupby(index.to_period(freq)).last()
    return pd.DatetimeIndex(sorted({index[0], index[-1], *period_ends}))
