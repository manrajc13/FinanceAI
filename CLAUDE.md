# FinanceAI

Deterministic Markowitz MPT baseline (`src/`) with a downstream agent layer (`agent/`) that selects and explains portfolios from the efficient frontier, a FastAPI service (`api/`), display analytics (`analytics/`) and a Next.js dashboard (`gui/`). `plan.md` is the implementation plan for the API, dashboard and deployment.

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
uvicorn api.main:app --reload --port 8000 # API (pip install -r api/requirements.txt)
cd gui && npm run dev                     # dashboard on :3000, proxies /api to :8000
cd gui && npm test && npm run e2e         # unit tests; e2e needs API + dev server running
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
- API: every response goes through `api.sanitize.public()` (agent payloads must keep `dataset_path` internally). Catch agent `ValueError`s with `api.errors.domain_errors()`, never globally.
- `gui/` uses Next.js 16 with Cache Components: client views that query the API sit behind `<Suspense>`, hidden routes stay mounted (close modals in effect cleanup), and `npm run gen:api` must be re-run after API schema changes.
- Commit in small validated steps on `feature/ai-agentic-features`, only when asked. Update `README.md` and `ROADMAP.md` when supported behaviour changes.
