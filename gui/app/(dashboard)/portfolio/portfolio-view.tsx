"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { CorrelationHeatmap } from "@/components/charts/correlation-heatmap";
import { PriceMultiples } from "@/components/charts/price-multiples";
import { PageSkeleton, SectionSkeleton, WarningsNote } from "@/components/common/blocks";
import { PageHeader } from "@/components/shell/page-header";
import {
  Badge, Button, Card, CardHeader, ErrorCard, Footnote, Note, Segmented, Select, Stat, Tabs,
} from "@/components/ui/primitives";
import type { Schemas } from "@/lib/api/client";
import { useAllocation, useCorrelation, usePriceHistory, useProfiles, useUniverse } from "@/lib/api/queries";
import { isValidAmount, money, pct, ratio } from "@/lib/format";
import { groupColor, PROFILE_LABELS, PROFILE_NAMES, SELECTION_RULES, type ProfileName } from "@/lib/labels";
import { useSettings, useSettingsHydrated, type RangeKey } from "@/lib/store/settings";

type Tab = "holdings" | "compare" | "universe";
const TABS: { value: Tab; label: string }[] = [
  { value: "holdings", label: "Holdings" },
  { value: "compare", label: "Compare profiles" },
  { value: "universe", label: "Stock universe" },
];

function WeightBar({ weight, color }: { weight: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, weight)) * 100}%`, background: color }} />
      </div>
      <span className="tabular w-14 text-right">{pct(weight)}</span>
    </div>
  );
}

function ProfileSwitcher() {
  const { profile, update } = useSettings();
  return (
    <Segmented label="Profile" value={profile} onChange={(value) => update({ profile: value })}
      options={PROFILE_NAMES.map((name) => ({ value: name, label: PROFILE_LABELS[name] }))} />
  );
}

function Holdings({ profiles }: { profiles: Schemas["ProfilesResponse"] }) {
  const settings = useSettings();
  const universe = useUniverse();
  const amountOk = isValidAmount(settings.amount);
  const allocation = useAllocation(
    { amount: settings.amount, currency: settings.currency, profile: settings.profile, hide_dust: false }, amountOk);
  const profile = profiles.profiles[settings.profile];
  const breakdown = profiles.breakdowns[settings.profile];
  const stats = useMemo(() => new Map(universe.data?.assets.map((a) => [a.ticker, a])), [universe.data]);
  const [why, setWhy] = useState(false);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ProfileSwitcher />
          <button type="button" onClick={() => setWhy(!why)} className="text-sm font-semibold text-primary hover:underline">
            {why ? "Hide selection rule" : "Why this portfolio?"}
          </button>
        </div>
        {why && (
          <Note className="mt-4">
            {SELECTION_RULES[profile.selection.rule] ?? profile.selection.rule} Frontier point #{profile.selection.frontier_index}
            {" "}(tie-break: earlier point). Weights are taken unchanged from the efficient frontier.
          </Note>
        )}
        <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-5">
          <Stat label="Expected return*" value={pct(profile.expected_return)} tone="positive" />
          <Stat label="Volatility" value={pct(profile.volatility)} />
          <Stat label="Sharpe ratio" value={ratio(profile.sharpe_ratio)} hint={`rf ${pct(profile.metadata.risk_free_rate, { digits: 1 })}`} />
          <Stat label="Material holdings" value={profile.diversification.material_holdings} hint="weights above 1%" />
          <Stat label="Frontier point" value={`#${profile.selection.frontier_index}`} hint={`of ${profile.metadata.frontier_point_count}`} />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={`${PROFILE_LABELS[settings.profile]} holdings`}
            subtitle={amountOk ? `Target amounts for ${money(settings.amount, settings.currency)} (display-rounded)` : "Set a valid planned amount to see amounts"} />
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-semibold">Stock</th>
                  <th className="py-2 pr-3 font-semibold">Group</th>
                  <th className="py-2 pr-3 font-semibold">Weight</th>
                  <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                  <th className="py-2 pr-3 text-right font-semibold">Stock return*</th>
                  <th className="py-2 text-right font-semibold">Stock volatility</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.by_ticker.map((row) => {
                  const dust = row.weight < 0.005;
                  const stat = stats.get(row.ticker);
                  const amount = allocation.data?.display.amounts[row.ticker];
                  return (
                    <tr key={row.ticker} className={`border-b border-border last:border-0 ${dust ? "text-muted" : ""}`}>
                      <td className="py-2.5 pr-3">
                        <span className="font-semibold text-text">{row.ticker}</span>
                        <span className="ml-2 text-xs text-muted">{row.name}</span>
                        {dust && <Badge className="ml-2">dust</Badge>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: groupColor(row.group) }} />{row.group}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3"><WeightBar weight={row.weight} color={groupColor(row.group)} /></td>
                      <td className="tabular py-2.5 pr-3 text-right">{amount ? money(amount, settings.currency, 2) : "—"}</td>
                      <td className="tabular py-2.5 pr-3 text-right">{stat ? pct(stat.annual_expected_return) : "—"}</td>
                      <td className="tabular py-2.5 text-right">{stat ? pct(stat.annual_volatility) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Footnote>*Annualized historical arithmetic mean of daily returns, 2021–2025. Not a forecast. Holdings below 0.5% are marked as dust.</Footnote>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="By sector group" subtitle="Display grouping; GOOGL and META count as Technology" />
            <ul className="space-y-3">
              {breakdown.by_group.filter((group) => group.weight >= 0.0005).map((group) => (
                <li key={group.group}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-slate-700">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: groupColor(group.group) }} />{group.group}
                    </span>
                    <span className="tabular font-bold">{pct(group.weight)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{group.tickers.join(", ")}</p>
                </li>
              ))}
            </ul>
          </Card>
          <WarningsNote warnings={profile.warnings} />
          <p className="text-xs leading-relaxed text-muted">{profile.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

function Compare({ profiles }: { profiles: Schemas["ProfilesResponse"] }) {
  const { profile: current, update } = useSettings();
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {PROFILE_NAMES.map((name: ProfileName) => {
        const profile = profiles.profiles[name];
        const breakdown = profiles.breakdowns[name];
        return (
          <Card key={name} className={name === current ? "ring-2 ring-nav-active" : undefined}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold">{PROFILE_LABELS[name]}</h3>
                <p className="text-xs text-muted">Frontier point #{profile.selection.frontier_index}</p>
              </div>
              {name === current ? <Badge tone="primary"><Check className="h-3 w-3" /> Your profile</Badge> : (
                <Button size="sm" onClick={() => update({ profile: name })}>Set as my profile</Button>
              )}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="Return*" value={pct(profile.expected_return)} />
              <Stat label="Volatility" value={pct(profile.volatility)} />
              <Stat label="Sharpe" value={ratio(profile.sharpe_ratio)} />
            </div>
            <div className="mt-6">
              <AllocationDonut size={128} legend label={`${PROFILE_LABELS[name]} allocation`}
                slices={breakdown.top_groups.map((g) => ({ key: g.group, label: g.group, weight: g.weight, color: groupColor(g.group), detail: g.tickers.join(", ") }))} />
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold text-muted">Top holdings</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {breakdown.by_ticker.slice(0, 3).map((row) => (
                  <li key={row.ticker} className="flex justify-between"><span>{row.ticker} <span className="text-xs text-muted">{row.name}</span></span><span className="tabular font-semibold">{pct(row.weight)}</span></li>
                ))}
              </ul>
            </div>
            {profile.selection.overlaps_with.length > 0 && (
              <p className="mt-4 text-xs text-warning">Same portfolio as: {profile.selection.overlaps_with.map((o) => PROFILE_LABELS[o as ProfileName] ?? o).join(", ")}</p>
            )}
            <div className="mt-4"><WarningsNote warnings={profile.warnings} emptyText="No concentration flags." /></div>
          </Card>
        );
      })}
    </div>
  );
}

type SortKey = "ticker" | "annual_expected_return" | "annual_volatility";

function Universe() {
  const universe = useUniverse();
  const correlation = useCorrelation();
  const [range, setRange] = useState<RangeKey>("5Y");
  const prices = usePriceHistory(range, "M");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "annual_expected_return", desc: true });
  const rows = useMemo(() => {
    const data = [...(universe.data?.assets ?? [])];
    data.sort((a, b) => {
      const diff = sort.key === "ticker" ? a.ticker.localeCompare(b.ticker) : a[sort.key] - b[sort.key];
      return sort.desc ? -diff : diff;
    });
    return data;
  }, [universe.data, sort]);
  const names = useMemo(() => Object.fromEntries((universe.data?.assets ?? []).map((a) => [a.ticker, a.name])), [universe.data]);

  const header = (key: SortKey, label: string, right = false) => (
    <th className={`py-2 pr-3 font-semibold ${right ? "text-right" : "text-left"}`} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-text" onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : true })}>
        {label}{sort.key === key && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Stock universe" subtitle="Ten predefined US large caps · annualized historical statistics" />
          {universe.isError ? <ErrorCard error={universe.error} onRetry={() => universe.refetch()} /> : !universe.data ? <SectionSkeleton /> : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="border-b border-border text-xs text-muted">
                  {header("ticker", "Stock")}
                  <th className="py-2 pr-3 text-left font-semibold">Sector</th>
                  {header("annual_expected_return", "Return*", true)}
                  {header("annual_volatility", "Volatility", true)}
                </tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.ticker} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3"><span className="font-semibold">{row.ticker}</span><span className="ml-2 text-xs text-muted">{row.name}</span></td>
                      <td className="py-2.5 pr-3 text-slate-700">{row.sector}</td>
                      <td className="tabular py-2.5 pr-3 text-right">{pct(row.annual_expected_return)}</td>
                      <td className="tabular py-2.5 text-right">{pct(row.annual_volatility)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Footnote>*Historical arithmetic mean of daily simple returns × 252. Not a forecast.</Footnote>
        </Card>
        <Card>
          <CardHeader title="Correlation" subtitle="How daily returns moved together (from the annual covariance matrix)" />
          {correlation.isError ? <ErrorCard error={correlation.error} onRetry={() => correlation.refetch()} />
            : correlation.data ? <CorrelationHeatmap assets={correlation.data.assets} matrix={correlation.data.matrix} /> : <SectionSkeleton />}
        </Card>
      </div>
      <Card>
        <CardHeader title="Price history" subtitle="Adjusted closes rebased to 100 at the start of the range · shared log scale, so equal slopes mean equal growth rates"
          action={<Select label="Range" value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
            {(["1Y", "3Y", "5Y"] as RangeKey[]).map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>} />
        {prices.isError ? <ErrorCard error={prices.error} onRetry={() => prices.refetch()} />
          : prices.data ? <PriceMultiples data={prices.data} names={names} /> : <SectionSkeleton className="h-56" />}
      </Card>
    </div>
  );
}

export function PortfolioView() {
  const hydrated = useSettingsHydrated();
  const profiles = useProfiles();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("tab");
  const tab: Tab = TABS.some((t) => t.value === requested) ? (requested as Tab) : "holdings";

  if (!hydrated) return <PageSkeleton />;
  return (
    <>
      <PageHeader title="Portfolio" subtitle="Holdings of your profile, side-by-side comparison and the stock universe." />
      <Tabs value={tab} tabs={TABS} onChange={(value) => router.replace(`${pathname}?tab=${value}`, { scroll: false })} />
      <div className="mt-5">
        {tab === "universe" ? <Universe /> : profiles.isError ? <ErrorCard error={profiles.error} onRetry={() => profiles.refetch()} />
          : !profiles.data ? <SectionSkeleton className="h-96" />
            : tab === "holdings" ? <Holdings profiles={profiles.data} /> : <Compare profiles={profiles.data} />}
      </div>
    </>
  );
}
