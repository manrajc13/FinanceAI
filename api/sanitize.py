"""Remove server-only fields before any value leaves the API."""

from typing import Any


SERVER_ONLY_KEYS = frozenset({"dataset_path"})


def public(value: Any) -> Any:
    """Recursively drop server-only keys; returns new containers.

    The agent layer requires `metadata.dataset_path` internally (profile
    provenance), so it is stripped from responses rather than from inputs.
    """
    if isinstance(value, dict):
        return {key: public(item) for key, item in value.items() if key not in SERVER_ONLY_KEYS}
    if isinstance(value, (list, tuple)):
        return [public(item) for item in value]
    return value
