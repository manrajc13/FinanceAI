"""Needs-driven buckets: deterministic, frontier-only, honest when infeasible."""

from copy import deepcopy
import json

import pytest

from agent import graph
from agent.explainer import build_facts
from agent.news import NewsItem, NoNews
from agent.preferences import Preferences, select_buckets
from agent.tools import AnalysisTools


def frontier_points(payload):
    return payload['efficient_frontier']


def test_defaults_give_ordered_buckets_from_unchanged_frontier(payload):
    result = select_buckets(AnalysisTools(payload))
    assert result['status'] == 'ok' and result['recommended'] == 'balanced'
    buckets = result['buckets']
    assert list(buckets) == ['conservative', 'balanced', 'growth']
    assert buckets['conservative']['frontier_index'] == 0
    indices = [buckets[n]['frontier_index'] for n in buckets]
    assert indices == sorted(indices)
    for bucket in buckets.values():
        point = frontier_points(payload)[bucket['frontier_index']]
        assert bucket['weights'] == point['weights']
        assert bucket['expected_return'] == point['expected_return']
    sharpes = [b['sharpe_ratio'] for b in buckets.values()]
    assert buckets['balanced']['sharpe_ratio'] == max(
        AnalysisTools(payload).get_frontier_point(i)['sharpe_ratio'] for i in range(15))
    assert sharpes[1] >= sharpes[0]
    json.dumps(result, allow_nan=False)


def test_risk_ceiling_bounds_every_bucket_and_growth_uses_ceiling(payload):
    points = frontier_points(payload)
    ceiling = points[8]['volatility'] + 1e-6
    result = select_buckets(AnalysisTools(payload), Preferences('higher_return', max_volatility=ceiling))
    assert result['recommended'] == 'growth'
    assert all(b['volatility'] <= ceiling for b in result['buckets'].values())
    assert result['buckets']['growth']['frontier_index'] == 8


def test_return_floor_bounds_every_bucket_from_below(payload):
    points = frontier_points(payload)
    floor = points[6]['expected_return']
    result = select_buckets(AnalysisTools(payload), Preferences('lower_risk', min_expected_return=floor))
    assert result['recommended'] == 'conservative'
    assert result['buckets']['conservative']['frontier_index'] == 6
    assert all(b['expected_return'] >= floor - 1e-9 for b in result['buckets'].values())


def test_narrow_window_flags_overlap(payload):
    points = frontier_points(payload)
    result = select_buckets(AnalysisTools(payload), Preferences(
        min_expected_return=points[5]['expected_return'], max_volatility=points[5]['volatility'] + 1e-9))
    buckets = result['buckets']
    assert {b['frontier_index'] for b in buckets.values()} == {5}
    assert all('overlapping_profiles' in b['warnings'] for b in buckets.values())


@pytest.mark.parametrize('prefs, reason, closest', [
    (Preferences(min_expected_return=10.0), 'return_floor_above_frontier', 14),
    (Preferences(max_volatility=1e-6), 'risk_ceiling_below_frontier', 0),
])
def test_infeasible_returns_closest_point_not_invented_portfolio(payload, prefs, reason, closest):
    result = select_buckets(AnalysisTools(payload), prefs)
    assert result['status'] == 'infeasible' and result['reason'] == reason
    assert result['buckets'] == {} and result['recommended'] is None
    assert result['closest']['frontier_index'] == closest
    assert result['closest']['weights'] == frontier_points(payload)[closest]['weights']


def test_conflicting_limits_are_reported(payload):
    points = frontier_points(payload)
    result = select_buckets(AnalysisTools(payload), Preferences(
        min_expected_return=points[12]['expected_return'], max_volatility=points[3]['volatility']))
    assert result['reason'] == 'risk_ceiling_and_return_floor_conflict'
    assert result['closest']['frontier_index'] == 12


@pytest.mark.parametrize('kwargs', [
    {'emphasis': 'yolo'}, {'max_volatility': 0}, {'max_volatility': float('nan')},
    {'min_expected_return': True}, {'min_expected_return': 'high'},
])
def test_invalid_preferences_rejected(kwargs):
    with pytest.raises(ValueError):
        Preferences(**kwargs)


def test_why_facts_are_python_rendered_and_mandatory(payload):
    original = deepcopy(payload)
    result = graph.run_agent(payload, preferences=Preferences('higher_return'))
    explanation = result['explanation']
    assert result['buckets']['recommended'] == 'growth'
    for key in ('bucket.window', 'bucket.conservative.summary', 'bucket.growth.summary',
                'bucket.recommended', 'bucket.growth.why'):
        assert key in explanation['fact_ids']
    assert 'Growth matches your stated emphasis' in explanation['text'] or \
        'Growth matches your stated emphasis'.lower() in explanation['text'].lower()
    assert payload == original
    json.dumps(result, allow_nan=False)


def test_infeasible_workflow_still_explains_without_buckets(payload):
    result = graph.run_agent(payload, preferences=Preferences(min_expected_return=10.0))
    assert result['buckets']['status'] == 'infeasible'
    assert 'bucket.infeasible' in result['explanation']['fact_ids']
    assert 'no portfolio was invented' in result['explanation']['text']


def test_no_preferences_keeps_previous_behavior(payload):
    result = graph.run_agent(payload)
    assert result['buckets'] is None and result['news'] == []
    assert result['news_status'] == 'not_requested'
    assert not any(k.startswith('bucket.') for k in result['explanation']['fact_ids'])


class FakeNews:
    def __init__(self, items=None, error=None):
        self.items, self.error = items or [], error

    def fetch(self, tickers):
        if self.error:
            raise self.error
        return self.items


def test_news_is_sanitized_attributed_and_calculation_free(payload):
    good = NewsItem('A', 'Company A beats \x00estimates', 'Wire', '2024-12-01', 'https://example.com/a')
    bad = [NewsItem('ZZZ', 'unknown ticker', 'Wire', '2024-12-01', 'https://example.com/z'),
           NewsItem('A', 'plain http', 'Wire', '2024-12-01', 'http://example.com/h'),
           NewsItem('A', 'bad date', 'Wire', 'yesterday', 'https://example.com/d'),
           NewsItem(None, '', 'Wire', '2024-12-01', 'https://example.com/e')]
    baseline = graph.run_agent(payload, preferences=Preferences())
    result = graph.run_agent(payload, preferences=Preferences(), news_provider=FakeNews([good] + bad))
    assert result['news_status'] == 'ok' and len(result['news']) == 1
    assert '\x00' not in result['news'][0]['headline']
    assert result['buckets'] == baseline['buckets']
    assert result['profiles'] == baseline['profiles']
    assert 'news.0' in build_facts(AnalysisTools(payload), news=[NewsItem(**result['news'][0])])


def test_news_failure_is_non_fatal_and_leaks_nothing(payload):
    result = graph.run_agent(payload, preferences=Preferences(),
                             news_provider=FakeNews(error=RuntimeError('secret-token-123')))
    assert result['news'] == [] and result['news_status'] == 'unavailable'
    assert 'secret-token-123' not in json.dumps(result)


def test_default_provider_is_offline():
    assert NoNews().fetch(['A']) == []
