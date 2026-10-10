"""Untrusted news context for explanations; no network access lives here.

A live provider is a later, explicitly opted-in implementation of NewsProvider.
News is displayed as attributed context only. It never changes weights, metrics
or bucket selection, and headlines are untrusted text, never instructions.
"""

import re
from dataclasses import asdict, dataclass
from datetime import date
from typing import Protocol
from urllib.parse import urlparse


MAX_ITEMS = 20
MAX_HEADLINE = 200
_CONTROL = re.compile(r'[\x00-\x1f\x7f]')


@dataclass(frozen=True)
class NewsItem:
    ticker: str | None
    headline: str
    source: str
    published: str  # ISO date, YYYY-MM-DD
    url: str

    def to_dict(self) -> dict:
        return asdict(self)


class NewsProvider(Protocol):
    def fetch(self, tickers: list[str]) -> list[NewsItem]: ...


class NoNews:
    """Default provider: offline, returns nothing."""

    def fetch(self, tickers: list[str]) -> list[NewsItem]:
        return []


def _clean(text: str, limit: int) -> str:
    return _CONTROL.sub(' ', text).strip()[:limit]


def sanitize_news(items: list[NewsItem], assets: list[str]) -> list[NewsItem]:
    """Drop malformed items; bound count and length. Never raises on bad news."""
    clean = []
    for item in items[:MAX_ITEMS]:
        try:
            parsed = urlparse(item.url)
            date.fromisoformat(item.published)
            headline, source = _clean(item.headline, MAX_HEADLINE), _clean(item.source, 60)
            valid = (parsed.scheme == 'https' and parsed.netloc and headline and source
                     and (item.ticker is None or item.ticker in assets))
        except (AttributeError, TypeError, ValueError):
            continue
        if valid:
            clean.append(NewsItem(item.ticker, headline, source, item.published, item.url))
    return clean


def news_facts(items: list[NewsItem]) -> dict[str, str]:
    facts = {}
    for index, item in enumerate(items):
        subject = item.ticker or 'Market'
        facts[f'news.{index}'] = (f'News context ({subject}; {item.source}, {item.published}): '
                                  f'"{item.headline}" <{item.url}>. Not a forecast and not used '
                                  f'in any calculation.')
    return facts
