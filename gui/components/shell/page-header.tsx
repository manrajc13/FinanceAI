"use client";

import { Clock, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useMetadata } from "@/lib/api/queries";
import { monthYear } from "@/lib/format";
import { Brand, Navigation } from "./sidebar";

function DateRangePill() {
  const { data } = useMetadata();
  const label = data ? `${monthYear(data.start_date)} – ${monthYear(data.end_date)}` : "Loading…";
  return (
    <span
      title="Frozen historical dataset window. It cannot be changed; all figures are in-sample estimates."
      className="tabular inline-flex h-12 items-center gap-2.5 rounded-xl border border-border bg-surface px-4 text-[15px] text-slate-700"
    >
      <Clock aria-hidden className="h-4 w-4 text-muted" />
      {label}
    </span>
  );
}

function Avatar() {
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-[15px] font-extrabold text-primary"
    >
      FA
    </Link>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface px-3 py-5 shadow-xl">
            <div className="flex items-start justify-between">
              <Brand />
              <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-surface-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Navigation onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

export function PageHeader({ title, subtitle, eyebrow = "Portfolio intelligence", actions }: {
  title: string; subtitle: string; eyebrow?: string; actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <MobileNav />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-bold text-text sm:text-[30px] sm:leading-tight">{title}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="hidden sm:block"><DateRangePill /></div>
        <Avatar />
      </div>
    </header>
  );
}
