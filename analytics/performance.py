"""In-sample buy-and-hold simulation of a planned amount.

This is hindsight, not a backtest: the weights were selected using the same
frozen data. Buy-and-hold from the first trading day of the range, with no
rebalancing, transaction costs, taxes or FX. Money values are display strings
rounded to two decimals; they are simulation outputs, not account balances.
"""

from decimal import ROUND_HALF_EVEN, Decimal
from math import sqrt
from typing import Any

import numpy as np
import pandas as pd

from agent.allocation import validate_allocation_input
from analytics.periods import range_start, sample_dates
from src.portfolio import validate_weights


METHOD = "in_sample_buy_and_hold"
NOTICE = (
    "In-sample hindsight simulation: the weights were selected using this same "
    "historical data. Buy-and-hold from the first trading day of the range, with "
    "no rebalancing, costs, taxes or FX conversion. Not a forecast."
)
CENT = Decimal("0.01")


def money(value: float) -> str:
    return format(Decimal(repr(float(value))).quantize(CENT, rounding=ROUND_HALF_EVEN), "f")


def simulate_buy_and_hold(prices: pd.DataFrame, weights: dict[str, float],
                          amount: Decimal, range_key: str) -> pd.Series:
    """Value of `amount` split by `weights` at the range start, then held.

    value_t = amount * sum_i w_i * P_i,t / P_i,t0. Weights are validated with
    src.portfolio; as in the allocation display view, tolerance-level negatives
    are clamped and weight-sum drift is removed so the start equals the amount.
    """
    window = prices.loc[range_start(prices.index, range_key):]
    if set(weights) != {str(column) for column in window.columns}:
        raise ValueError("Weights must cover exactly the dataset tickers.")
    vector = validate_weights([weights[str(ticker)] for ticker in window.columns], len(window.columns))
    vector = np.clip(vector, 0.0, None)
    vector = vector / vector.sum()
    growth = (window / window.iloc[0]).to_numpy() @ vector
    return pd.Series(growth * float(amount), index=window.index, name="value")


def summarize(values: pd.Series, trading_days: int) -> dict[str, Any]:
    first, last = float(values.iloc[0]), float(values.iloc[-1])
    start_value, end_value = money(first), money(last)
    years = (values.index[-1] - values.index[0]).days / 365.25
    daily = values.pct_change().dropna()
    return {
        "start_value": start_value,
        "end_value": end_value,
        "gain": format(Decimal(end_value) - Decimal(start_value), "f"),
        "total_return": last / first - 1.0,
        "cagr": (last / first) ** (1.0 / years) - 1.0 if years > 0 else None,
        "realized_volatility": float(daily.std(ddof=1) * sqrt(trading_days)) if len(daily) > 1 else None,
        "max_drawdown": float((values / values.cummax() - 1.0).min()),
    }


def performance_report(prices: pd.DataFrame, weights: dict[str, float], amount: Any, currency: str,
                       range_key: str = "5Y", freq: str = "M", trading_days: int = 252,
                       benchmark: bool = True) -> dict[str, Any]:
    """Sampled simulation series plus summaries, optionally against equal weight."""
    value, currency = validate_allocation_input(amount, currency)
    values = simulate_buy_and_hold(prices, weights, value, range_key)
    comparison = None
    if benchmark:
        tickers = [str(column) for column in prices.columns]
        comparison = simulate_buy_and_hold(prices, {t: 1.0 / len(tickers) for t in tickers}, value, range_key)
    dates = sample_dates(values.index, freq)
    return {
        "method": METHOD,
        "amount": format(value, "f"),
        "currency": currency,
        "range": range_key,
        "freq": freq,
        "start_date": values.index[0].date().isoformat(),
        "end_date": values.index[-1].date().isoformat(),
        "series": [
            {"date": date.date().isoformat(), "value": money(values[date]),
             "benchmark": money(comparison[date]) if comparison is not None else None}
            for date in dates
        ],
        "summary": summarize(values, trading_days),
        "benchmark": "equal_weight" if benchmark else None,
        "benchmark_summary": summarize(comparison, trading_days) if comparison is not None else None,
        "notice": NOTICE,
    }
