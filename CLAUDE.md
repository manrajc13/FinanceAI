# FinanceAI

Deterministic Markowitz MPT baseline (`src/`) with a downstream agent layer (`agent/`) that selects and explains portfolios from the efficient frontier. An API (`api/`) and React GUI (`gui/`) are planned and not yet built.

@AGENTS.md

The imported `AGENTS.md` is the binding contract (financial assumptions, module ownership, boundaries). `ROADMAP.md` tracks status and the next milestones. This file only adds working notes.

## Commands

Run from the repo root with `.venv` active (`source .venv/bin/activate`; agent extras: `pip install -r agent/requirements.txt`).

```bash
python -m pytest -q                       # all tests; offline, synthetic fixtures
python -m src.main                        # baseline CLI + plot
python -m agent                           # three fixed risk profiles (offline)
python -m agent --emphasis higher_return --max-volatility 0.25   # needs-driven buckets
python -m agent --amount 10000 --currency USD --profile medium   # allocation
python -m agent --explain                 # grounded explanation, offline
python -m agent --explain --llm           # Groq call; needs GROQ_API_KEY in .env
git diff --check
```

`python -m src.download_data` is the only command that touches the network; never run it (or `--overwrite`) unless asked.

## Architecture

- `src/`: baseline math, reads the frozen Parquet in `data/raw`. No network, no LLM, no import from `agent/`.
- `agent/profiles.py`: fixed low/medium/high profiles from the frontier.
- `agent/preferences.py`: `Preferences` → conservative/balanced/growth buckets; frontier points are returned unchanged, infeasible limits return the closest point.
- `agent/tools.py`: four read-only tools over a deep-copied payload.
- `agent/explainer.py`: builds Python-written facts (profiles, assets, frontier, buckets, news); the renderer outputs only selected fact IDs plus mandatory provenance, warnings and disclaimer.
- `agent/provider.py`: Groq Responses adapter, at most two requests per explanation; the model returns fact IDs only, never prose.
- `agent/guardrails.py`: validates the plan and the exact rendered text.
- `agent/graph.py`: `run_agent()` orchestration (LangGraph if installed, otherwise sequential); the single entry point for consumers.
- `agent/news.py`: provider interface, sanitiser and offline default. No live provider exists yet.

## Conventions and gotchas

- The model may select fact IDs; it must never write numbers or prose that reaches the user. Add new user-visible content as a Python-generated fact, not as model output.
- News and user questions are untrusted. Never put credentials, provider error bodies or `dataset_path` in outputs or model-bound data.
- Rates and weights are decimals (`0.25` = 25%); format percentages only at display time.
- Existing tests assert exact call kwargs and output shapes (for example `run_agent` forwarding in `tests/agent/test_cli.py`). Make new options additive so default output is unchanged.
- Agent tests block sockets via `tests/agent/conftest.py`; keep new tests offline with injected fake providers.
- Optional dependencies go in `agent/requirements.txt` only. `.env` stays git-ignored.
- Commit in small validated steps on `feature/ai-agentic-features`, only when asked. Update `README.md` and `ROADMAP.md` when supported behaviour changes.
