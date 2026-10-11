"use client";

import { useState } from "react";
import { corr } from "@/lib/format";

const NEG = [192, 57, 43]; // --diverging-neg #c0392b
const MID = [240, 239, 236]; // --diverging-mid #f0efec (neutral gray midpoint)
const POS = [28, 92, 171]; // --diverging-pos #1c5cab

function mix(a: number[], b: number[], t: number) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * t));
}

export function correlationColor(value: number): { background: string; ink: string } {
  const t = Math.min(1, Math.abs(value));
  const rgb = value >= 0 ? mix(MID, POS, t) : mix(MID, NEG, t);
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return { background: `rgb(${rgb.join(",")})`, ink: luminance < 0.55 ? "#ffffff" : "#0f172a" };
}

/** Diverging blue↔red heatmap with a gray midpoint; values always printed, plus a table view. */
export function CorrelationHeatmap({ assets, matrix }: { assets: string[]; matrix: number[][] }) {
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<[number, number] | null>(null);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>−1</span>
          <span aria-hidden className="h-2.5 w-40 rounded-full"
            style={{ background: "linear-gradient(90deg, rgb(192,57,43), rgb(240,239,236), rgb(28,92,171))" }} />
          <span>+1</span>
        </div>
        <button type="button" onClick={() => setAsTable(!asTable)} className="text-xs font-semibold text-primary hover:underline">
          {asTable ? "View as heatmap" : "View as table"}
        </button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="tabular w-full text-xs">
            <thead>
              <tr><th className="p-1.5 text-left text-muted">Ticker</th>{assets.map((a) => <th key={a} className="p-1.5 text-right text-muted">{a}</th>)}</tr>
            </thead>
            <tbody>
              {assets.map((row, i) => (
                <tr key={row} className="border-t border-border">
                  <th className="p-1.5 text-left font-semibold">{row}</th>
                  {matrix[i].map((value, j) => <td key={j} className="p-1.5 text-right">{corr(value)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[560px] gap-0.5" style={{ gridTemplateColumns: `52px repeat(${assets.length}, minmax(0, 1fr))` }}>
            <div />
            {assets.map((asset, j) => (
              <div key={asset} className={`pb-1 text-center text-[11px] font-semibold ${hover?.[1] === j ? "text-text" : "text-muted"}`}>{asset}</div>
            ))}
            {assets.map((row, i) => (
              <div key={row} className="contents">
                <div className={`flex items-center text-[11px] font-semibold ${hover?.[0] === i ? "text-text" : "text-muted"}`}>{row}</div>
                {matrix[i].map((value, j) => {
                  const { background, ink } = correlationColor(value);
                  return (
                    <div
                      key={j}
                      title={`${row} vs ${assets[j]}: ${corr(value)}`}
                      onMouseEnter={() => setHover([i, j])}
                      onMouseLeave={() => setHover(null)}
                      className="tabular flex aspect-square items-center justify-center rounded-[4px] text-[10px] font-semibold sm:text-[11px]"
                      style={{ background, color: ink, outline: hover?.[0] === i && hover?.[1] === j ? "2px solid var(--text)" : undefined }}
                    >
                      {i === j ? "1" : corr(value)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
