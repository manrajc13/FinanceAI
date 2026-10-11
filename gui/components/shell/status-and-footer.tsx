"use client";

import { Loader2, WifiOff } from "lucide-react";
import { useState } from "react";
import { useHealth, useMetadata } from "@/lib/api/queries";
import { pct } from "@/lib/format";

export function ApiStatusBanner() {
  const health = useHealth();
  if (health.isSuccess) return null;
  if (health.isError) {
    return (
      <div role="alert" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-negative sm:px-8">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>
          Backend unavailable.
          {process.env.NODE_ENV === "development" && " Start it with `uvicorn api.main:app --reload --port 8000` from FinanceAI/."}
        </span>
        <button type="button" onClick={() => health.refetch()} className="ml-auto font-semibold underline">Retry</button>
      </div>
    );
  }
  return (
    <div role="status" className="flex items-center gap-2 border-b border-primary/15 bg-primary-soft px-4 py-2.5 text-[13px] text-slate-700 sm:px-8">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
      {health.failureCount > 0 ? "Waking up the server… this can take up to a minute." : "Connecting to the server…"}
    </div>
  );
}

/** Mandatory provenance on every page (AGENTS.md): window, annualization, risk-free rate, constraints, disclaimer. */
export function AssumptionsFooter() {
  const { data } = useMetadata();
  const [open, setOpen] = useState(false);
  if (!data) {
    return <footer className="border-t border-border px-4 py-4 text-xs text-muted sm:px-8">Historical estimates, not forecasts or personalized advice.</footer>;
  }
  const c = data.constraints;
  return (
    <footer className="border-t border-border bg-surface px-4 py-4 text-xs leading-relaxed text-muted sm:px-8">
      <p>
        Data {data.start_date} → {data.end_date} · {data.trading_days} trading days/year · risk-free {pct(data.risk_free_rate, { digits: 2 })} ·{" "}
        {c.long_only ? "long-only" : "short selling allowed"}, {c.fully_invested ? "fully invested" : "partially invested"},{" "}
        {c.leverage_allowed ? "leverage allowed" : "no leverage"} · Historical estimates, not forecasts or personalized advice.{" "}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="font-semibold text-primary hover:underline">
          {open ? "Hide details" : "Details"}
        </button>
      </p>
      {open && (
        <dl className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
          <div><dt className="inline font-semibold text-slate-700">Universe: </dt><dd className="inline">{data.assets.join(", ")}</dd></div>
          <div><dt className="inline font-semibold text-slate-700">Observations: </dt><dd className="inline">{data.observations} trading days</dd></div>
          <div><dt className="inline font-semibold text-slate-700">Frontier: </dt><dd className="inline">{data.frontier_point_count} sampled efficient points</dd></div>
          <div><dt className="inline font-semibold text-slate-700">Method: </dt><dd className="inline">Simple daily returns; arithmetic mean and sample covariance annualized ×{data.trading_days}</dd></div>
          <div className="sm:col-span-2"><dt className="inline font-semibold text-slate-700">Disclaimer: </dt><dd className="inline">{data.disclaimer}</dd></div>
          <div className="sm:col-span-2"><dt className="inline font-semibold text-slate-700">Currency: </dt><dd className="inline">{data.currency_notice}</dd></div>
        </dl>
      )}
    </footer>
  );
}
