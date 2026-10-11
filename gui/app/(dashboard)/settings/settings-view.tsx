"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useState } from "react";
import { AmountInput, PageSkeleton, SectionSkeleton } from "@/components/common/blocks";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader, Dialog, ErrorCard, Segmented, Select, Switch } from "@/components/ui/primitives";
import { api, expectOk, unwrap } from "@/lib/api/client";
import { useHealth, useMetadata, useUniverse } from "@/lib/api/queries";
import { isValidAmount, pct, type Currency } from "@/lib/format";
import { PROFILE_LABELS, PROFILE_NAMES, type ProfileName } from "@/lib/labels";
import { useSettings, useSettingsHydrated, type Freq } from "@/lib/store/settings";
import { useQueryClient } from "@tanstack/react-query";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-border py-4 last:border-0 sm:grid-cols-[220px_1fr] sm:items-center">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function DefaultAmount() {
  const { amount, currency, update } = useSettings();
  const [draft, setDraft] = useState(amount);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-64"><AmountInput value={draft} currency={currency} onChange={setDraft} label="Planned amount" /></div>
      <Button size="sm" className="mb-6" disabled={!isValidAmount(draft) || draft === amount} onClick={() => update({ amount: draft })}>Save</Button>
    </div>
  );
}

function DeleteAllPlans() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ busy: boolean; message?: string }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    try {
      let deleted = 0;
      for (;;) {
        const page = await unwrap(api.GET("/api/plans", { params: { query: { limit: 200, offset: 0 } } }));
        if (page.items.length === 0) break;
        for (const plan of page.items) {
          await expectOk(api.DELETE("/api/plans/{plan_id}", { params: { path: { plan_id: plan.id } } }));
          deleted += 1;
        }
      }
      await client.invalidateQueries({ queryKey: ["plans"] });
      setState({ busy: false, message: `Deleted ${deleted} plan${deleted === 1 ? "" : "s"}.` });
      setOpen(false);
    } catch (error) {
      setState({ busy: false, message: (error as Error).message });
    }
  };
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Delete all saved plans</Button>
      {state.message && <p className="mt-2 text-xs text-muted">{state.message}</p>}
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete all saved plans?"
        footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" disabled={state.busy} onClick={run}>{state.busy ? "Deleting…" : "Delete all"}</Button></>}>
        <p className="text-sm text-slate-700">Every saved plan on this server will be permanently removed.</p>
      </Dialog>
    </>
  );
}

export function SettingsView() {
  const hydrated = useSettingsHydrated();
  const settings = useSettings();
  const health = useHealth();
  const metadata = useMetadata();
  const universe = useUniverse();
  if (!hydrated) return <PageSkeleton />;
  const llm = health.data?.llm_configured ?? false;

  return (
    <>
      <PageHeader title="Settings" subtitle="Defaults for this browser, AI status and the analysis assumptions." />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Preferences" subtitle="Stored in this browser only." />
            <Row label="Currency label">
              <Segmented label="Currency" value={settings.currency} onChange={(currency: Currency) => settings.update({ currency })}
                options={[{ value: "INR", label: "INR ₹" }, { value: "USD", label: "USD $" }]} />
              <p className="mt-1.5 text-xs text-muted">A display label only; no FX conversion is applied.</p>
            </Row>
            <Row label="Default amount"><DefaultAmount /></Row>
            <Row label="Default profile">
              <Select label="Default profile" value={settings.profile} onChange={(e) => settings.update({ profile: e.target.value as ProfileName })}>
                {PROFILE_NAMES.map((name) => <option key={name} value={name}>{PROFILE_LABELS[name]}</option>)}
              </Select>
            </Row>
            <Row label="Performance chart sampling">
              <Segmented label="Sampling" value={settings.freq} onChange={(freq: Freq) => settings.update({ freq })}
                options={[{ value: "Q", label: "Quarterly" }, { value: "M", label: "Monthly" }]} />
            </Row>
            <Row label="Display">
              <div className="space-y-4">
                <Switch label="Hide holdings below 0.5% by default" checked={settings.hideDust} onChange={(hideDust) => settings.update({ hideDust })} />
                <Switch label="Show equal-weight benchmark" checked={settings.showBenchmark} onChange={(showBenchmark) => settings.update({ showBenchmark })} />
              </div>
            </Row>
          </Card>

          <Card>
            <CardHeader title="AI explanations" />
            <Switch label="Enable AI mode" checked={settings.useLlm && llm} disabled={!llm} onChange={(useLlm) => settings.update({ useLlm })}
              description="When on, your question and verified analysis facts are sent to Groq. The model only selects facts; it never writes numbers." />
            <p className="mt-4 flex items-center gap-2 text-sm">
              {health.isPending ? <span className="text-muted">Checking server…</span> : llm
                ? <><CheckCircle2 className="h-4 w-4 text-positive" /> Configured on the server</>
                : <><CircleAlert className="h-4 w-4 text-warning" /> Not configured — add GROQ_API_KEY to FinanceAI/.env and install agent/requirements.txt</>}
            </p>
          </Card>

          <Card>
            <CardHeader title="Danger zone" />
            <div className="flex flex-wrap items-start gap-6">
              <div>
                <Button size="sm" onClick={() => settings.reset()}>Reset local settings</Button>
                <p className="mt-2 text-xs text-muted">Restores INR, ₹10,00,000, Balanced.</p>
              </div>
              {health.data?.plans_enabled && <div><DeleteAllPlans /></div>}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Data & assumptions" subtitle="Read-only; changing them requires approval and a new dataset." />
            {metadata.isError ? <ErrorCard error={metadata.error} onRetry={() => metadata.refetch()} /> : !metadata.data ? <SectionSkeleton className="h-48" /> : (
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Dataset window", `${metadata.data.start_date} → ${metadata.data.end_date}`],
                  ["Observations", `${metadata.data.observations} trading days`],
                  ["Annualization", `${metadata.data.trading_days} trading days/year`],
                  ["Risk-free rate", pct(metadata.data.risk_free_rate, { digits: 2 })],
                  ["Constraints", `${metadata.data.constraints.fully_invested ? "Fully invested" : "Partial"} · ${metadata.data.constraints.long_only ? "long-only" : "shorts allowed"} · ${metadata.data.constraints.leverage_allowed ? "leverage" : "no leverage"}`],
                  ["Frontier", `${metadata.data.frontier_point_count} sampled efficient points`],
                  ["Returns", "Simple daily returns; arithmetic mean and sample covariance"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
                ))}
              </dl>
            )}
            {metadata.data && <p className="mt-4 text-xs leading-relaxed text-muted">{metadata.data.disclaimer}</p>}
          </Card>
          <Card>
            <CardHeader title="Stock universe" />
            {universe.data ? (
              <ul className="space-y-2 text-sm">
                {universe.data.assets.map((asset) => (
                  <li key={asset.ticker} className="flex justify-between gap-3"><span><span className="font-semibold">{asset.ticker}</span> <span className="text-muted">{asset.name}</span></span><span className="text-right text-xs text-muted">{asset.sector}</span></li>
                ))}
              </ul>
            ) : <SectionSkeleton className="h-48" />}
          </Card>
          <Card>
            <CardHeader title="About" />
            <p className="text-sm leading-relaxed text-slate-700">
              FinanceAI applies Markowitz Modern Portfolio Theory to a frozen 2021–2025 sample. Profiles and buckets are points on the
              sampled efficient frontier; allocations are fractional target amounts. Nothing here is a trade, a forecast or personalized advice.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
