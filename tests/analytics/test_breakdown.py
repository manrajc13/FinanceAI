import pytest

from analytics.breakdown import breakdown


REFERENCE = {
    "A": {"name": "Alpha", "sector": "IT", "group": "Technology"},
    "B": {"name": "Beta", "sector": "IT", "group": "Technology"},
    "C": {"name": "Gamma", "sector": "Health Care", "group": "Healthcare"},
    "D": {"name": "Delta", "sector": "Energy", "group": "Energy"},
    "E": {"name": "Epsilon", "sector": "Staples", "group": "Consumer"},
}
WEIGHTS = {"A": 0.3, "B": 0.1, "C": 0.25, "D": 0.15, "E": 0.2}


def test_groups_are_sorted_and_top_groups_add_other():
    result = breakdown(WEIGHTS, REFERENCE, top=2)
    assert [row["ticker"] for row in result["by_ticker"]] == ["A", "C", "E", "D", "B"]
    assert result["by_ticker"][0] == {"ticker": "A", "name": "Alpha", "sector": "IT",
                                      "group": "Technology", "weight": 0.3}
    groups = {row["group"]: row for row in result["by_group"]}
    assert groups["Technology"]["weight"] == pytest.approx(0.4)
    assert groups["Technology"]["tickers"] == ["A", "B"]
    assert [row["group"] for row in result["by_group"]] == ["Technology", "Healthcare", "Consumer", "Energy"]
    assert [row["group"] for row in result["top_groups"]] == ["Technology", "Healthcare", "Other"]
    other = result["top_groups"][-1]
    assert other["weight"] == pytest.approx(0.35)
    assert other["tickers"] == ["E", "D"]
    assert sum(row["weight"] for row in result["top_groups"]) == pytest.approx(1.0)


def test_no_other_when_groups_fit_and_ties_sort_alphabetically():
    reference = {"A": {"name": "A", "sector": "S", "group": "Zeta"},
                 "B": {"name": "B", "sector": "S", "group": "Alpha"}}
    result = breakdown({"A": 0.5, "B": 0.5}, reference)
    assert [row["group"] for row in result["top_groups"]] == ["Alpha", "Zeta"]
    assert [row["ticker"] for row in result["by_ticker"]] == ["A", "B"]


def test_weights_are_not_modified_or_normalized():
    weights = {"A": 0.3, "B": 0.1, "C": 0.25, "D": 0.15, "E": 0.2 - 1e-9}
    original = dict(weights)
    result = breakdown(weights, REFERENCE)
    assert weights == original
    assert {row["ticker"]: row["weight"] for row in result["by_ticker"]} == original


def test_invalid_inputs_are_rejected():
    with pytest.raises(ValueError, match="same tickers"):
        breakdown({"A": 1.0}, REFERENCE)
    with pytest.raises(ValueError, match="top"):
        breakdown(WEIGHTS, REFERENCE, top=0)
