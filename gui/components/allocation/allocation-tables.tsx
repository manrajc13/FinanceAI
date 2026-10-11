"use client";

import { useState } from "react";
import type { Schemas } from "@/lib/api/client";
import { money, pct, type Currency } from "@/lib/format";
import { groupColor } from "@/lib/labels";

export function AllocationTable({ allocation }: { allocation: Schemas["AllocationResponse"] }) {
  const currency = allocation.currency as Currency;
  const display = allocation.display;
  const rows = allocation.breakdown.by_ticker.filter((row) => display.amounts[row.ticker] !== undefined);
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-2 pr-3 font-semibold">Stock</th>
            <th className="py-2 pr-3 font-semibold">Group</th>
            <th className="py-2 pr-3 text-right font-semibold">Weight</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ticker} className="border-b border-border">
              <td className="py-2.5 pr-3"><span className="font-semibold">{row.ticker}</span><span className="ml-2 text-xs text-muted">{row.name}</span></td>
              <td className="py-2.5 pr-3">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: groupColor(row.group) }} />{row.group}</span>
              </td>
              <td className="tabular py-2.5 pr-3 text-right">{pct(row.weight, { digits: 2 })}</td>
              <td className="tabular py-2.5 text-right font-semibold">{money(display.amounts[row.ticker], currency, 2)}</td>
            </tr>
          ))}
          {display.hidden_assets.length > 0 && (
            <tr className="border-b border-border text-muted">
              <td className="py-2.5 pr-3" colSpan={3}>Small holdings below 0.5% ({display.hidden_assets.join(", ")})</td>
              <td className="tabular py-2.5 text-right">{money(display.hidden_amount, currency, 2)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-bold" colSpan={3}>Total</td>
            <td className="tabular pt-3 text-right font-bold">{money(display.total, currency, 2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function RoundingAudit({ allocation }: { allocation: Schemas["AllocationResponse"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm font-semibold text-primary hover:underline">
        {open ? "Hide" : "Show"} exact targets and rounding audit
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="overflow-x-auto">
            <table className="tabular w-full min-w-[560px] text-xs">
              <thead><tr className="border-b border-border text-left text-muted">
                <th className="py-1.5 pr-3">Ticker</th><th className="py-1.5 pr-3 text-right">Exact target</th><th className="py-1.5 text-right">Rounding adjustment</th>
              </tr></thead>
              <tbody>
                {Object.entries(allocation.target_amounts).map(([ticker, exact]) => (
                  <tr key={ticker} className="border-b border-border">
                    <td className="py-1.5 pr-3 font-semibold">{ticker}</td>
                    <td className="max-w-72 truncate py-1.5 pr-3 text-right" title={exact}>{exact}</td>
                    <td className="py-1.5 text-right">{allocation.display.rounding_adjustments[ticker]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Method: {allocation.display.method.replaceAll("_", " ")}. {allocation.display.notice}</p>
          <p className="text-xs text-muted">Numerical residual (weight-sum drift, not cash): {allocation.numerical_residual}</p>
        </div>
      )}
    </div>
  );
}
