"""Per-asset statistics, correlations and rebased price history."""

from typing import Any

import numpy as np
import pandas as pd

from analytics.periods import range_start, sample_dates
from src.portfolio import calculate_portfolio_volatility


def covariance_rows(payload: dict[str, Any]) -> list[list[float]]:
    assets = payload["metadata"]["assets"]
    covariance = payload["annual_covariance"]
    return [[covariance[row][column] for column in assets] for row in assets]


def asset_stats(payload: dict[str, Any], reference: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    """Historical annual return and volatility per ticker, in universe order.

    Volatility is evaluated as a one-asset portfolio with `src.portfolio`,
    which equals sqrt of the covariance diagonal.
    """
    assets = payload["metadata"]["assets"]
    covariance = covariance_rows(payload)
    rows = []
    for position, ticker in enumerate(assets):
        unit = [float(index == position) for index in range(len(assets))]
        rows.append({
            "ticker": ticker,
            **reference[ticker],
            "annual_expected_return": float(payload["annual_expected_returns"][ticker]),
            "annual_volatility": calculate_portfolio_volatility(unit, covariance),
        })
    return rows


def correlation_matrix(payload: dict[str, Any]) -> dict[str, Any]:
    """rho_ij = Sigma_ij / (sigma_i * sigma_j), ordered like metadata.assets."""
    covariance = np.asarray(covariance_rows(payload), dtype=float)
    deviations = np.sqrt(np.diag(covariance))
    if not np.all(np.isfinite(deviations)) or np.any(deviations <= 0):
        raise ValueError("Correlation requires positive, finite asset variances.")
    correlation = np.clip(covariance / np.outer(deviations, deviations), -1.0, 1.0)
    np.fill_diagonal(correlation, 1.0)
    return {"assets": list(payload["metadata"]["assets"]), "matrix": correlation.tolist()}


def normalized_prices(prices: pd.DataFrame, range_key: str, freq: str) -> dict[str, Any]:
    """Adjusted prices rebased to 100 at the first trading day of the range."""
    window = prices.loc[range_start(prices.index, range_key):]
    rebased = window / window.iloc[0] * 100.0
    sampled = rebased.loc[sample_dates(window.index, freq)]
    return {
        "range": range_key,
        "freq": freq,
        "start_date": window.index[0].date().isoformat(),
        "end_date": window.index[-1].date().isoformat(),
        "assets": [str(column) for column in sampled.columns],
        "series": [
            {"date": date.date().isoformat(), **{str(ticker): float(value) for ticker, value in row.items()}}
            for date, row in sampled.iterrows()
        ],
    }
