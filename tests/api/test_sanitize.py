import pytest

from api.sanitize import public


def test_public_strips_nested_server_keys_without_mutation():
    value = {"dataset_path": "/srv/x", "a": [{"metadata": {"dataset_path": "/srv/x", "keep": 1}}], "b": (1, 2)}
    assert public(value) == {"a": [{"metadata": {"keep": 1}}], "b": [1, 2]}
    assert value["dataset_path"] == "/srv/x"


REQUESTS = [
    ("get", "/api/health", None), ("get", "/api/metadata", None), ("get", "/api/universe", None),
    ("get", "/api/universe/correlation", None), ("get", "/api/universe/prices", None),
    ("get", "/api/frontier", None), ("get", "/api/profiles", None), ("get", "/api/profiles/medium", None),
    ("get", "/api/performance?profile=low&amount=100", None),
    ("post", "/api/allocate", {"amount": "100"}), ("post", "/api/allocate/export.csv", {"amount": "100"}),
    ("post", "/api/buckets", {"max_volatility": 0.25}), ("post", "/api/buckets", {"min_expected_return": 4}),
    ("post", "/api/explain", {"amount": "100", "preferences": {"emphasis": "balanced"}}),
    ("post", "/api/plans", {"name": "p", "amount": "100"}), ("get", "/api/plans", None),
]


@pytest.mark.parametrize("method,url,body", REQUESTS)
def test_no_endpoint_leaks_the_dataset_path(client, dataset_path, method, url, body):
    response = client.request(method.upper(), url, json=body)
    assert response.status_code in (200, 201)
    for secret in ("dataset_path", str(dataset_path), dataset_path.as_posix(), str(dataset_path.parent.name)):
        assert secret not in response.text
