"""Verified facts and deterministic rendering for grounded explanations."""

from copy import deepcopy
from typing import Any

from agent.news import news_facts
from agent.profiles import DISCLAIMER
from agent.tools import AnalysisTools


RULES = {
    'low': 'Low selects the first sampled frontier point, at global minimum variance.',
    'medium': 'Medium selects the sampled point nearest Maximum Sharpe volatility; it may differ from the exact optimum.',
    'high': 'High selects an interior point nearest the volatility midpoint above Maximum Sharpe, at or above medium; overlapping selections are possible.',
}
WARNINGS = {
    'concentration_threshold_exceeded': 'At least one holding exceeds the concentration threshold.',
    'few_material_holdings': 'Few holdings exceed the material-weight threshold.',
    'overlapping_profiles': 'This option shares a sampled point with another profile.',
    'frontier_endpoint_selected': 'This profile is at the frontier endpoint and may be concentrated in one asset.',
    'no_distinct_higher_interior_selection': 'High reuses medium because no distinct higher interior point was selected.',
}


def _metrics(label: str, point: dict) -> str:
    return (f"{label}: historical annual expected return {point['expected_return']:.4%}; "
            f"annual volatility {point['volatility']:.4%}; Sharpe ratio {point['sharpe_ratio']:.4f}.")


def _weights(label: str, weights: dict) -> str:
    return label + ' target weights: ' + ', '.join(f'{ticker} {weight:.4%}' for ticker, weight in weights.items()) + '.'


def build_facts(tools: AnalysisTools, allocation: dict | None = None,
                buckets: dict | None = None, news: list | None = None) -> dict[str, str]:
    """Only Python-generated facts may enter the final explanation."""
    facts = {}
    for name in ('low', 'medium', 'high'):
        profile = tools.get_profile(name)
        facts[f'profile.{name}.summary'] = _metrics(name.title(), profile)
        facts[f'profile.{name}.selection'] = RULES[name]
        facts[f'profile.{name}.weights'] = _weights(name.title(), profile['weights'])
        if profile['warnings']:
            facts[f'profile.{name}.warnings'] = name.title() + ': ' + ' '.join(
                WARNINGS[code] for code in profile['warnings']
            )
    for ticker in tools.get_metadata()['assets']:
        stats = tools.get_asset_stats(ticker)
        facts[f'asset.{ticker}'] = (
            f"{ticker}: historical annual expected return {stats['annual_expected_return']:.4%}; "
            f"annual volatility {stats['annual_volatility']:.4%}."
        )
    for index in range(tools.frontier_count):
        point = tools.get_frontier_point(index)
        facts[f'frontier.{index}.summary'] = _metrics(f'Frontier point {index} (zero-based)', point)
        facts[f'frontier.{index}.weights'] = _weights(f'Frontier point {index}', point['weights'])
    if allocation is not None:
        display = allocation['display']
        facts['allocation'] = (
            f"{allocation['target_profile']['name'].title()} allocation for "
            f"{allocation['amount']} {allocation['currency']}: "
            + ', '.join(f'{ticker} {value}' for ticker, value in display['amounts'].items())
            + f"; grouped holdings {display['hidden_amount']}; total {display['total']}. "
            + allocation['notice']
        )
    if buckets is not None:
        facts.update(bucket_facts(buckets))
    if news:
        facts.update(news_facts(news))
    return facts


BUCKET_ROLES = {
    'conservative': 'the lowest-volatility option inside your window',
    'balanced': 'the highest Sharpe ratio inside your window',
    'growth': 'the higher-return end of your window',
}
REASONS = {
    'return_floor_above_frontier': 'The requested return floor exceeds every sampled frontier point.',
    'risk_ceiling_below_frontier': 'The requested risk ceiling is below the lowest-volatility frontier point.',
    'risk_ceiling_and_return_floor_conflict': 'No sampled frontier point satisfies both the risk ceiling and the return floor.',
}


def _limit(value: float | None) -> str:
    return 'no limit' if value is None else f'{value:.2%}'


def _delta(a: dict, b: dict) -> str:
    return (f"{a['expected_return'] - b['expected_return']:+.2%} expected return and "
            f"{a['volatility'] - b['volatility']:+.2%} volatility")


def bucket_facts(result: dict) -> dict[str, str]:
    """Python-written rationale: window, role of each bucket and cross-bucket trade-offs."""
    prefs = result['preferences']
    facts = {'bucket.window': (
        f"Your stated needs: emphasis {prefs['emphasis'].replace('_', ' ')}; maximum annual volatility "
        f"{_limit(prefs['max_volatility'])}; minimum historical expected return "
        f"{_limit(prefs['min_expected_return'])}. The unchanged efficient frontier spans "
        f"{result['frontier_range']['min_volatility']:.2%} to {result['frontier_range']['max_volatility']:.2%} "
        f"volatility.")}
    if result['status'] != 'ok':
        closest = result['closest']
        facts['bucket.infeasible'] = (
            REASONS[result['reason']] + f" The closest sampled frontier point (index {closest['frontier_index']}) has "
            f"historical expected return {closest['expected_return']:.4%} and volatility {closest['volatility']:.4%}; "
            'no portfolio was invented to meet the request.')
        return facts
    buckets = result['buckets']
    for name, bucket in buckets.items():
        facts[f'bucket.{name}.summary'] = _metrics(name.title() + f' bucket (frontier point {bucket["frontier_index"]})', bucket)
        facts[f'bucket.{name}.weights'] = _weights(name.title() + ' bucket', bucket['weights'])
        if bucket['warnings']:
            facts[f'bucket.{name}.warnings'] = name.title() + ' bucket: ' + ' '.join(
                WARNINGS[code] for code in bucket['warnings'])
    for name, other in (('conservative', 'balanced'), ('growth', 'balanced')):
        a, b = buckets[name], buckets[other]
        facts[f'bucket.{name}.why'] = (
            f"{name.title()} is {BUCKET_ROLES[name]}. Versus Balanced it changes historical "
            f"{_delta(a, b)} (Sharpe {a['sharpe_ratio'] - b['sharpe_ratio']:+.4f}).")
    facts['bucket.balanced.why'] = f"Balanced has {BUCKET_ROLES['balanced']} (Sharpe {buckets['balanced']['sharpe_ratio']:.4f})."
    recommended = result['recommended']
    facts['bucket.recommended'] = (
        f"{recommended.title()} matches your stated emphasis ({prefs['emphasis'].replace('_', ' ')}). "
        'This is a match to the stated preference over historical data, not personalized advice.')
    return facts


def mandatory_facts(facts: dict[str, str]) -> list[str]:
    return [f'profile.{name}.summary' for name in ('low', 'medium', 'high')] + [
        key for key in facts
        if key.endswith('.warnings') or key in ('allocation', 'bucket.window', 'bucket.infeasible')
        or (key.startswith('bucket.') and key.endswith('.summary'))
    ]


def default_plan(facts: dict[str, str] | None = None) -> dict[str, Any]:
    ids = [f'profile.{name}.selection' for name in ('low', 'medium', 'high')]
    if facts:
        ids += [key for key in ('bucket.recommended', 'bucket.conservative.why',
                                'bucket.balanced.why', 'bucket.growth.why') if key in facts]
    return {'status': 'supported', 'fact_ids': ids}


def render_explanation(plan: dict, facts: dict[str, str], metadata: dict) -> dict:
    """Render only known references, always including provenance and warnings."""
    chosen = plan['fact_ids']
    if (plan.get('status') not in ('supported', 'unsupported') or
            not isinstance(chosen, list) or any(not isinstance(key, str) or key not in facts for key in chosen)):
        raise ValueError('Invalid explanation references.')
    ids = list(dict.fromkeys(mandatory_facts(facts) + chosen))
    constraints = metadata['constraints']
    provenance = (
        f"Dataset: {metadata['start_date']} to {metadata['end_date']}; "
        f"{metadata['trading_days']} trading days per year; annual risk-free rate "
        f"{metadata['risk_free_rate']:.2%}. Constraints: fully invested="
        f"{constraints['fully_invested']}, long-only={constraints['long_only']}, "
        f"leverage allowed={constraints['leverage_allowed']}."
    )
    paragraphs = [provenance]
    if plan['status'] == 'unsupported':
        paragraphs.append('That question is outside the supported historical data. The available profile comparison follows.')
    paragraphs.extend(facts[key] for key in ids)
    paragraphs.append(DISCLAIMER)
    return {'text': '\n\n'.join(paragraphs), 'fact_ids': ids,
            'metadata': deepcopy(metadata), 'disclaimer': DISCLAIMER,
            'status': plan['status']}


def explain_offline(payload: dict, allocation: dict | None = None) -> dict:
    tools = AnalysisTools(payload)
    result = render_explanation(default_plan(), build_facts(tools, allocation), tools.get_metadata())
    return {**result, 'mode': 'offline', 'model': None, 'fallback_reason': None}
