"""Deterministic dashboard computations derived from the frozen baseline.

This package consumes `src` and `agent` results; neither imports it. It adds
display-oriented values the baseline payload lacks (sector breakdowns,
correlations, rebased price history, an in-sample buy-and-hold simulation).
It never changes weights, expected returns, covariance or assumptions.
"""
