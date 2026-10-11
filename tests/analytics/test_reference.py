import json

import pytest

from analytics.reference import load_reference
from src.config import TICKERS


def test_committed_reference_covers_configured_universe_in_order():
    reference = load_reference(list(TICKERS))
    assert list(reference) == list(TICKERS)
    assert reference["JNJ"] == {"name": "Johnson & Johnson", "sector": "Health Care", "group": "Healthcare"}
    assert all(set(entry) == {"name", "sector", "group"} for entry in reference.values())


def write(tmp_path, assets):
    path = tmp_path / "tickers.json"
    path.write_text(json.dumps({"assets": assets}), encoding="utf-8")
    return path


def test_mismatched_universe_is_rejected(tmp_path):
    path = write(tmp_path, {"A": {"name": "A", "sector": "S", "group": "G"}})
    with pytest.raises(ValueError, match="Missing: \\['B'\\]"):
        load_reference(["A", "B"], path)
    with pytest.raises(ValueError, match="unexpected: \\['A'\\]"):
        load_reference([], path)


@pytest.mark.parametrize("entry", [{"name": "A", "sector": "S"}, {"name": " ", "sector": "S", "group": "G"},
                                   {"name": 1, "sector": "S", "group": "G"}, "A"])
def test_incomplete_entries_are_rejected(tmp_path, entry):
    with pytest.raises(ValueError, match="non-empty"):
        load_reference(["A"], write(tmp_path, {"A": entry}))


def test_missing_assets_mapping_is_rejected(tmp_path):
    path = tmp_path / "tickers.json"
    path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="'assets' mapping"):
        load_reference(["A"], path)
