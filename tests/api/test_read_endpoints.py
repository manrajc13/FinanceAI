import pytest

from agent.profiles import select_profiles
from api.sanitize import public
from src.config import TICKERS


def test_universe_stats_match_covariance(client, analysis_state):
    body = client.get("/api/universe").json()
    assert [row["ticker"] for row in body["assets"]] == list(TICKERS)
    aapl = body["assets"][0]
    assert aapl["name"] == "Apple Inc." and aapl["group"] == "Technology"
    covariance = analysis_state.payload["annual_covariance"]["AAPL"]["AAPL"]
    assert aapl["annual_volatility"] == pytest.approx(covariance ** 0.5)
    assert aapl["annual_expected_return"] == analysis_state.payload["annual_expected_returns"]["AAPL"]


def test_correlation_matrix(client):
    body = client.get("/api/universe/correlation").json()
    matrix = body["matrix"]
    assert body["assets"] == list(TICKERS) and len(matrix) == len(TICKERS)
    assert all(matrix[i][i] == 1.0 for i in range(len(matrix)))
    assert all(matrix[i][j] == matrix[j][i] and -1 <= matrix[i][j] <= 1
               for i in range(len(matrix)) for j in range(len(matrix)))


@pytest.mark.parametrize("range_key,freq", [("5Y", "M"), ("1Y", "Q"), ("3Y", "M")])
def test_price_history(client, synthetic_prices, range_key, freq):
    response = client.get(f"/api/universe/prices?range={range_key}&freq={freq}")
    assert response.status_code == 200
    body = response.json()
    assert body["range"] == range_key and body["series"][0]["AAPL"] == pytest.approx(100.0)
    assert body["series"][-1]["date"] == synthetic_prices.index[-1].date().isoformat()


@pytest.mark.parametrize("query", ["range=2Y", "freq=W"])
def test_price_history_rejects_unknown_options(client, query):
    response = client.get(f"/api/universe/prices?{query}")
    assert response.status_code == 422 and response.json()["error"]["code"] == "validation_error"


def test_frontier_includes_sharpe_markers_and_assets(client, analysis_state):
    body = client.get("/api/frontier").json()
    points = analysis_state.payload["efficient_frontier"]
    assert len(body["points"]) == len(points)
    assert [point["index"] for point in body["points"]] == list(range(len(points)))
    assert body["points"][3]["weights"] == points[3]["weights"]
    assert all(isinstance(point["sharpe_ratio"], float) for point in body["points"])
    assert body["gmv"] == analysis_state.payload["portfolios"]["global_minimum_variance"]
    assert body["max_sharpe"] == analysis_state.payload["portfolios"]["maximum_sharpe"]
    assert body["profiles"] == {name: analysis_state.profiles[name]["selection"]["frontier_index"]
                                for name in ("low", "medium", "high")}
    assert len(body["assets"]) == len(TICKERS) and body["risk_free_rate"] == 0.04


def test_profiles_pass_through_unchanged(client, analysis_state):
    body = client.get("/api/profiles").json()
    expected = {name: public(result.to_dict()) for name, result in select_profiles(analysis_state.payload).items()}
    assert body["profiles"] == expected
    assert body["labels"] == {"low": "Conservative", "medium": "Balanced", "high": "Growth"}
    medium = body["breakdowns"]["medium"]
    assert sum(row["weight"] for row in medium["top_groups"]) == pytest.approx(1.0)
    assert {row["ticker"]: row["weight"] for row in medium["by_ticker"]} == expected["medium"]["weights"]


def test_single_profile(client):
    body = client.get("/api/profiles/high").json()
    assert body["profile"]["name"] == "high" and body["label"] == "Growth"
    assert client.get("/api/profiles/extreme").status_code == 422


def test_performance_for_profile_and_frontier_point(client):
    response = client.get("/api/performance?profile=medium&amount=1000000.00&currency=INR&freq=Q")
    assert response.status_code == 200
    body = response.json()
    assert body["portfolio"]["kind"] == "profile" and body["currency"] == "INR"
    assert body["series"][0]["value"] == "1000000.00" == body["summary"]["start_value"]
    assert body["benchmark"] == "equal_weight" and body["benchmark_summary"]["start_value"] == "1000000.00"
    assert "hindsight" in body["notice"] and "FX" in body["currency_notice"]
    point = client.get("/api/performance?frontier_index=4&amount=10&range=1Y&benchmark=none").json()
    assert point["portfolio"] == {"kind": "frontier_point", "profile": None, "frontier_index": 4}
    assert point["benchmark_summary"] is None and point["series"][0]["benchmark"] is None


@pytest.mark.parametrize("query,code", [
    ("amount=100", "invalid_input"),                                   # neither selector
    ("amount=100&profile=low&frontier_index=1", "invalid_input"),      # both selectors
    ("amount=100&frontier_index=999", "invalid_input"),
    ("amount=1.001&profile=low", "validation_error"),
    ("amount=0&profile=low", "invalid_input"),
    ("amount=100&profile=low&currency=EUR", "validation_error"),
    ("profile=low", "validation_error"),
])
def test_performance_validation(client, query, code):
    response = client.get(f"/api/performance?{query}")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code
