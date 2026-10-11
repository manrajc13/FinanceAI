"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { isActive, NAV_ITEMS } from "./nav-items";

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-nav-active text-base font-extrabold text-white">F</span>
      <span>
        <span className="block text-xl font-bold leading-tight text-text">FinanceAI</span>
        <span className="block text-[13px] text-muted">Portfolio intelligence</span>
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="mt-8 flex flex-col gap-1.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex h-12 items-center gap-3.5 rounded-xl px-4 text-[15px] font-semibold transition-colors",
              active ? "bg-nav-active text-white" : "text-slate-700 hover:bg-surface-muted hover:text-text",
            )}
          >
            <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNavList({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

/** usePathname suspends under dynamic routes with Cache Components, so the active state streams in. */
export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList pathname={null} />}>
      <ActiveNavList onNavigate={onNavigate} />
    </Suspense>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-3 py-5 lg:flex">
      <Brand />
      <Navigation />
    </aside>
  );
}
