import pandas as pd
import pytest

from analytics.periods import range_start, sample_dates
from analytics.universe import asset_stats, correlation_matrix, normalized_prices


@pytest.fixture
def small_payload():
    return {
        "metadata": {"assets": ["A", "B"]},
        "annual_expected_returns": {"A": 0.1, "B": 0.2},
        "annual_covariance": {"A": {"A": 0.04, "B": 0.012}, "B": {"A": 0.012, "B": 0.09}},
    }


REFERENCE = {"A": {"name": "Alpha", "sector": "IT", "group": "Tech"},
             "B": {"name": "Beta", "sector": "Energy", "group": "Energy"}}


def test_asset_stats_use_covariance_diagonal(small_payload):
    rows = asset_stats(small_payload, REFERENCE)
    assert [row["ticker"] for row in rows] == ["A", "B"]
    assert rows[0] == {"ticker": "A", "name": "Alpha", "sector": "IT", "group": "Tech",
                       "annual_expected_return": 0.1, "annual_volatility": pytest.approx(0.2)}
    assert rows[1]["annual_volatility"] == pytest.approx(0.3)


def test_correlation_is_symmetric_with_unit_diagonal(small_payload):
    result = correlation_matrix(small_payload)
    assert result["assets"] == ["A", "B"]
    matrix = result["matrix"]
    assert matrix[0][0] == 1.0 and matrix[1][1] == 1.0
    assert matrix[0][1] == pytest.approx(0.012 / (0.2 * 0.3))
    assert matrix[0][1] == matrix[1][0]


def test_correlation_rejects_zero_variance(small_payload):
    small_payload["annual_covariance"]["A"]["A"] = 0.0
    with pytest.raises(ValueError, match="positive"):
        correlation_matrix(small_payload)


def test_normalized_prices_start_at_100_and_keep_endpoints(prices):
    result = normalized_prices(prices, "5Y", "M")
    first, last = result["series"][0], result["series"][-1]
    assert first["date"] == prices.index[0].date().isoformat()
    assert last["date"] == prices.index[-1].date().isoformat()
    assert all(first[ticker] == pytest.approx(100.0) for ticker in result["assets"])
    ticker = result["assets"][3]
    expected = prices[ticker].iloc[-1] / prices[ticker].iloc[0] * 100
    assert last[ticker] == pytest.approx(expected)
    assert result["start_date"] == "2024-01-01" and result["end_date"] == "2024-03-20"


def test_range_start_and_sampling():
    index = pd.bdate_range("2021-01-04", "2025-12-31")
    assert range_start(index, "5Y") == index[0]
    one_year = range_start(index, "1Y")
    assert one_year > pd.Timestamp("2024-12-31") and one_year == index[index > pd.Timestamp("2024-12-31")][0]
    sampled = sample_dates(index, "Q")
    assert sampled[0] == index[0] and sampled[-1] == index[-1]
    assert pd.Timestamp("2021-03-31") in sampled and len(sampled) == 21
    assert len(sample_dates(index, "M")) == 61


@pytest.mark.parametrize("call", [lambda i: range_start(i, "2Y"), lambda i: sample_dates(i, "W"),
                                  lambda i: range_start(i[:1], "5Y"),
                                  lambda i: range_start(pd.DatetimeIndex(["2020-01-02", "2022-01-03"]), "1Y")])
def test_invalid_range_inputs(call):
    index = pd.bdate_range("2021-01-04", "2025-12-31")
    with pytest.raises(ValueError):
        call(index)
