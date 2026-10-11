"""FastAPI service over the frozen MPT baseline and the agent layer.

The API never re-implements financial logic: it validates HTTP input, calls
`agent` / `analytics`, strips server-only fields and serializes results.
"""
