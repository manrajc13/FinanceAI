"""Static company names and sector groups for display."""

import json
from pathlib import Path
from typing import Any

from src.config import PROJECT_ROOT


REFERENCE_PATH = PROJECT_ROOT / "data" / "reference" / "tickers.json"
FIELDS = ("name", "sector", "group")


def load_reference(assets: list[str], path: str | Path = REFERENCE_PATH) -> dict[str, dict[str, str]]:
    """Return {ticker: {name, sector, group}} ordered like `assets`.

    The file must describe exactly the analysed universe, so a stale reference
    fails loudly instead of producing a partial sector breakdown.
    """
    data: dict[str, Any] = json.loads(Path(path).read_text(encoding="utf-8"))
    entries = data.get("assets")
    if not isinstance(entries, dict):
        raise ValueError("Reference file must contain an 'assets' mapping.")
    if set(entries) != set(assets):
        missing = sorted(set(assets) - set(entries))
        unexpected = sorted(set(entries) - set(assets))
        raise ValueError(
            "Reference tickers do not match the analysed universe. "
            f"Missing: {missing or 'none'}; unexpected: {unexpected or 'none'}."
        )
    reference = {}
    for ticker in assets:
        entry = entries[ticker]
        if not isinstance(entry, dict) or any(
            not isinstance(entry.get(field), str) or not entry[field].strip() for field in FIELDS
        ):
            raise ValueError(f"Reference entry for {ticker} needs non-empty name, sector and group.")
        reference[ticker] = {field: entry[field] for field in FIELDS}
    return reference
