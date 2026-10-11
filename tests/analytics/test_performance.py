from decimal import Decimal

import pandas as pd
import pytest

from analytics.performance import NOTICE, money, performance_report, simulate_buy_and_hold, summarize


@pytest.fixture
def two_assets():
    index = pd.DatetimeIndex(["2024-01-02", "2024-01-31", "2024-02-29", "2024-03-28"], name="Date")
    return pd.DataFrame({"A": [100.0, 110.0, 90.0, 120.0], "B": [50.0, 50.0, 50.0, 50.0]}, index=index)


def test_hand_computed_buy_and_hold(two_assets):
    values = simulate_buy_and_hold(two_assets, {"A": 0.6, "B": 0.4}, Decimal("1000"), "5Y")
    # A position 600 grows with A's price; B position 400 stays flat.
    assert values.tolist() == pytest.approx([1000.0, 1060.0, 940.0, 1120.0])


def test_summary_metrics(two_assets):
    values = simulate_buy_and_hold(two_assets, {"A": 0.6, "B": 0.4}, Decimal("1000"), "5Y")
    summary = summarize(values, 252)
    assert summary["start_value"] == "1000.00" and summary["end_value"] == "1120.00"
    assert summary["gain"] == "120.00"
    assert summary["total_return"] == pytest.approx(0.12)
    years = (two_assets.index[-1] - two_assets.index[0]).days / 365.25
    assert summary["cagr"] == pytest.approx(1.12 ** (1 / years) - 1)
    assert summary["max_drawdown"] == pytest.approx(940 / 1060 - 1)
    assert summary["realized_volatility"] > 0


def test_flat_prices_give_zero_gain(two_assets):
    values = simulate_buy_and_hold(two_assets, {"A": 0.0, "B": 1.0}, Decimal("2500.50"), "5Y")
    summary = summarize(values, 252)
    assert summary["gain"] == "0.00" and summary["max_drawdown"] == 0.0 and summary["total_return"] == 0.0


def test_start_equals_amount_despite_weight_sum_drift(two_assets):
    values = simulate_buy_and_hold(two_assets, {"A": 0.6 + 5e-9, "B": 0.4 - 1e-9}, Decimal("999999999.99"), "5Y")
    assert money(values.iloc[0]) == "999999999.99"


@pytest.mark.parametrize("weights,match", [({"A": 0.7, "B": 0.4}, "sum to 1"), ({"A": 1.0}, "exactly"),
                                           ({"A": 1.2, "B": -0.2}, "non-negative")])
def test_invalid_weights_are_rejected(two_assets, weights, match):
    with pytest.raises(ValueError, match=match):
        simulate_buy_and_hold(two_assets, weights, Decimal("1000"), "5Y")


def test_report_series_benchmark_and_validation(prices):
    tickers = list(prices.columns)
    weights = {ticker: (1.0 if ticker == tickers[0] else 0.0) for ticker in tickers}
    report = performance_report(prices, weights, "100000.00", "inr", "5Y", "M", 252, True)
    assert report["currency"] == "INR" and report["amount"] == "100000.00"
    assert report["series"][0]["value"] == "100000.00" == report["series"][0]["benchmark"]
    assert report["series"][-1]["date"] == prices.index[-1].date().isoformat()
    expected_end = 100000 * prices[tickers[0]].iloc[-1] / prices[tickers[0]].iloc[0]
    assert Decimal(report["summary"]["end_value"]) == pytest.approx(Decimal(str(round(expected_end, 2))))
    assert report["benchmark"] == "equal_weight" and report["benchmark_summary"]["start_value"] == "100000.00"
    assert report["notice"] == NOTICE and report["method"] == "in_sample_buy_and_hold"
    plain = performance_report(prices, weights, "1", "USD", benchmark=False)
    assert plain["benchmark_summary"] is None and plain["series"][0]["benchmark"] is None
    for amount in ("0", "-5", "1.001", "NaN"):
        with pytest.raises(ValueError):
            performance_report(prices, weights, amount, "USD")
    with pytest.raises(ValueError, match="Currency"):
        performance_report(prices, weights, "10", "EUR")
