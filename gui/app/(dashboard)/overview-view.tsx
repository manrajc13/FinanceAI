"use client";

import { ArrowDown, ArrowUp, ArrowUpRight, Box, CircleDollarSign, Gauge, IndianRupee } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { AmountInput, KpiCard, PageSkeleton, SectionSkeleton, WarningsNote } from "@/components/common/blocks";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader, ErrorCard, Footnote, Select } from "@/components/ui/primitives";
import { useMetadata, usePerformance, useProfiles } from "@/lib/api/queries";
import { isValidAmount, money, pct, ratio, year } from "@/lib/format";
import { groupColor, PROFILE_LABELS } from "@/lib/labels";
import { useSettings, useSettingsHydrated, type RangeKey } from "@/lib/store/settings";

const RANGES: RangeKey[] = ["1Y", "3Y", "5Y"];

function PlannedAmount() {
  const { amount, currency, update } = useSettings();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(amount);
  if (!editing) {
    return (
      <p className="mt-2 text-xs text-muted">
        Planned {money(amount, currency)} ·{" "}
        <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setDraft(amount); setEditing(true); }}>
          Edit
        </button>
      </p>
    );
  }
  return (
    <form
      className="mt-3 flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValidAmount(draft)) return;
        update({ amount: draft });
        setEditing(false);
      }}
    >
      <div className="flex-1"><AmountInput value={draft} currency={currency} onChange={setDraft} label="Planned amount" autoFocus /></div>
      <Button type="submit" variant="primary" size="sm" className="mb-6" disabled={!isValidAmount(draft)}>Save</Button>
    </form>
  );
}

export function OverviewView() {
  const hydrated = useSettingsHydrated();
  const settings = useSettings();
  const metadata = useMetadata();
  const profiles = useProfiles();
  const amountOk = isValidAmount(settings.amount);
  const performance = usePerformance(
    { profile: settings.profile, amount: settings.amount, currency: settings.currency, range: settings.range, freq: settings.freq, benchmark: true },
    hydrated && amountOk,
  );

  if (!hydrated) return <PageSkeleton />;

  const profile = profiles.data?.profiles[settings.profile];
  const breakdown = profiles.data?.breakdowns[settings.profile];
  const label = PROFILE_LABELS[settings.profile];
  const summary = performance.data?.summary;
  const gain = summary ? Number(summary.gain) : 0;
  const CurrencyIcon = settings.currency === "INR" ? IndianRupee : CircleDollarSign;
  const span = performance.data ? `${year(performance.data.start_date)}–${year(performance.data.end_date)}` : "";

  return (
    <>
      <PageHeader title="Portfolio Overview" subtitle="Track performance, diversification and allocation." />

      <section aria-label="Key figures" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Portfolio value"
          icon={CurrencyIcon}
          loading={performance.isPending}
          value={summary ? money(summary.end_value, settings.currency) : "—"}
          sub={summary && (
            <span className={gain >= 0 ? "text-positive" : "text-negative"}>
              {gain >= 0 ? <ArrowUp className="mr-0.5 inline h-3 w-3" /> : <ArrowDown className="mr-0.5 inline h-3 w-3" />}
              {money(Math.abs(gain), settings.currency)} {gain >= 0 ? "gain" : "loss"} over {span}*
            </span>
          )}
        >
          {performance.isError && <p className="mt-2 text-xs text-negative">{(performance.error as Error).message}</p>}
          <PlannedAmount />
        </KpiCard>
        <KpiCard
          label="Historical return"
          icon={ArrowUpRight}
          loading={profiles.isPending}
          tone={profile && profile.expected_return >= 0 ? "positive" : "negative"}
          value={profile ? pct(profile.expected_return, { sign: true }) : "—"}
          sub={<>Annual historical estimate*{summary?.cagr != null && <> · CAGR {pct(summary.cagr)} (simulation)</>}</>}
        />
        <Link href="/portfolio?tab=universe" className="rounded-2xl">
          <KpiCard label="Assets in universe" icon={Box} loading={metadata.isPending}
            value={metadata.data?.asset_count ?? "—"} sub="Predefined US equities" />
        </Link>
        <Link href="/optimizer" className="rounded-2xl">
          <KpiCard label="Risk profile" icon={Gauge} loading={profiles.isPending} value={label}
            sub={profile ? <>Sharpe {ratio(profile.sharpe_ratio)} · Select a profile in Optimizer</> : "Select a profile in Optimizer"} />
        </Link>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title="Portfolio performance"
            subtitle={`In-sample value of your planned amount · ${label} profile`}
            action={
              <Select label="Range" value={settings.range} onChange={(e) => settings.update({ range: e.target.value as RangeKey })}>
                {RANGES.map((range) => <option key={range} value={range}>{range}</option>)}
              </Select>
            }
          />
          {!amountOk ? (
            <ErrorCard title="Invalid planned amount" error={new Error("Set a positive planned amount to see the simulation.")} />
          ) : performance.isError ? (
            <ErrorCard error={performance.error} onRetry={() => performance.refetch()} />
          ) : performance.data ? (
            <>
              <PerformanceChart data={performance.data} currency={settings.currency} showBenchmark={settings.showBenchmark} />
              <div className="mt-2 flex justify-end">
                <button type="button" className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => settings.update({ showBenchmark: !settings.showBenchmark })}>
                  {settings.showBenchmark ? "Hide" : "Show"} equal-weight benchmark
                </button>
              </div>
              <Footnote>
                *{performance.data.notice}
                {settings.currency === "INR" && <> {performance.data.currency_notice}</>}
              </Footnote>
            </>
          ) : (
            <SectionSkeleton className="h-75" />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Asset allocation"
            subtitle={`${label} profile by sector group`}
            action={<Link href="/portfolio?tab=holdings"><Button size="sm">View details</Button></Link>}
          />
          {profiles.isError ? (
            <ErrorCard error={profiles.error} onRetry={() => profiles.refetch()} />
          ) : breakdown && profile ? (
            <div className="space-y-6">
              <div className="py-2">
                <AllocationDonut
                  label={`${label} profile allocation by group`}
                  slices={breakdown.top_groups.map((g) => ({
                    key: g.group, label: g.group, weight: g.weight, color: groupColor(g.group), detail: g.tickers.join(", "),
                  }))}
                />
              </div>
              <WarningsNote warnings={profile.warnings} />
            </div>
          ) : (
            <SectionSkeleton className="h-75" />
          )}
        </Card>
      </section>
    </>
  );
}
