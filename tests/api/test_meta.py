from agent.profiles import DISCLAIMER
from api.state import CURRENCY_NOTICE


def test_health_reports_loaded_dataset_without_secrets(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk-test-secret")
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok" and body["dataset_loaded"] is True and body["plans_enabled"] is True
    assert "gsk-test-secret" not in response.text
    assert "Cache-Control" not in response.headers


def test_metadata_has_provenance_disclaimer_and_no_path(client, analysis_state):
    response = client.get("/api/metadata")
    assert response.status_code == 200
    body = response.json()
    expected = {key: value for key, value in analysis_state.payload["metadata"].items() if key != "dataset_path"}
    assert {key: body[key] for key in expected} == expected
    assert body["disclaimer"] == DISCLAIMER and body["currency_notice"] == CURRENCY_NOTICE
    assert "dataset_path" not in body
    assert response.headers["Cache-Control"] == "public, max-age=3600"


def test_cors_allows_configured_origin_and_regex(make_client):
    client = make_client(cors_origin_regex=r"^https://financeai-[a-z0-9-]+-team\.vercel\.app$")
    allowed = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    preview = client.get("/api/health", headers={"Origin": "https://financeai-abc123-team.vercel.app"})
    assert preview.headers["access-control-allow-origin"] == "https://financeai-abc123-team.vercel.app"
    denied = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in denied.headers


def test_unknown_route_uses_error_envelope(client):
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not Found"}}


def test_unexpected_errors_are_generic(client):
    client.app.state.analysis = None  # force an AttributeError inside a handler
    response = client.get("/api/frontier")
    assert response.status_code == 500
    assert response.json() == {"error": {"code": "internal_error", "message": "An unexpected error occurred."}}
