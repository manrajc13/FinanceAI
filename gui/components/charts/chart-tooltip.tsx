import type { ReactNode } from "react";

export function TooltipBox({ title, rows, footer }: {
  title: ReactNode; rows: { label: ReactNode; value: ReactNode; color?: string }[]; footer?: ReactNode;
}) {
  return (
    <div className="min-w-44 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-text">{title}</p>
      <dl className="space-y-1">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted">
              {row.color && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: row.color }} />}
              {row.label}
            </dt>
            <dd className="tabular font-semibold text-text">{row.value}</dd>
          </div>
        ))}
      </dl>
      {footer && <p className="mt-1.5 border-t border-border pt-1.5 text-muted">{footer}</p>}
    </div>
  );
}

export function LegendKey({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line x1="1" y1="4" x2="17" y2="4" stroke={item.color} strokeWidth="2" strokeLinecap="round"
              strokeDasharray={item.dashed ? "3 3" : undefined} />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export const AXIS_TICK = { fill: "var(--chart-ink-muted)", fontSize: 11 } as const;
