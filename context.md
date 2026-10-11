# FinanceAI: Project Context and Agent Architecture

## 1. High-Level Understanding

FinanceAI is a B.Tech major project that implements a transparent, deterministic
Markowitz Modern Portfolio Theory (MPT) baseline and a downstream explanation
layer. Its purpose is to turn a frozen sample of historical stock prices into
auditable portfolio alternatives, then present those alternatives as relative
risk profiles, monetary targets, and grounded explanations.

The product is deliberately not a trading system, a forecasting system, or an
unrestricted financial chatbot. Historical expected returns are estimates from
the sample, not predictions. The project does not place trades, calculate whole
share counts, perform currency conversion, provide personalized investment
advice, or use an LLM to calculate financial values.

The current implementation has three completed layers:

1. **Deterministic MPT baseline (`src/`)**
   - Downloads adjusted prices explicitly from Yahoo Finance.
   - Freezes the validated data in a local Parquet file.
   - Runs offline analysis against that local file.
   - Calculates returns, covariance, portfolio metrics, GMV, Maximum Sharpe,
     and a sampled efficient frontier.
   - Exposes the structured integration boundary
     `src.pipeline.run_mpt_analysis().to_dict()`.

2. **Deterministic portfolio product logic (`agent/`)**
   - Selects low, medium, and high relative-risk profiles from existing frontier
     points.
   - Selects needs-driven conservative, balanced, and growth buckets within a
     user's risk/return window.
   - Converts an amount into exact fractional monetary targets without changing
     the source weights.
   - Produces a reconciled display representation for cents or paise.

3. **Grounded agent explanation layer (`agent/`)**
   - Builds a catalogue of Python-generated facts from the validated snapshot.
   - Optionally asks Groq's Responses API to select relevant fact IDs.
   - Renders all user-visible financial text in Python.
   - Validates both the model's reference plan and the exact rendered output.
   - Falls back to a deterministic offline explanation when optional LLM use is
     unavailable or fails.

The API and GUI are planned but not implemented. The roadmap also reserves
future work for whole-share allocation, backtesting, sensitivity analysis, and
other research features.

## 2. Product Boundaries and Trust Model

The project has a one-way dependency direction:

```text
explicit Yahoo download
        |
        v
frozen data/raw/stock_prices.parquet
        |
        v
src/ deterministic MPT pipeline
        |
        | run_mpt_analysis().to_dict()
        v
agent/ profile, allocation, tools, explanation and guardrails
        |
        v
optional API / GUI (future)
```

The important boundary is that `src/` never imports the agent layer. The
baseline owns all numerical assumptions and calculations. The agent layer may
consume baseline results and call pure portfolio evaluators for validation, but
it must not silently alter weights, constraints, expected returns, covariance,
or the configured risk-free rate.

The data and output trust model is similarly explicit:

- Yahoo Finance is used only by `src/download_data.py`, and only when that
  command is run explicitly.
- Analysis below the acquisition step is offline and reads the frozen local
  dataset.
- The LLM receives approved facts and read-only tool results, not authority to
  create portfolios or write financial prose.
- Questions and news are untrusted input. They cannot change calculations or
  relax the agent's rules.
- Provider errors, credentials, local dataset paths, raw SDK output, and raw
  model prose are not copied into user-facing JSON.

## 3. Deterministic MPT Baseline

### Inputs and assumptions

The baseline is configured in `src/config.py` for ten US large-cap stocks, a
historical window beginning 2021-01-01 and ending before 2026-01-01, 252 trading
days per year, a 4% annual risk-free rate, and 50 sampled frontier points.

The financial method is:

- daily simple returns, not log returns;
- historical arithmetic mean returns, annualized by 252;
- sample covariance, annualized by 252;
- fully invested weights that sum to 1;
- long-only weights between 0 and 1;
- no leverage or short selling;
- Sharpe ratio based on the configured risk-free rate.

### Execution path

`src.pipeline.run_mpt_analysis()` is the supported programmatic entry point.
It loads local prices through `src.data_loader`, computes daily returns through
`src.returns`, and produces annual expected returns and covariance. It then:

1. Optimizes the global minimum-variance portfolio.
2. Optimizes the maximum-Sharpe portfolio.
3. Generates the efficient upper frontier using constrained target-return
   optimization, reusing the already-computed GMV weights.
4. Packages metadata, matrices, optimized portfolios, and frontier points in
   `MPTAnalysisResult`.
5. Converts the result to a JSON-compatible dictionary when `.to_dict()` is
   called.

The resulting payload contains `metadata`, `annual_expected_returns`,
`annual_covariance`, `portfolios`, and `efficient_frontier`. Frontier points
carry ticker-keyed weights, expected return, variance, volatility, and target
return. Sharpe for frontier candidates is intentionally computed downstream by
the agent using the baseline portfolio evaluator rather than changing the
baseline payload schema.

## 4. Agent Package at a Glance

The `agent/` package is a consumer and presentation layer over one validated
analysis snapshot.

| Module | Responsibility |
| --- | --- |
| `agent/__main__.py` | CLI validation and dispatch for profiles, allocation, preferences, and explanations |
| `agent/cache.py` | Process-local cached snapshot with file-stat invalidation |
| `agent/profiles.py` | Deterministic low/medium/high profile selection and diagnostics |
| `agent/preferences.py` | Deterministic conservative/balanced/growth bucket selection |
| `agent/allocation.py` | Exact fractional monetary targets from unchanged weights |
| `agent/formatting.py` | Display-only minor-unit rounding and dust grouping |
| `agent/tools.py` | Four read-only operations over a detached snapshot |
| `agent/explainer.py` | Python-generated facts, default plan, and deterministic renderer |
| `agent/news.py` | Optional untrusted news interface, sanitization, and fact conversion |
| `agent/provider.py` | Bounded Groq Responses adapter and model-plan validation |
| `agent/guardrails.py` | Schema checks and exact rendered-output verification |
| `agent/graph.py` | End-to-end orchestration with LangGraph or sequential fallback |
| `agent/prompts/system.md` | Model policy and reference-plan instructions |

## 5. Deep Dive: `run_agent()` Architecture

`agent.graph.run_agent()` is the main consumer entry point. It accepts an
optional payload or loads the cached local analysis, plus optional amount,
currency, profile, preferences, question, provider, and news provider inputs.
LLM use is opt-in through `use_llm=True`; an injected provider is ignored in
offline mode.

Before graph execution, it validates the question length and ensures that a
question cannot be supplied without explicit LLM mode. Allocation inputs are
also validated before any nodes run. Baseline and allocation failures propagate
to the caller; only explanation failures are designed to fall back.

### State contract

The graph uses `AgentState`, a typed dictionary containing the progressively
assembled values:

```text
payload -> tools -> profiles
                 |       |
                 |       +-> allocation
                 |
                 +-> buckets
                 +-> news / news_status
                         |
                         v
                    facts -> plan -> result
```

The state includes the final explanation mode, selected model, fallback reason,
and recorded tool calls. It does not contain credentials or raw provider
responses.

### Nodes and responsibilities

#### 1. `load_analysis`

Loads a deep copy of the caller-supplied payload, or calls
`agent.cache.load_analysis()`. The cache delegates computation to
`run_mpt_analysis().to_dict()` and keys its process-local entry by the frozen
Parquet file's path, modification time, and size. Each call receives an
isolated copy so later code cannot mutate the cached snapshot.

#### 2. `build_profiles`

Creates `AnalysisTools` around the payload and materializes the three fixed
profiles. `AnalysisTools` itself deep-copies the payload and calls
`select_profiles()`.

`agent.profiles.select_profiles()` validates asset identity, provenance,
frontier metrics, monotonicity, and portfolio consistency before selecting:

- **low:** the first sampled frontier point, the lowest-volatility point;
- **medium:** the sampled point nearest the exact Maximum Sharpe portfolio's
  volatility;
- **high:** an interior point at or above medium nearest the midpoint between
  Maximum Sharpe volatility and the frontier endpoint.

The profiles retain the original frontier weights. The selector only adds
provenance, recomputed Sharpe, concentration flags, material-holding counts,
overlap warnings, and the historical-estimate disclaimer. A profile can overlap
another profile, and high may reuse medium when no distinct interior choice is
available.

#### 3. `select_buckets`

This node runs only when a `Preferences` object was supplied. Preferences can
specify an emphasis (`lower_risk`, `balanced`, or `higher_return`), a maximum
annual volatility, and/or a minimum expected return.

`select_buckets()` filters the existing frontier to a contiguous feasible
window. It then chooses conservative as the lowest-risk point, balanced as the
highest-Sharpe point, and growth as the higher-return end of the window under
the documented endpoint rule. No interpolation or new optimization occurs.
If the constraints are infeasible, it returns the closest sampled point and an
explicit reason rather than inventing a portfolio.

#### 4. `fetch_news`

News is optional and injected through a `NewsProvider`; there is no live news
provider in the current repository. When present, the provider receives only
the asset tickers from metadata. Results are sanitized by `agent.news`:
maximum item count and headline length are enforced, control characters are
removed, dates must be ISO dates, URLs must be HTTPS, and tickers must belong
to the known asset universe.

News is context only. It never affects profile selection, bucket selection,
allocation, metrics, or weights. Provider failure is non-fatal and produces an
`unavailable` status. News facts explicitly say they are not forecasts and are
not used in calculations.

#### 5. `allocate`

When an amount is provided, `agent.allocation.allocate_amount()` validates a
positive finite amount with at most two decimal places and a USD or INR label.
The currency label does not perform FX conversion. The selected profile is
revalidated from the payload, then each target is calculated as:

```text
target amount for ticker = input amount * unchanged profile weight
```

Decimal arithmetic preserves exact monetary targets and records numerical
residual separately. `agent.formatting` creates a display-only view using
largest-remainder rounding to cents or paise. Optional dust grouping hides
small holdings only in that view; it never changes target weights, metrics, or
the precise target amounts. This is fractional allocation, not executable
trading and not whole-share allocation.

#### 6. `explain`

`agent.explainer.build_facts()` creates a catalogue of Python-written strings
for profile metrics and rules, asset statistics, every frontier point, optional
allocation data, bucket rationale, and sanitized news.

The node first creates a deterministic `default_plan()`. In offline mode this
plan is used directly and the result is marked `mode: offline`.

With LLM mode enabled, the node uses an injected provider or constructs
`GroqExplainer.from_environment()`. The provider reads `GROQ_API_KEY` and an
optional `GROQ_MODEL` from the environment or repository `.env`; the default
model is `openai/gpt-oss-20b` at Groq's OpenAI-compatible Responses endpoint.

The provider is bounded as follows:

- at most two requests per explanation;
- no SDK retries;
- 30-second request timeout;
- at most four read-only tool calls;
- tool retrieval and structured output use separate requests.

For a follow-up question, the first request may request tools. Each tool call
is parsed as JSON and dispatched through `AnalysisTools.dispatch()`. Only
exactly supported operation names and argument sets are accepted. Frontier
facts are added to the model's available catalogue only when the model asks
for those specific frontier points.

The second request asks for a strict JSON reference plan. The model returns
fact IDs and a support status, never final prose. The plan is validated before
it is accepted. Any provider, dependency, authentication, rate-limit,
invalid-tool, invalid-plan, or unexpected explanation error produces a labeled
fallback rather than exposing raw error content.

#### 7. `guardrail`

The guardrail node validates the plan again, renders the explanation from the
approved fact IDs, and validates the complete rendered object against a fresh
deterministic render.

`render_explanation()` always includes:

- dataset dates and trading-day annualization;
- the annual risk-free rate;
- fully-invested, long-only, and leverage constraints;
- all three profile summaries;
- applicable warnings;
- selected supported facts, or an unsupported-question statement;
- the historical-estimate and non-personalized-advice disclaimer.

`validate_rendered()` catches changed numbers, swapped references, omitted
mandatory content, invented model prose, and altered metadata by comparing the
rendered result with the canonical Python output. The final result also records
profiles, buckets, allocation, sanitized news, explanation mode, provider, and
whether a question was actually answered in supported LLM mode.

## 6. Optional LangGraph Behavior

`run_agent()` attempts to import LangGraph. If it is installed, the seven nodes
are registered in a linear `StateGraph` from `START` to `END`. If it is not
installed, the same node functions are invoked in the same order in a simple
sequential loop.

This makes LangGraph an orchestration detail rather than a product dependency:
the behavior and contracts remain available offline without the framework. The
result identifies the path as either `orchestration: "langgraph"` or
`orchestration: "sequential"`.

## 7. Read-Only Tool Surface

`AnalysisTools` exposes exactly four operations:

- `get_metadata()` for provenance and constraints;
- `get_profile(name)` for low, medium, or high;
- `get_asset_stats(ticker)` for historical return and volatility;
- `get_frontier_point(index)` for a zero-based sampled frontier point.

The dispatcher rejects unknown operations, non-dictionary arguments, extra or
missing arguments, invalid names, and non-string tickers. It never uses dynamic
evaluation. All returned values are detached copies. Tool definitions also
declare closed JSON schemas with `additionalProperties: false`, so the model's
tool access is narrow and inspectable.

## 8. CLI Modes

`python -m agent` is the practical interface for the current product:

```text
no options                  -> low / medium / high profile JSON
--emphasis ...              -> needs-driven bucket JSON
--amount ...                -> fractional allocation JSON
--explain                   -> offline grounded explanation
--explain --llm             -> explicit Groq-backed explanation
--explain --llm --question  -> supported follow-up question flow
```

The CLI enforces combinations such as requiring `--explain` for LLM use and
requiring `--llm` for questions. The baseline CLI, `python -m src.main`, is
separate and prints the MPT summary plus the static frontier figure.

## 9. Tests and Operational Expectations

The test suite is organized around the same ownership boundary:

- `tests/test_*.py` cover returns, portfolio algebra, optimization, local data
  loading, and the pipeline JSON contract.
- `tests/agent/` covers profiles, allocation, formatting, CLI behavior, tools,
  provider behavior, graph behavior, guardrails, preferences, and evaluation
  fixtures.
- Agent tests block sockets and use fake providers, keeping normal validation
  offline.

The repository's required checks are `python -m pytest -v`, `python -m src.main`,
JSON serialization of `run_mpt_analysis().to_dict()`, `git diff --check`, and
`git status`. The data acquisition command is the only network-touching command
and should be run only when explicitly intended.

## 10. Current Gaps and Planned Product Direction

The next intended layer is an API service exposing analysis, profiles,
allocation, explanation, and health endpoints. A React GUI is planned after
the contracts stabilize. Planned research work includes out-of-sample
backtesting and sensitivity analysis.

Important intentionally missing capabilities are whole-share trading support,
live prices, FX conversion, unrestricted RAG, sentiment-driven decisions,
machine-learning forecasts, short selling, leverage, Monte Carlo simulation,
and advanced covariance estimators. Adding any feature that changes financial
assumptions requires explicit approval, tests, and documentation.

## 11. Source of Truth

The most authoritative project documents are:

- `AGENTS.md` for the engineering and financial contract;
- `README.md` for method, setup, and integration details;
- `ROADMAP.md` for milestone status and planned architecture;
- `CLAUDE.md` for command and architecture notes;
- `agent/prompts/system.md` for the model's constrained role.

The implementation described here is centered on
`agent.graph.run_agent()` and the structured contract returned by
`src.pipeline.run_mpt_analysis().to_dict()`.