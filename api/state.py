"""Analysis snapshot loaded once at startup; the dataset is frozen."""

import importlib.util
import os
from dataclasses import dataclass
from typing import Any

import pandas as pd

from agent.cache import load_analysis
from agent.profiles import select_profiles
from agent.tools import AnalysisTools
from analytics.breakdown import breakdown
from analytics.reference import load_reference
from analytics.universe import asset_stats
from src.config import PROJECT_ROOT
from src.data_loader import load_stock_prices


PROFILE_NAMES = ("low", "medium", "high")
PROFILE_LABELS = {"low": "Conservative", "medium": "Balanced", "high": "Growth"}
CURRENCY_NOTICE = "Currency is a display label; no FX conversion is applied."


@dataclass(frozen=True)
class AnalysisState:
    """Read-only snapshot. Route handlers must copy before passing it to code that mutates."""

    payload: dict[str, Any]          # full pipeline payload (still contains dataset_path)
    prices: pd.DataFrame             # validated frozen adjusted closes
    reference: dict[str, dict[str, str]]
    profiles: dict[str, dict[str, Any]]
    breakdowns: dict[str, dict[str, Any]]
    frontier: dict[str, Any]


def build_state(payload: dict[str, Any], prices: pd.DataFrame,
                reference: dict[str, dict[str, str]]) -> AnalysisState:
    assets = payload["metadata"]["assets"]
    if [str(column) for column in prices.columns] != list(assets):
        raise ValueError("Price columns must match the analysed asset universe.")
    profiles = {name: result.to_dict() for name, result in select_profiles(payload).items()}
    breakdowns = {name: breakdown(profile["weights"], reference) for name, profile in profiles.items()}
    return AnalysisState(payload, prices, reference, profiles, breakdowns,
                         _frontier(payload, profiles, reference))


def _frontier(payload: dict[str, Any], profiles: dict[str, dict], reference: dict) -> dict[str, Any]:
    tools = AnalysisTools(payload)
    points = []
    for index in range(tools.frontier_count):
        point = tools.get_frontier_point(index)  # adds Sharpe via src.portfolio
        points.append({"index": index, "target_return": point.get("target_return"),
                       "expected_return": point["expected_return"], "variance": point["variance"],
                       "volatility": point["volatility"], "sharpe_ratio": point["sharpe_ratio"],
                       "weights": point["weights"]})
    portfolios = payload["portfolios"]
    return {
        "points": points,
        "gmv": portfolios["global_minimum_variance"],
        "max_sharpe": portfolios["maximum_sharpe"],
        "profiles": {name: profiles[name]["selection"]["frontier_index"] for name in PROFILE_NAMES},
        "assets": [{"ticker": row["ticker"], "name": row["name"], "group": row["group"],
                    "expected_return": row["annual_expected_return"], "volatility": row["annual_volatility"]}
                   for row in asset_stats(payload, reference)],
        "risk_free_rate": payload["metadata"]["risk_free_rate"],
    }


def load_state() -> AnalysisState:
    """Production loader: cached pipeline payload, frozen prices and static reference."""
    payload = load_analysis()
    return build_state(payload, load_stock_prices(), load_reference(payload["metadata"]["assets"]))


def llm_configured() -> bool:
    """True when the optional client is installed and a Groq key is available. Never returns the key."""
    if importlib.util.find_spec("openai") is None:
        return False
    if os.environ.get("GROQ_API_KEY"):
        return True
    try:
        from dotenv import dotenv_values
    except ImportError:
        return False
    return bool(dotenv_values(PROJECT_ROOT / ".env", interpolate=False).get("GROQ_API_KEY"))
