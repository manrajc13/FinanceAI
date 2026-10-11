"use client";

import clsx from "clsx";
import { useState } from "react";
import { pct } from "@/lib/format";

export type DonutSlice = { key: string; label: string; weight: number; color: string; detail?: string };

function polar(cx: number, cy: number, r: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(radians), y: cy + r * Math.sin(radians) };
}

function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const sweep = Math.min(end - start, 359.999);
  const large = sweep > 180 ? 1 : 0;
  const a = polar(cx, cy, outer, start);
  const b = polar(cx, cy, outer, start + sweep);
  const c = polar(cx, cy, inner, start + sweep);
  const d = polar(cx, cy, inner, start);
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;
}

/** Donut with 2px surface gaps between slices, hover tooltip and an always-present legend. */
export function AllocationDonut({ slices, size = 168, centerLabel = "Allocated", centerValue = "100%", legend = true,
  label = "Allocation" }: {
  slices: DonutSlice[]; size?: number; centerLabel?: string; centerValue?: string; legend?: boolean; label?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const visible = slices.filter((slice) => slice.weight > 1e-9);
  const total = visible.reduce((sum, slice) => sum + slice.weight, 0) || 1;
  const outer = size / 2;
  const inner = outer * 0.68;
  const gapDegrees = visible.length > 1 ? (2 / (2 * Math.PI * outer)) * 360 : 0;
  const spans = visible.map((slice) => (slice.weight / total) * 360);
  const arcs = visible.map((slice, index) => {
    const offset = spans.slice(0, index).reduce((sum, span) => sum + span, 0);
    const start = offset + gapDegrees / 2;
    const end = offset + spans[index] - gapDegrees / 2;
    return { ...slice, d: arcPath(outer, outer, outer, inner, start, Math.max(start + 0.01, end)) };
  });
  const active = visible.find((slice) => slice.key === hover);

  return (
    <div className={clsx("flex flex-col items-center gap-6", legend && "sm:flex-row sm:items-center")}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${visible.map((s) => `${s.label} ${pct(s.weight, { digits: 0 })}`).join(", ")}`}>
          {arcs.map((arc) => (
            <path
              key={arc.key}
              d={arc.d}
              fill={arc.color}
              opacity={hover && hover !== arc.key ? 0.35 : 1}
              onMouseEnter={() => setHover(arc.key)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default transition-opacity"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {active ? (
            <>
              <span className="max-w-[60%] truncate text-[11px] text-muted">{active.label}</span>
              <span className="text-xl font-extrabold text-text">{pct(active.weight, { digits: 1 })}</span>
            </>
          ) : (
            <>
              <span className="text-[11px] text-muted">{centerLabel}</span>
              <span className="text-[22px] font-extrabold text-text">{centerValue}</span>
            </>
          )}
        </div>
      </div>
      {legend && (
        <ul className="w-full min-w-0 flex-1 space-y-3">
          {visible.map((slice) => (
            <li
              key={slice.key}
              onMouseEnter={() => setHover(slice.key)}
              onMouseLeave={() => setHover(null)}
              className="flex items-center gap-2.5 text-sm"
            >
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-700" title={slice.detail}>{slice.label}</span>
              <span className="tabular font-bold text-text">{pct(slice.weight, { digits: 0 })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
