"use client";

import { Check, Star, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { FrontierChart, FrontierLegend, type BucketMarker } from "@/components/charts/frontier-chart";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { PageSkeleton, SectionSkeleton, WarningsNote } from "@/components/common/blocks";
import { PageHeader } from "@/components/shell/page-header";
import {
  Badge, Button, Card, CardHeader, Dialog, ErrorCard, Footnote, Note, Segmented, Stat, Switch,
} from "@/components/ui/primitives";
import type { Schemas } from "@/lib/api/client";
import { useBuckets, useDebounced, useFrontier, usePerformance, useProfiles } from "@/lib/api/queries";
import { isValidAmount, money, pct, ratio } from "@/lib/format";
import {
  BUCKET_LABELS, EMPHASIS_LABELS, groupColor, INFEASIBLE_TEXT, PROFILE_LABELS, PROFILE_NAMES, type Emphasis,
} from "@/lib/labels";
import { useSettings, useSettingsHydrated } from "@/lib/store/settings";

type Limits = { emphasis: Emphasis; maxVolOn: boolean; maxVol: number; minRetOn: boolean; minRet: number };

/** Slider bounds without float artifacts (0.7200000000000001 → 0.72). */
const roundTo = (value: number) => Number(value.toFixed(3));

function Slider({ label, value, min, max, step, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; disabled: boolean;
}) {
  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{pct(min, { digits: 0 })}</span>
        <span className="tabular text-sm font-bold text-text">{pct(value)}</span>
        <span>{pct(max, { digits: 0 })}</span>
      </div>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full accent-primary" />
    </div>
  );
}

function PreferencesForm({ limits, setLimits, range }: {
  limits: Limits; setLimits: (patch: Partial<Limits>) => void;
  range: { minVol: number; maxVol: number; minRet: number; maxRet: number };
}) {
  return (
    <Card>
      <CardHeader title="Your limits" subtitle="Annual figures; buckets are picked from existing frontier points." />
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Emphasis</p>
          <Segmented label="Emphasis" value={limits.emphasis} size="sm" onChange={(emphasis) => setLimits({ emphasis })}
            options={(Object.keys(EMPHASIS_LABELS) as Emphasis[]).map((value) => ({ value, label: EMPHASIS_LABELS[value] }))} />
        </div>
        <div className="space-y-3">
          <Switch label="Maximum volatility" description="Risk ceiling" checked={limits.maxVolOn} onChange={(maxVolOn) => setLimits({ maxVolOn })} />
          <Slider label="Maximum volatility" value={limits.maxVol} min={roundTo(Math.floor(range.minVol * 100) / 100)} max={roundTo(Math.ceil(range.maxVol * 100) / 100)}
            step={0.005} disabled={!limits.maxVolOn} onChange={(maxVol) => setLimits({ maxVol })} />
        </div>
        <div className="space-y-3">
          <Switch label="Minimum return" description="Historical return floor" checked={limits.minRetOn} onChange={(minRetOn) => setLimits({ minRetOn })} />
          <Slider label="Minimum return" value={limits.minRet} min={0} max={roundTo(Math.ceil(range.maxRet * 20) / 20 + 0.05)}
            step={0.005} disabled={!limits.minRetOn} onChange={(minRet) => setLimits({ minRet })} />
        </div>
      </div>
    </Card>
  );
}

function BucketCard({ bucket, breakdown, recommended }: {
  bucket: Schemas["Bucket"]; breakdown?: Schemas["Breakdown"]; recommended: boolean;
}) {
  return (
    <Card className={recommended ? "ring-2 ring-(--series-aqua)" : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">{BUCKET_LABELS[bucket.name] ?? bucket.name}</h3>
          <p className="text-xs text-muted">Frontier point #{bucket.frontier_index}</p>
        </div>
        {recommended && <Badge tone="positive"><Star className="h-3 w-3" /> Recommended for your emphasis</Badge>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Return*" value={pct(bucket.expected_return)} />
        <Stat label="Volatility" value={pct(bucket.volatility)} />
        <Stat label="Sharpe" value={ratio(bucket.sharpe_ratio)} />
      </div>
      {breakdown && (
        <div className="mt-5">
          <AllocationDonut size={112} label={`${bucket.name} allocation`}
            slices={breakdown.top_groups.map((g) => ({ key: g.group, label: g.group, weight: g.weight, color: groupColor(g.group), detail: g.tickers.join(", ") }))} />
        </div>
      )}
      {bucket.overlaps_with.length > 0 && (
        <p className="mt-4 text-xs text-warning">Same point as: {bucket.overlaps_with.map((o) => BUCKET_LABELS[o] ?? o).join(", ")}</p>
      )}
      <div className="mt-4"><WarningsNote warnings={bucket.warnings.filter((w) => w !== "overlapping_profiles")} emptyText="No concentration flags." /></div>
    </Card>
  );
}

function PinnedPoint({ point, onClose }: { point: Schemas["FrontierPoint"]; onClose: () => void }) {
  const settings = useSettings();
  const [growth, setGrowth] = useState(false);
  const amountOk = isValidAmount(settings.amount);
  const performance = usePerformance({ frontierIndex: point.index, amount: settings.amount, currency: settings.currency,
    range: "5Y", freq: "Q", benchmark: true }, growth && amountOk);
  const weights = Object.entries(point.weights).filter(([, w]) => w > 0.0005).sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <CardHeader title={`Frontier point #${point.index}`} subtitle="Pinned from the chart"
        action={<button type="button" aria-label="Unpin" onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-muted"><X className="h-4 w-4" /></button>} />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Return*" value={pct(point.expected_return)} />
        <Stat label="Volatility" value={pct(point.volatility)} />
        <Stat label="Sharpe" value={ratio(point.sharpe_ratio)} />
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {weights.map(([ticker, weight]) => (
          <li key={ticker} className="flex justify-between"><span>{ticker}</span><span className="tabular font-semibold">{pct(weight)}</span></li>
        ))}
      </ul>
      <Button className="mt-4 w-full" onClick={() => setGrowth(true)} disabled={!amountOk}>
        <TrendingUp className="h-4 w-4" /> View in-sample growth
      </Button>
      <Dialog open={growth} onClose={() => setGrowth(false)} title={`Frontier point #${point.index} · ${money(settings.amount, settings.currency)}`}
        footer={<Button onClick={() => setGrowth(false)}>Close</Button>}>
        {performance.isError ? <ErrorCard error={performance.error} /> : performance.data ? (
          <>
            <PerformanceChart data={performance.data} currency={settings.currency} showBenchmark height={240} />
            <Footnote>{performance.data.notice}</Footnote>
          </>
        ) : <SectionSkeleton className="h-60" />}
      </Dialog>
    </Card>
  );
}

function OptimizerBody({ frontier }: { frontier: Schemas["FrontierResponse"] }) {
  const settings = useSettings();
  const profiles = useProfiles();
  const points = frontier.points;
  const range = {
    minVol: points[0].volatility, maxVol: points[points.length - 1].volatility,
    minRet: points[0].expected_return, maxRet: points[points.length - 1].expected_return,
  };
  const [limits, setLimitState] = useState<Limits>(() => ({
    emphasis: "balanced", maxVolOn: true, maxVol: Math.round(((range.minVol + range.maxVol) / 2) * 200) / 200,
    minRetOn: false, minRet: Math.round(range.minRet * 200) / 200,
  }));
  const setLimits = (patch: Partial<Limits>) => setLimitState((current) => ({ ...current, ...patch }));
  const params = useDebounced(useMemo(() => ({
    emphasis: limits.emphasis,
    max_volatility: limits.maxVolOn ? limits.maxVol : null,
    min_expected_return: limits.minRetOn ? limits.minRet : null,
  }), [limits]));
  const buckets = useBuckets(params);
  const [pinned, setPinned] = useState<number | null>(null);

  const result = buckets.data;
  const markers: BucketMarker[] = result?.status === "ok"
    ? Object.values(result.buckets).map((b) => ({ name: b.name, label: BUCKET_LABELS[b.name] ?? b.name, index: b.frontier_index, recommended: b.name === result.recommended }))
    : result?.closest ? [{ name: "closest", label: "Closest", index: result.closest.frontier_index, recommended: true }] : [];
  const windowRange = result?.status === "ok" && result.window.first_index != null && result.window.last_index != null
    ? { first: result.window.first_index, last: result.window.last_index } : null;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold">Your risk profile</h2>
            <p className="mt-1 text-[13px] text-muted">Fixed profiles used on Overview, Portfolio and Allocation.</p>
          </div>
          <Segmented label="Risk profile" value={settings.profile} onChange={(profile) => settings.update({ profile })}
            options={PROFILE_NAMES.map((name) => ({ value: name, label: PROFILE_LABELS[name] }))} />
        </div>
        {profiles.data && (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Expected return*" value={pct(profiles.data.profiles[settings.profile].expected_return)} />
            <Stat label="Volatility" value={pct(profiles.data.profiles[settings.profile].volatility)} />
            <Stat label="Sharpe" value={ratio(profiles.data.profiles[settings.profile].sharpe_ratio)} />
            <Stat label="Frontier point" value={`#${profiles.data.profiles[settings.profile].selection.frontier_index}`} />
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,1fr)_minmax(0,2.4fr)]">
        <div className="space-y-5">
          <PreferencesForm limits={limits} setLimits={setLimits} range={range} />
          {pinned !== null && points[pinned] && <PinnedPoint point={points[pinned]} onClose={() => setPinned(null)} />}
        </div>
        <Card>
          <CardHeader title="Efficient frontier" subtitle="Hover any point for its weights; click a frontier point to pin it." />
          <FrontierChart frontier={frontier} buckets={markers} window={windowRange} selected={pinned} onSelect={setPinned} />
          <div className="mt-3"><FrontierLegend showBuckets={markers.length > 0} showWindow={!!windowRange} /></div>
          <Footnote>
            Max Sharpe is the exact optimum ({pct(frontier.max_sharpe.expected_return)} return, {pct(frontier.max_sharpe.volatility)} volatility,
            Sharpe {ratio(frontier.max_sharpe.sharpe_ratio)}); it usually lies between sampled points. Risk-free rate {pct(frontier.risk_free_rate, { digits: 2 })}.
          </Footnote>
        </Card>
      </div>

      {buckets.isError ? <ErrorCard error={buckets.error} onRetry={() => buckets.refetch()} /> : !result ? <SectionSkeleton className="h-64" /> : (
        <section aria-label="Needs-driven buckets" className="space-y-4">
          {result.status === "infeasible" ? (
            <>
              <Note tone="warning">
                <p className="font-semibold">{INFEASIBLE_TEXT[result.reason ?? ""] ?? "No frontier point fits these limits."}</p>
                <p className="mt-1">
                  The frontier spans {pct(result.frontier_range.min_volatility)}–{pct(result.frontier_range.max_volatility)} volatility and{" "}
                  {pct(result.frontier_range.min_expected_return)}–{pct(result.frontier_range.max_expected_return)} historical return. The closest available point is shown below.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setLimits({ maxVolOn: false, minRetOn: false })}>Relax limits</Button>
              </Note>
              {result.closest && (
                <div className="grid gap-5 lg:grid-cols-3">
                  <BucketCard bucket={result.closest} breakdown={result.breakdowns.closest} recommended={false} />
                </div>
              )}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm text-slate-700">
                <Check className="h-4 w-4 text-positive" /> {result.window.feasible_points} frontier points fit your limits
                {result.recommended && <> · recommended: <strong>{BUCKET_LABELS[result.recommended]}</strong></>}
              </p>
              <div className="grid gap-5 lg:grid-cols-3">
                {(["conservative", "balanced", "growth"] as const).map((name) => result.buckets[name] && (
                  <BucketCard key={name} bucket={result.buckets[name]} breakdown={result.breakdowns[name]} recommended={result.recommended === name} />
                ))}
              </div>
            </>
          )}
          <Footnote>
            *Buckets are existing efficient-frontier points; no new optimization is run. Conservative is the lowest-risk point in your window,
            Balanced the highest Sharpe, Growth the higher-return end. {result.disclaimer}
          </Footnote>
        </section>
      )}
    </div>
  );
}

export function OptimizerView() {
  const hydrated = useSettingsHydrated();
  const frontier = useFrontier();
  if (!hydrated) return <PageSkeleton />;
  return (
    <>
      <PageHeader title="Optimizer" subtitle="Explore the efficient frontier and pick portfolios that fit your risk and return limits." />
      {frontier.isError ? <ErrorCard error={frontier.error} onRetry={() => frontier.refetch()} />
        : frontier.data ? <OptimizerBody frontier={frontier.data} /> : <SectionSkeleton className="h-130" />}
    </>
  );
}
