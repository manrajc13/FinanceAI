# FinanceAI dashboard (`gui/`)

Next.js (App Router, TypeScript, Tailwind) frontend for the FinanceAI API. It
formats and visualizes values the API computes; it performs no financial
calculations. See [`../plan.md`](../plan.md) §6 for the full specification.

## Run locally

Start the API first (from `FinanceAI/`, venv active):

```powershell
uvicorn api.main:app --reload --port 8000
```

Then the dashboard (from `FinanceAI/gui`):

```powershell
copy .env.local.example .env.local   # leave NEXT_PUBLIC_API_URL empty locally
npm install
npm run dev                          # http://localhost:3000
```

With `NEXT_PUBLIC_API_URL` unset, `/api/*` is proxied to `API_URL`
(default `http://127.0.0.1:8000`) by `next.config.ts`. When it is set (Vercel),
the browser calls that URL directly and the API's CORS settings must allow the
dashboard origin.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` |
| `npm test` | Vitest unit tests (`tests/`) |
| `npm run e2e` | Playwright smoke tests (`e2e/`) against a running API **and** dev server; `npx playwright install chromium` once |
| `npm run gen:api` | Regenerate `lib/api/schema.d.ts` from the running API's OpenAPI schema; commit the result (CI checks drift) |

## Layout

```text
app/(dashboard)/            pages: Overview, Portfolio, Optimizer, Allocation, Saved plans, AI Explainer, Settings
  <route>/page.tsx          server component: <Suspense> around the client view
  <route>/*-view.tsx        client view (TanStack Query + settings store)
components/shell/           sidebar, page header, API status banner, assumptions footer
components/charts/          performance, donut, frontier, correlation heatmap, price small multiples
components/ui/primitives.tsx  card, button, badge, segmented, switch, tabs, dialog, notes
lib/api/                    generated schema, typed client, query hooks
lib/format.ts               the ONLY place that formats money, percentages and dates
lib/labels.ts               profile labels, warning text, fixed group colors
lib/store/settings.ts       persisted per-browser settings (currency, amount, profile, …)
```

## Rules

- Money arrives as decimal strings and is converted to `Number` only to display or plot; never summed.
- Rates and weights are decimals (`0.25` = 25%); format with `lib/format.ts`.
- Every page shows the assumptions footer (dataset window, 252 days, risk-free rate, constraints, disclaimer).
- With Cache Components, client views that query the API sit behind `<Suspense>`; dialogs close
  themselves when a route is hidden (see `components/ui/primitives.tsx`).
- Chart colors come from the validated categorical slots in `app/globals.css`; group colors are
  fixed per entity and "Other" is neutral gray.
