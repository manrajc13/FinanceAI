"use client";

import { useId, useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Schemas } from "@/lib/api/client";
import { dateLong, money, moneyCompact, pct, year, type Currency } from "@/lib/format";
import { AXIS_TICK, LegendKey, TooltipBox } from "./chart-tooltip";

type Point = { date: string; t: number; value: number; benchmark: number | null };

const BLUE = "var(--series-blue)";
const BENCH = "var(--chart-ink-muted)";

export function PerformanceChart({ data, currency, showBenchmark, height = 300 }: {
  data: Schemas["PerformanceResponse"]; currency: Currency; showBenchmark: boolean; height?: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  const points: Point[] = useMemo(
    () => data.series.map((row) => ({
      date: row.date,
      t: Date.parse(`${row.date}T00:00:00Z`),
      value: Number(row.value),
      benchmark: row.benchmark === null ? null : Number(row.benchmark),
    })),
    [data.series],
  );
  const start = points[0]?.value ?? 1;
  const yearTicks = useMemo(() => {
    const seen = new Set<string>();
    return points.filter((p) => !seen.has(year(p.date)) && seen.add(year(p.date))).map((p) => p.t);
  }, [points]);
  const benchmarkOn = showBenchmark && data.benchmark !== null;

  return (
    <div>
      {benchmarkOn && (
        <div className="mb-2">
          <LegendKey items={[{ label: "Selected profile", color: BLUE }, { label: "Equal-weight benchmark", color: BENCH, dashed: true }]} />
        </div>
      )}
      <div style={{ height }} role="img" aria-label={`Simulated value from ${money(data.summary.start_value, currency)} to ${money(data.summary.end_value, currency)} between ${dateLong(data.start_date)} and ${dateLong(data.end_date)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-blue)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--series-blue)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} ticks={yearTicks}
              tickFormatter={(t: number) => String(new Date(t).getUTCFullYear())} tick={AXIS_TICK}
              axisLine={{ stroke: "var(--chart-axis)" }} tickLine={false} tickMargin={10} />
            <YAxis tickFormatter={(v: number) => moneyCompact(v, currency)} tick={AXIS_TICK} axisLine={false}
              tickLine={false} width={64} domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = active && payload?.[0]?.payload as Point | undefined;
                if (!point) return null;
                return (
                  <TooltipBox
                    title={dateLong(point.date)}
                    rows={[
                      { label: "Profile", value: money(point.value, currency), color: BLUE },
                      ...(benchmarkOn && point.benchmark !== null
                        ? [{ label: "Equal weight", value: money(point.benchmark, currency), color: BENCH }] : []),
                      { label: "Since start", value: pct(point.value / start - 1, { sign: true }) },
                    ]}
                  />
                );
              }}
            />
            <Area type="linear" dataKey="value" stroke={BLUE} strokeWidth={2} fill={`url(#${gradientId})`}
              dot={points.length <= 30 ? { r: 4, fill: "#fff", stroke: BLUE, strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: BLUE, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
            {benchmarkOn && (
              <Line type="linear" dataKey="benchmark" stroke={BENCH} strokeWidth={2} strokeDasharray="4 4" dot={false}
                activeDot={{ r: 4, fill: BENCH, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
