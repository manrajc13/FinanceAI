"""Group unchanged portfolio weights by ticker and display sector group."""

from typing import Any


OTHER = "Other"


def breakdown(weights: dict[str, float], reference: dict[str, dict[str, str]], top: int = 3) -> dict[str, Any]:
    """Sort and group weights for display without normalizing or editing them.

    `top_groups` holds the `top` largest groups plus one "Other" entry summing
    the rest, matching the dashboard donut. Ties sort alphabetically.
    """
    if set(weights) != set(reference):
        raise ValueError("Weights and reference must cover the same tickers.")
    if top < 1:
        raise ValueError("top must be at least 1.")
    by_ticker = sorted(
        ({"ticker": ticker, "name": reference[ticker]["name"], "sector": reference[ticker]["sector"],
          "group": reference[ticker]["group"], "weight": float(weight)}
         for ticker, weight in weights.items()),
        key=lambda row: (-row["weight"], row["ticker"]),
    )
    groups: dict[str, dict[str, Any]] = {}
    for row in by_ticker:
        group = groups.setdefault(row["group"], {"group": row["group"], "weight": 0.0, "tickers": []})
        group["weight"] += row["weight"]
        group["tickers"].append(row["ticker"])
    by_group = sorted(groups.values(), key=lambda row: (-row["weight"], row["group"]))
    top_groups = [dict(row, tickers=list(row["tickers"])) for row in by_group[:top]]
    rest = by_group[top:]
    if rest:
        top_groups.append({
            "group": OTHER,
            "weight": sum(row["weight"] for row in rest),
            "tickers": [ticker for row in rest for ticker in row["tickers"]],
        })
    return {"by_ticker": by_ticker, "by_group": by_group, "top_groups": top_groups}
