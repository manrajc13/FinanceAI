import pytest


@pytest.fixture(autouse=True)
def prevent_network(monkeypatch):
    import socket

    def blocked(*args, **kwargs):
        raise AssertionError('Analytics tests must not use the network.')

    monkeypatch.setattr(socket.socket, 'connect', blocked)
