"use client";

import clsx from "clsx";
import { AlertTriangle, Info, RotateCw } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-2xl border border-border bg-surface p-6", className)} {...props} />;
}

export function CardHeader({ title, subtitle, action, className }: {
  title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={clsx("mb-5 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold text-text">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" };

export function Button({ variant = "outline", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-nav-active text-white hover:bg-nav-active/90",
        variant === "outline" && "border border-border bg-surface text-text hover:bg-surface-muted",
        variant === "ghost" && "text-muted hover:bg-surface-muted hover:text-text",
        variant === "danger" && "bg-negative text-white hover:bg-negative/90",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ tone = "neutral", children, className }: {
  tone?: "neutral" | "primary" | "positive" | "warning" | "negative"; children: ReactNode; className?: string;
}) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
      tone === "neutral" && "bg-surface-muted text-muted ring-1 ring-border",
      tone === "primary" && "bg-primary-soft text-primary",
      tone === "positive" && "bg-green-50 text-positive",
      tone === "warning" && "bg-warning-soft text-warning",
      tone === "negative" && "bg-red-50 text-negative",
      className,
    )}>
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, size = "md" }: {
  value: T; options: { value: T; label: ReactNode }[]; onChange: (value: T) => void; label: string; size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-border bg-surface-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "rounded-lg font-semibold transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]",
            value === option.value ? "bg-surface text-text shadow-sm ring-1 ring-border" : "text-muted hover:text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ className, label, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <select
      aria-label={label}
      className={clsx(
        "h-10 rounded-xl border border-border bg-surface pl-3 pr-8 text-sm font-medium text-text hover:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Switch({ checked, onChange, label, disabled, description }: {
  checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean; description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className={clsx("text-sm font-semibold", disabled ? "text-muted" : "text-text")}>{label}</label>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-slate-300",
        )}
      >
        <span className={clsx("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0")} />
      </button>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function Tabs<T extends string>({ value, tabs, onChange }: {
  value: T; tabs: { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          type="button"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            value === tab.value ? "border-nav-active text-text" : "border-transparent text-muted hover:text-text",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Note({ tone = "info", children, className }: { tone?: "info" | "warning"; children: ReactNode; className?: string }) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div className={clsx(
      "flex gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
      tone === "info" ? "border-primary/15 bg-primary-soft text-slate-700" : "border-amber-200 bg-warning-soft text-amber-900",
      className,
    )}>
      <Icon aria-hidden className={clsx("mt-0.5 h-4 w-4 shrink-0", tone === "info" ? "text-primary" : "text-warning")} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Footnote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-muted">{children}</p>;
}

export function ErrorCard({ error, onRetry, title = "Could not load this section" }: {
  error: unknown; onRetry?: () => void; title?: string;
}) {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-negative">{title}</p>
        <p className="mt-1 text-[13px] text-slate-700">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm font-semibold text-text">{title}</p>
      {children && <p className="max-w-md text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Dialog({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // Cache Components keeps a left route mounted but hidden (<Activity>) and cleans up its
    // effects; a modal left open there would keep the top layer and make the new page inert.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
      className="m-auto w-[min(92vw,520px)] rounded-2xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-slate-900/40"
    >
      {open && (
        <div className="p-6">
          <h2 className="text-lg font-bold">{title}</h2>
          <div className="mt-4">{children}</div>
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "positive" | "negative" }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={clsx("tabular mt-1 text-lg font-bold",
        tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
