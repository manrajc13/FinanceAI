"""Select three needs-driven buckets from the efficient frontier.

The user's needs are expressed as a risk ceiling, a return floor and an emphasis.
Selection is deterministic and returns unchanged frontier points; no LLM, no
optimization and no interpolation is involved.
"""

from copy import deepcopy
from dataclasses import dataclass
from math import isfinite
from typing import Any

from agent.profiles import (
    CONCENTRATION_THRESHOLD,
    DISCLAIMER,
    MATERIAL_WEIGHT_THRESHOLD,
    MINIMUM_MATERIAL_HOLDINGS,
)
from agent.tools import AnalysisTools


EMPHASES = ('lower_risk', 'balanced', 'higher_return')
BUCKET_NAMES = ('conservative', 'balanced', 'growth')
RECOMMENDED = {'lower_risk': 'conservative', 'balanced': 'balanced', 'higher_return': 'growth'}
TOLERANCE = 1e-9


@dataclass(frozen=True)
class Preferences:
    """Annual decimal limits: 0.25 means 25%. None means no limit."""

    emphasis: str = 'balanced'
    max_volatility: float | None = None
    min_expected_return: float | None = None

    def __post_init__(self):
        if self.emphasis not in EMPHASES:
            raise ValueError(f'Emphasis must be one of {", ".join(EMPHASES)}.')
        for name in ('max_volatility', 'min_expected_return'):
            value = getattr(self, name)
            if value is None:
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
                raise ValueError(f'{name} must be a finite number or None.')
        if self.max_volatility is not None and self.max_volatility <= 0:
            raise ValueError('max_volatility must be positive.')

    def to_dict(self) -> dict[str, Any]:
        return {'emphasis': self.emphasis, 'max_volatility': self.max_volatility,
                'min_expected_return': self.min_expected_return}


def _bucket(name: str, index: int, point: dict, overlaps: list[str], assets: list[str],
            frontier_last: int) -> dict[str, Any]:
    weights = point['weights']
    concentrated = [t for t in assets if weights[t] > CONCENTRATION_THRESHOLD]
    material = sum(weights[t] > MATERIAL_WEIGHT_THRESHOLD for t in assets)
    warnings = []
    if concentrated:
        warnings.append('concentration_threshold_exceeded')
    if material < MINIMUM_MATERIAL_HOLDINGS:
        warnings.append('few_material_holdings')
    if overlaps:
        warnings.append('overlapping_profiles')
    if index == frontier_last:
        warnings.append('frontier_endpoint_selected')
    return {
        'name': name, 'frontier_index': index,
        'expected_return': point['expected_return'], 'volatility': point['volatility'],
        'variance': point['variance'], 'sharpe_ratio': point['sharpe_ratio'],
        'weights': deepcopy(weights), 'overlaps_with': overlaps, 'warnings': warnings,
        'diversification': {
            'concentration_threshold': CONCENTRATION_THRESHOLD,
            'concentrated_assets': concentrated,
            'material_weight_threshold': MATERIAL_WEIGHT_THRESHOLD,
            'minimum_material_holdings': MINIMUM_MATERIAL_HOLDINGS,
            'material_holdings': material,
        },
    }


def select_buckets(tools: AnalysisTools, preferences: Preferences | None = None) -> dict[str, Any]:
    """Return conservative / balanced / growth buckets inside the user's window.

    The window is the contiguous run of frontier points satisfying both limits.
    Conservative is its lowest-volatility point and balanced its highest-Sharpe
    point (earliest on ties). Growth is the highest-return point inside a binding
    risk ceiling; otherwise it is the interior point nearest the volatility
    midpoint above balanced, because the unconstrained endpoint is typically a
    single stock. Infeasible windows return the closest frontier point instead of
    inventing a portfolio.
    """
    preferences = preferences or Preferences()
    assets = tools.get_metadata()['assets']
    points = [tools.get_frontier_point(i) for i in range(tools.frontier_count)]
    last = len(points) - 1
    feasible = [
        i for i, p in enumerate(points)
        if (preferences.max_volatility is None or p['volatility'] <= preferences.max_volatility + TOLERANCE)
        and (preferences.min_expected_return is None
             or p['expected_return'] >= preferences.min_expected_return - TOLERANCE)
    ]
    frontier_range = {
        'min_volatility': points[0]['volatility'], 'max_volatility': points[last]['volatility'],
        'min_expected_return': points[0]['expected_return'],
        'max_expected_return': points[last]['expected_return'],
    }
    result = {'preferences': preferences.to_dict(), 'metadata': tools.get_metadata(),
              'frontier_range': frontier_range, 'disclaimer': DISCLAIMER}
    if not feasible:
        return {**result, 'status': 'infeasible', 'reason': _infeasible_reason(points, preferences),
                'closest': _closest(points, preferences, assets, last), 'buckets': {},
                'recommended': None, 'window': {'feasible_points': 0}}

    low, high = feasible[0], feasible[-1]
    balanced = max(feasible, key=lambda i: (points[i]['sharpe_ratio'], -i))
    if high != last and preferences.max_volatility is not None:
        growth = high
    else:
        target = (points[balanced]['volatility'] + points[high]['volatility']) / 2
        eligible = range(balanced, high if high == last else high + 1)
        growth = min(eligible, key=lambda i: (abs(points[i]['volatility'] - target), i), default=balanced)
    indices = {'conservative': low, 'balanced': balanced, 'growth': growth}
    buckets = {}
    for name, index in indices.items():
        overlaps = [other for other in indices if other != name and indices[other] == index]
        buckets[name] = _bucket(name, index, points[index], overlaps, assets, last)
    return {**result, 'status': 'ok', 'reason': None, 'closest': None, 'buckets': buckets,
            'recommended': RECOMMENDED[preferences.emphasis],
            'window': {'feasible_points': len(feasible), 'first_index': low, 'last_index': high}}


def _infeasible_reason(points: list[dict], preferences: Preferences) -> str:
    if preferences.min_expected_return is not None and \
            preferences.min_expected_return > points[-1]['expected_return'] + TOLERANCE:
        return 'return_floor_above_frontier'
    if preferences.max_volatility is not None and \
            preferences.max_volatility < points[0]['volatility'] - TOLERANCE:
        return 'risk_ceiling_below_frontier'
    return 'risk_ceiling_and_return_floor_conflict'


def _closest(points: list[dict], preferences: Preferences, assets: list[str], last: int):
    """Lowest-risk frontier point meeting the return floor, else the nearest end."""
    floor = preferences.min_expected_return
    if floor is not None:
        index = next((i for i, p in enumerate(points) if p['expected_return'] >= floor - TOLERANCE), last)
    else:
        index = 0
    return _bucket('closest', index, points[index], [], assets, last)
