from decimal import Decimal

import pytest

from agent.allocation import allocate_amount
from agent.preferences import Preferences, select_buckets
from agent.tools import AnalysisTools
from api.sanitize import public
from src.config import TICKERS


def test_allocation_matches_agent_and_reconciles(client, analysis_state):
    body = {"amount": "1000000.00", "currency": "INR", "profile": "medium", "hide_dust": False}
    response = client.post("/api/allocate", json=body)
    assert response.status_code == 200
    result = response.json()
    expected = public(allocate_amount("1000000.00", "INR", analysis_state.payload, "medium").to_dict())
    assert {key: result[key] for key in expected} == expected
    assert result["display"]["total"] == "1000000.00"
    assert sum(Decimal(value) for value in result["display"]["amounts"].values()) == Decimal("1000000.00")
    assert {row["ticker"] for row in result["breakdown"]["by_ticker"]} == set(TICKERS)
    assert "FX" in result["currency_notice"]


def test_hidden_dust_is_reported_not_lost(client):
    result = client.post("/api/allocate", json={"amount": "1000", "currency": "USD", "profile": "high",
                                                "hide_dust": True}).json()
    display = result["display"]
    visible = sum(Decimal(value) for value in display["amounts"].values())
    assert visible + Decimal(display["hidden_amount"]) == Decimal(display["total"]) == Decimal("1000.00")
    assert set(display["amounts"]) | set(display["hidden_assets"]) == set(TICKERS)


@pytest.mark.parametrize("body", [
    {"amount": "1.001"}, {"amount": "-1"}, {"amount": 1000}, {"amount": "10", "currency": "EUR"},
    {"amount": "10", "profile": "extreme"}, {"amount": "10", "weights": {"AAPL": 1}}, {},
])
def test_allocation_rejects_invalid_bodies(client, body):
    response = client.post("/api/allocate", json=body)
    assert response.status_code == 422 and response.json()["error"]["code"] == "validation_error"


def test_zero_amount_is_a_domain_error(client):
    response = client.post("/api/allocate", json={"amount": "0"})
    assert response.status_code == 422
    assert response.json()["error"] == {"code": "invalid_input",
                                        "message": "Amount must be a finite positive decimal number."}


def test_allocation_csv(client):
    response = client.post("/api/allocate/export.csv",
                           json={"amount": "1000", "currency": "USD", "profile": "low", "hide_dust": True})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert 'filename="financeai-allocation-low-usd.csv"' in response.headers["content-disposition"]
    lines = response.text.splitlines()
    assert lines[0] == "ticker,name,group,weight,display_amount,exact_target_amount,currency"
    rows = [line for line in lines[1:] if not line.startswith("#")]
    assert len(rows) == len(TICKERS)  # hide_dust ignored: every ticker exported
    trailer = [line for line in lines if line.startswith("#")]
    assert any("historical in-sample" in line for line in trailer)
    assert any("no FX conversion" in line for line in trailer)


def test_buckets_match_agent(client, analysis_state):
    body = {"emphasis": "higher_return", "max_volatility": 0.3, "min_expected_return": None}
    result = client.post("/api/buckets", json=body).json()
    expected = public(select_buckets(AnalysisTools(analysis_state.payload),
                                     Preferences("higher_return", 0.3, None)))
    assert result["status"] == expected["status"] == "ok"
    assert result["buckets"] == expected["buckets"] and result["recommended"] == "growth"
    assert result["window"] == expected["window"]
    assert set(result["breakdowns"]) == {"conservative", "balanced", "growth"}


def test_infeasible_buckets_are_a_normal_result(client):
    result = client.post("/api/buckets", json={"min_expected_return": 4.5}).json()
    assert result["status"] == "infeasible" and result["reason"] == "return_floor_above_frontier"
    assert result["buckets"] == {} and result["closest"] is not None
    assert set(result["breakdowns"]) == {"closest"}


@pytest.mark.parametrize("body", [{"emphasis": "yolo"}, {"max_volatility": 0}, {"max_volatility": -0.1},
                                  {"min_expected_return": 9}, {"unknown": 1}])
def test_buckets_validation(client, body):
    assert client.post("/api/buckets", json=body).status_code == 422
