"use client";

import { useMemo, type ReactNode } from "react";
import {
  CartesianGrid, ComposedChart, LabelList, Line, ReferenceArea, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Schemas } from "@/lib/api/client";
import { pct, ratio } from "@/lib/format";
import { PROFILE_LABELS, type ProfileName } from "@/lib/labels";
import { AXIS_TICK, TooltipBox } from "./chart-tooltip";

export type MarkerKind = "frontier" | "asset" | "gmv" | "max_sharpe" | "profile" | "bucket";

export type ChartPoint = {
  kind: MarkerKind;
  label: string;
  short?: string;
  index?: number;
  volatility: number;
  expected_return: number;
  sharpe_ratio?: number;
  weights?: Record<string, number>;
  highlight?: boolean;
};

export type BucketMarker = { name: string; label: string; index: number; recommended: boolean };

const BLUE = "var(--series-blue)";
const PROFILE = "var(--series-orange)";
const BUCKET = "var(--series-aqua)";
const INK = "var(--text)";
const ASSET = "var(--chart-ink-muted)";

function topWeights(weights: Record<string, number> | undefined, count = 5) {
  if (!weights) return [];
  return Object.entries(weights).filter(([, w]) => w > 0.0005).sort((a, b) => b[1] - a[1]).slice(0, count);
}

type ShapeProps = { cx?: number; cy?: number; payload?: ChartPoint };

function Dot({ cx = 0, cy = 0, r, fill, ring = true }: { cx?: number; cy?: number; r: number; fill: string; ring?: boolean }) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={ring ? "#fff" : "none"} strokeWidth={2} />;
}

function Diamond({ cx = 0, cy = 0 }: ShapeProps) {
  return <path d={`M ${cx} ${cy - 7} L ${cx + 7} ${cy} L ${cx} ${cy + 7} L ${cx - 7} ${cy} Z`} fill={INK} stroke="#fff" strokeWidth={2} />;
}

function Star({ cx = 0, cy = 0 }: ShapeProps) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 8.5 : 3.8;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={points} fill={INK} stroke="#fff" strokeWidth={1.5} />;
}

export function FrontierChart({ frontier, buckets = [], window, selected, onSelect, height = 380 }: {
  frontier: Schemas["FrontierResponse"];
  buckets?: BucketMarker[];
  window?: { first: number; last: number } | null;
  selected?: number | null;
  onSelect?: (index: number) => void;
  height?: number;
}) {
  const data = useMemo(() => {
    const points: ChartPoint[] = frontier.points.map((p) => ({
      kind: "frontier", label: `Frontier point ${p.index}`, index: p.index, volatility: p.volatility,
      expected_return: p.expected_return, sharpe_ratio: p.sharpe_ratio, weights: p.weights, highlight: p.index === selected,
    }));
    const assets: ChartPoint[] = frontier.assets.map((a) => ({
      kind: "asset", label: `${a.ticker} · ${a.name}`, short: a.ticker, volatility: a.volatility, expected_return: a.expected_return,
    }));
    const profiles: ChartPoint[] = (Object.entries(frontier.profiles) as [ProfileName, number][]).map(([name, index]) => {
      const p = frontier.points[index];
      return { kind: "profile", label: `${PROFILE_LABELS[name]} profile`, short: PROFILE_LABELS[name][0], index,
        volatility: p.volatility, expected_return: p.expected_return, sharpe_ratio: p.sharpe_ratio, weights: p.weights };
    });
    const bucketPoints: ChartPoint[] = buckets.map((b) => {
      const p = frontier.points[b.index];
      return { kind: "bucket", label: `${b.label} bucket${b.recommended ? " (recommended)" : ""}`, short: b.label[0], index: b.index,
        volatility: p.volatility, expected_return: p.expected_return, sharpe_ratio: p.sharpe_ratio, weights: p.weights, highlight: b.recommended };
    });
    const gmv: ChartPoint = { kind: "gmv", label: "Global minimum variance", volatility: frontier.gmv.volatility,
      expected_return: frontier.gmv.expected_return, sharpe_ratio: frontier.gmv.sharpe_ratio, weights: frontier.gmv.weights };
    const maxSharpe: ChartPoint = { kind: "max_sharpe", label: "Maximum Sharpe (exact optimum)", volatility: frontier.max_sharpe.volatility,
      expected_return: frontier.max_sharpe.expected_return, sharpe_ratio: frontier.max_sharpe.sharpe_ratio, weights: frontier.max_sharpe.weights };
    return { points, assets, profiles, bucketPoints, gmv: [gmv], maxSharpe: [maxSharpe] };
  }, [frontier, buckets, selected]);

  const handleClick = (item: unknown) => {
    const point = (item as { payload?: ChartPoint })?.payload;
    if (point?.index !== undefined && onSelect) onSelect(point.index);
  };

  const windowArea = window && frontier.points[window.first] && frontier.points[window.last]
    ? { x1: frontier.points[window.first].volatility, x2: frontier.points[window.last].volatility } : null;

  return (
    <div style={{ height }} role="img" aria-label="Efficient frontier: expected return against volatility, with individual stocks, GMV, Maximum Sharpe and the three profiles marked.">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data.points} margin={{ top: 16, right: 24, bottom: 20, left: 4 }}>
          <CartesianGrid stroke="var(--chart-grid)" />
          <XAxis dataKey="volatility" type="number" domain={[0, "auto"]} tickFormatter={(v: number) => pct(v, { digits: 0 })}
            tick={AXIS_TICK} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={false}
            label={{ value: "Annual volatility (risk)", position: "insideBottom", offset: -12, fill: "var(--chart-ink-muted)", fontSize: 11 }} />
          <YAxis dataKey="expected_return" type="number" domain={[0, "auto"]} tickFormatter={(v: number) => pct(v, { digits: 0 })}
            tick={AXIS_TICK} axisLine={false} tickLine={false} width={48}
            label={{ value: "Annual return", angle: -90, position: "insideLeft", offset: 10, fill: "var(--chart-ink-muted)", fontSize: 11 }} />
          {windowArea && (
            <ReferenceArea x1={windowArea.x1} x2={windowArea.x2} fill="var(--series-aqua)" fillOpacity={0.08}
              stroke="var(--series-aqua)" strokeOpacity={0.4} strokeDasharray="4 4" ifOverflow="extendDomain" />
          )}
          <Tooltip
            shared={false}
            cursor={false}
            content={({ active, payload }) => {
              const point = active && (payload?.[0]?.payload as ChartPoint | undefined);
              if (!point) return null;
              const rows = [
                { label: "Return", value: pct(point.expected_return) },
                { label: "Volatility", value: pct(point.volatility) },
                ...(point.sharpe_ratio !== undefined ? [{ label: "Sharpe", value: ratio(point.sharpe_ratio) }] : []),
                ...topWeights(point.weights).map(([ticker, weight]) => ({ label: ticker, value: pct(weight) })),
              ];
              return <TooltipBox title={point.label} rows={rows}
                footer={point.kind === "frontier" && onSelect ? "Click to pin this point" : point.kind === "asset" ? "Single stock (100% weight)" : undefined} />;
            }}
          />
          <Line dataKey="expected_return" stroke={BLUE} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
          <Scatter data={data.points} onClick={handleClick} isAnimationActive={false}
            shape={(props: ShapeProps) => (
              <g style={{ cursor: onSelect ? "pointer" : "default" }}>
                <circle cx={props.cx} cy={props.cy} r={9} fill="transparent" />
                <Dot cx={props.cx} cy={props.cy} r={props.payload?.highlight ? 6 : 3} fill={props.payload?.highlight ? INK : BLUE} ring={!!props.payload?.highlight} />
              </g>
            )} />
          <Scatter data={data.assets} isAnimationActive={false} shape={(props: ShapeProps) => <Dot cx={props.cx} cy={props.cy} r={4} fill={ASSET} />}>
            <LabelList dataKey="short" position="right" offset={6} style={{ fill: "var(--text-muted)", fontSize: 10, fontWeight: 600 }} />
          </Scatter>
          <Scatter data={data.bucketPoints} onClick={handleClick} isAnimationActive={false}
            shape={(props: ShapeProps) => <Dot cx={props.cx} cy={props.cy} r={props.payload?.highlight ? 8 : 6} fill={BUCKET} />}>
            <LabelList dataKey="short" position="bottom" offset={8} style={{ fill: "var(--text)", fontSize: 11, fontWeight: 700 }} />
          </Scatter>
          <Scatter data={data.profiles} onClick={handleClick} isAnimationActive={false}
            shape={(props: ShapeProps) => <Dot cx={props.cx} cy={props.cy} r={6} fill={PROFILE} />}>
            <LabelList dataKey="short" position="top" offset={8} style={{ fill: "var(--text)", fontSize: 11, fontWeight: 700 }} />
          </Scatter>
          <Scatter data={data.gmv} isAnimationActive={false} shape={(props: ShapeProps) => <Diamond {...props} />} />
          <Scatter data={data.maxSharpe} isAnimationActive={false} shape={(props: ShapeProps) => <Star {...props} />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FrontierLegend({ showBuckets = false, showWindow = false }: { showBuckets?: boolean; showWindow?: boolean }) {
  const item = (marker: ReactNode, label: string) => (
    <li className="flex items-center gap-1.5">{marker}<span>{label}</span></li>
  );
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-700">
      {item(<svg width="18" height="8" aria-hidden><line x1="1" y1="4" x2="17" y2="4" stroke={BLUE} strokeWidth="2" /></svg>, "Efficient frontier")}
      {item(<svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="5" fill={PROFILE} /></svg>, "Profiles (C / B / G)")}
      {showBuckets && item(<svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="5" fill={BUCKET} /></svg>, "Your buckets")}
      {item(<svg width="12" height="12" aria-hidden><path d="M6 0 L12 6 L6 12 L0 6 Z" fill={INK} /></svg>, "GMV")}
      {item(<svg width="14" height="14" aria-hidden><polygon points="7,0 8.8,5 14,5 9.8,8.3 11.3,13.5 7,10.4 2.7,13.5 4.2,8.3 0,5 5.2,5" fill={INK} /></svg>, "Max Sharpe")}
      {item(<svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4" fill={ASSET} /></svg>, "Single stocks")}
      {showWindow && item(<span aria-hidden className="h-3 w-4 rounded-sm border border-dashed" style={{ borderColor: BUCKET, background: "rgba(27,175,122,0.08)" }} />, "Your feasible window")}
    </ul>
  );
}
