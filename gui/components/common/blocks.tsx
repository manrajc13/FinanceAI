"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Card, Note, Skeleton } from "@/components/ui/primitives";
import { currencySymbol, groupDigits, isValidAmount, type Currency } from "@/lib/format";
import { warningText } from "@/lib/labels";

export function KpiCard({ label, icon: Icon, value, sub, tone, loading, children }: {
  label: string; icon: LucideIcon; value: ReactNode; sub?: ReactNode; tone?: "positive" | "negative";
  loading?: boolean; children?: ReactNode;
}) {
  return (
    <Card className="flex min-h-[154px] flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <Icon aria-hidden className="h-[18px] w-[18px] text-muted" strokeWidth={2.2} />
      </div>
      {loading ? (
        <div className="mt-6 space-y-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-3.5 w-32" /></div>
      ) : (
        <>
          <p className={clsx("mt-5 truncate text-[28px] font-extrabold leading-tight sm:text-[30px]",
            tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-text")}>
            {value}
          </p>
          {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
          {children}
        </>
      )}
    </Card>
  );
}

export function WarningsNote({ warnings, emptyText = "No concentration or overlap flags for this portfolio." }: {
  warnings: string[]; emptyText?: string;
}) {
  if (warnings.length === 0) return <Note>{emptyText}</Note>;
  return (
    <Note tone="warning">
      <ul className="space-y-1">
        {warnings.map((code) => <li key={code}>{warningText(code)}</li>)}
      </ul>
    </Note>
  );
}

/** Decimal-string amount input. The field always holds the raw decimal (no reformatting while
 *  editing, which would fight the caret/selection); a grouped preview is shown underneath. */
export function AmountInput({ value, currency, onChange, label = "Amount", autoFocus }: {
  value: string; currency: Currency; onChange: (value: string) => void; label?: string; autoFocus?: boolean;
}) {
  const id = useId();
  const valid = isValidAmount(value);
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-slate-700">{label}</label>
      <div className={clsx("mt-1.5 flex h-11 items-center rounded-xl border bg-surface px-3",
        valid || value === "" ? "border-border focus-within:border-primary" : "border-negative")}>
        <span className="text-sm font-semibold text-muted">{currencySymbol(currency)}</span>
        <input
          id={id}
          inputMode="decimal"
          autoFocus={autoFocus}
          aria-invalid={!valid}
          aria-describedby={`${id}-hint`}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
          className="tabular ml-2 w-full bg-transparent text-[15px] font-semibold text-text outline-none"
        />
      </div>
      {!valid && value !== "" ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-negative">Enter a positive amount with at most two decimals (up to 999,999,999,999.99).</p>
      ) : (
        <p id={`${id}-hint`} className="tabular mt-1 text-xs text-muted">{valid ? `${currencySymbol(currency)}${groupDigits(value, currency)}` : " "}</p>
      )}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-8 w-72" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[154px] rounded-2xl" />)}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[3fr_2fr]">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    </div>
  );
}

export function SectionSkeleton({ className = "h-72" }: { className?: string }) {
  return <Skeleton className={clsx("w-full rounded-xl", className)} />;
}
