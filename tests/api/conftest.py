"""Synthetic API harness: the real pipeline on synthetic prices, no frozen dataset, no network."""

import socket

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from analytics.reference import load_reference
from api.config import ApiSettings
from api.main import create_app
from api.state import build_state
from src import pipeline
from src.config import TICKERS
from src.data_loader import load_stock_prices


LOOPBACK = {"127.0.0.1", "::1", "localhost"}


@pytest.fixture(autouse=True)
def prevent_network(monkeypatch):
    """Block outbound sockets; allow loopback, which the event loop's self-pipe uses on Windows."""
    original = socket.socket.connect

    def guarded(sock, address, *args, **kwargs):
        host = address[0] if isinstance(address, tuple) else address
        if host not in LOOPBACK:
            raise AssertionError('API tests must not use the network.')
        return original(sock, address, *args, **kwargs)

    monkeypatch.setattr(socket.socket, 'connect', guarded)


@pytest.fixture(scope="session")
def synthetic_prices():
    rng = np.random.default_rng(7)
    index = pd.bdate_range("2023-01-02", periods=420, name="Date")
    assets = np.arange(len(TICKERS))
    daily = 0.0003 + assets * 0.00008 + rng.normal(0.0, 0.008 + assets * 0.0015, (len(index), len(TICKERS)))
    return pd.DataFrame(100 * np.cumprod(1 + daily, axis=0), index=index, columns=list(TICKERS))


@pytest.fixture(scope="session")
def dataset_path(tmp_path_factory, synthetic_prices):
    path = tmp_path_factory.mktemp("frozen") / "prices.parquet"
    synthetic_prices.to_parquet(path)
    return path


@pytest.fixture(scope="session")
def analysis_state(dataset_path):
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(pipeline, "load_stock_prices", lambda: load_stock_prices(dataset_path))
        patch.setattr(pipeline, "RAW_PRICES_PATH", dataset_path)
        patch.setattr(pipeline, "FRONTIER_POINTS", 20)
        payload = pipeline.run_mpt_analysis().to_dict()
    return build_state(payload, load_stock_prices(dataset_path), load_reference(payload["metadata"]["assets"]))


def make_settings(**overrides):
    values = {"database_url": "sqlite://", "cors_origins": ["http://localhost:3000"],
              "explain_llm_rate_limit": "3/minute", **overrides}
    return ApiSettings(_env_file=None, **values)


@pytest.fixture
def make_client(analysis_state):
    clients = []

    def factory(**overrides):
        app = create_app(state_loader=lambda: analysis_state, settings=make_settings(**overrides))
        client = TestClient(app, raise_server_exceptions=False)
        client.__enter__()
        clients.append(client)
        return client

    yield factory
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def client(make_client):
    return make_client()
