from unittest.mock import Mock

import pytest

from agent.explainer import default_plan
from agent.provider import DEFAULT_MODEL, GroqExplainer, ProviderError


def fake_provider(plan=None, error=None):
    return Mock(model=DEFAULT_MODEL, tool_calls=[{"name": "get_profile", "arguments": {"name": "high"}}],
                generate_plan=Mock(return_value=default_plan() if plan is None else plan, side_effect=error))


@pytest.fixture
def use_fake(monkeypatch):
    def install(provider):
        monkeypatch.setattr(GroqExplainer, "from_environment", lambda: provider)
        return provider
    return install


def test_offline_explanation_with_allocation_and_preferences(client):
    response = client.post("/api/explain", json={
        "amount": "10000", "currency": "INR", "profile": "low",
        "preferences": {"emphasis": "lower_risk", "max_volatility": 0.3}})
    assert response.status_code == 200
    body = response.json()
    explanation = body["explanation"]
    assert explanation["mode"] == "offline" and explanation["provider"] is None
    assert explanation["question_answered"] is False and explanation["status"] == "supported"
    assert explanation["disclaimer"] in explanation["text"]
    assert body["allocation"]["display"]["total"] == "10000.00"
    assert body["buckets"]["recommended"] == "conservative"
    assert body["news"] == [] and body["news_status"] == "not_requested"
    assert "dataset_path" not in response.text


def test_llm_mode_uses_provider_and_reports_tool_calls(client, use_fake):
    provider = use_fake(fake_provider())
    response = client.post("/api/explain", json={"use_llm": True, "question": "Why is high concentrated?"})
    explanation = response.json()["explanation"]
    assert explanation["mode"] == "llm" and explanation["provider"] == "groq"
    assert explanation["question_answered"] is True and explanation["model"] == DEFAULT_MODEL
    assert explanation["tool_calls"] == [{"name": "get_profile", "arguments": {"name": "high"}}]
    provider.generate_plan.assert_called_once()
    provider.close.assert_called_once()


@pytest.mark.parametrize("error,reason", [(ProviderError("rate_limited"), "rate_limited"),
                                          (RuntimeError("sk-secret raw provider body"), "explanation_failed")])
def test_provider_failures_fall_back_without_leaking(client, use_fake, error, reason):
    use_fake(fake_provider(error=error))
    response = client.post("/api/explain", json={"use_llm": True, "question": "Compare profiles"})
    assert response.status_code == 200
    explanation = response.json()["explanation"]
    assert explanation["mode"] == "fallback" and explanation["fallback_reason"] == reason
    assert explanation["question_answered"] is False
    assert "sk-secret" not in response.text


def test_unsupported_question_is_labelled(client, use_fake):
    use_fake(fake_provider({"status": "unsupported", "fact_ids": []}))
    explanation = client.post("/api/explain", json={"use_llm": True, "question": "Will NVDA rise?"}).json()[
        "explanation"]
    assert explanation["status"] == "unsupported" and explanation["question_answered"] is False
    assert "outside the supported historical data" in explanation["text"]


@pytest.mark.parametrize("body", [{"question": "Why?"}, {"use_llm": True, "question": ""},
                                  {"use_llm": True, "question": "x" * 2001}, {"amount": "abc"},
                                  {"preferences": {"emphasis": "yolo"}}, {"provider": "openai"}])
def test_invalid_explain_requests(client, body):
    response = client.post("/api/explain", json=body)
    assert response.status_code == 422 and response.json()["error"]["code"] == "validation_error"


def test_whitespace_question_is_rejected_by_agent_rules(client, use_fake):
    use_fake(fake_provider())
    response = client.post("/api/explain", json={"use_llm": True, "question": "   "})
    assert response.status_code == 422
    assert response.json()["error"] == {"code": "invalid_input",
                                        "message": "Question must contain 1 to 2000 characters."}


def test_llm_requests_are_rate_limited_but_offline_is_not(client, use_fake):
    use_fake(fake_provider())
    for _ in range(3):
        assert client.post("/api/explain", json={"use_llm": True}).status_code == 200
    limited = client.post("/api/explain", json={"use_llm": True})
    assert limited.status_code == 429 and limited.json()["error"]["code"] == "rate_limited"
    assert client.post("/api/explain", json={}).status_code == 200
