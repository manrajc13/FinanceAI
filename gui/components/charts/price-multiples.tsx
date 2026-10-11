"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { Schemas } from "@/lib/api/client";
import { dateLong, pct } from "@/lib/format";
import { TooltipBox } from "./chart-tooltip";

/** Ten tickers → small multiples on one shared log scale (rebased to 100) instead of ten colored lines. */
export function PriceMultiples({ data, names }: { data: Schemas["PriceHistoryResponse"]; names: Record<string, string> }) {
  const domain = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of data.series) {
      for (const ticker of data.assets) {
        const value = Number(row[ticker]);
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    return [min * 0.95, max * 1.05] as [number, number];
  }, [data]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {data.assets.map((ticker) => {
        const series = data.series.map((row) => ({ date: String(row.date), value: Number(row[ticker]) }));
        const last = series[series.length - 1]?.value ?? 100;
        return (
          <div key={ticker} className="rounded-xl border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-text" title={names[ticker]}>{ticker}</span>
              <span className={`tabular text-xs font-semibold ${last >= 100 ? "text-positive" : "text-negative"}`}>
                {pct(last / 100 - 1, { sign: true, digits: 0 })}
              </span>
            </div>
            <div className="mt-2 h-20" role="img" aria-label={`${ticker} rebased price, ${pct(last / 100 - 1, { sign: true })} over the range`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <YAxis hide scale="log" domain={domain} allowDataOverflow />
                  <Tooltip
                    cursor={{ stroke: "var(--chart-axis)" }}
                    content={({ active, payload }) => {
                      const point = active && (payload?.[0]?.payload as { date: string; value: number } | undefined);
                      if (!point) return null;
                      return <TooltipBox title={`${ticker} · ${dateLong(point.date)}`} rows={[{ label: "Rebased", value: point.value.toFixed(1) }]} />;
                    }}
                  />
                  <Area type="linear" dataKey="value" stroke="var(--series-blue)" strokeWidth={2} fill="var(--series-blue)"
                    fillOpacity={0.08} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
