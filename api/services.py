"""Allocation helpers shared by the allocation and saved-plan routes."""

import csv
import io
from typing import Any

from agent.allocation import allocate_amount
from agent.profiles import DISCLAIMER
from analytics.breakdown import breakdown
from api.errors import domain_errors
from api.sanitize import public
from api.state import CURRENCY_NOTICE, PROFILE_LABELS, AnalysisState


CSV_COLUMNS = ("ticker", "name", "group", "weight", "display_amount", "exact_target_amount", "currency")


def allocation_payload(payload: dict, state: AnalysisState, amount: str, currency: str,
                       profile: str, hide_dust: bool) -> dict[str, Any]:
    """Server-computed allocation; the client never supplies amounts or weights."""
    with domain_errors():
        result = allocate_amount(amount, currency, payload, profile).to_dict(hide_dust=hide_dust)
    return {**public(result), "breakdown": breakdown(result["target_profile"]["weights"], state.reference),
            "currency_notice": CURRENCY_NOTICE}


def allocation_csv(allocation: dict[str, Any]) -> str:
    """Every ticker with display and exact amounts, followed by '#' provenance lines.

    Expects an allocation computed with hide_dust=False so every ticker has a display amount.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    profile = allocation["target_profile"]
    for row in allocation["breakdown"]["by_ticker"]:
        ticker = row["ticker"]
        writer.writerow([ticker, row["name"], row["group"], repr(profile["weights"][ticker]),
                         allocation["display"]["amounts"][ticker], allocation["target_amounts"][ticker],
                         allocation["currency"]])
    metadata = profile["metadata"]
    constraints = metadata["constraints"]
    for line in (
        f"profile: {profile['name']} ({PROFILE_LABELS[profile['name']]}); total {allocation['display']['total']} "
        f"{allocation['currency']}",
        f"dataset: {metadata['start_date']} to {metadata['end_date']}; {metadata['trading_days']} trading days; "
        f"annual risk-free rate {metadata['risk_free_rate']}",
        f"constraints: fully_invested={constraints['fully_invested']}; long_only={constraints['long_only']}; "
        f"leverage_allowed={constraints['leverage_allowed']}",
        allocation["notice"],
        allocation["display"]["notice"],
        CURRENCY_NOTICE,
        DISCLAIMER,
    ):
        buffer.write(f"# {line}\n")
    return buffer.getvalue()


def csv_filename(profile: str, currency: str, stem: str = "financeai-allocation") -> str:
    return f"{stem}-{profile}-{currency.lower()}.csv"
