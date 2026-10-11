"use client";

import { CheckCircle2, Download, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { AllocationTable, RoundingAudit } from "@/components/allocation/allocation-tables";
import { AmountInput, PageSkeleton, SectionSkeleton } from "@/components/common/blocks";
import { PageHeader } from "@/components/shell/page-header";
import {
  Badge, Button, Card, CardHeader, Dialog, ErrorCard, Footnote, Note, Segmented, Select, Stat, Switch,
} from "@/components/ui/primitives";
import { downloadCsv } from "@/lib/api/client";
import { useAllocation, useCreatePlan, useDebounced } from "@/lib/api/queries";
import { isValidAmount, money, type Currency } from "@/lib/format";
import { groupColor, PROFILE_LABELS, PROFILE_NAMES, type ProfileName } from "@/lib/labels";
import { useSettings, useSettingsHydrated } from "@/lib/store/settings";

type Form = { amount: string; currency: Currency; profile: ProfileName; hide_dust: boolean };

function SavePlanDialog({ open, onClose, form }: { open: boolean; onClose: () => void; form: Form }) {
  const create = useCreatePlan();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const close = () => { create.reset(); setName(""); setNote(""); onClose(); };
  return (
    <Dialog open={open} onClose={close} title="Save allocation plan"
      footer={create.isSuccess ? (
        <><Link href={`/plans/${create.data.id}`} onClick={close}><Button variant="primary">Open plan</Button></Link><Button onClick={close}>Close</Button></>
      ) : (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate({ name: name.trim(), note: note.trim() || null, ...form })}>
            {create.isPending ? "Saving…" : "Save plan"}
          </Button>
        </>
      )}>
      {create.isSuccess ? (
        <p className="flex items-center gap-2 text-sm text-positive"><CheckCircle2 className="h-4 w-4" /> Saved “{create.data.name}”.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-muted">
            {money(form.amount, form.currency)} · {PROFILE_LABELS[form.profile]} profile. The server recomputes and stores the allocation snapshot.
          </p>
          <label className="block text-xs font-semibold text-slate-700">Name
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus
              className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-sm font-normal outline-none focus:border-primary" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Note (optional)
            <textarea value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal outline-none focus:border-primary" />
          </label>
          {create.isError && <p className="text-sm text-negative">{(create.error as Error).message}</p>}
        </div>
      )}
    </Dialog>
  );
}

export function AllocationView() {
  const hydrated = useSettingsHydrated();
  if (!hydrated) return <PageSkeleton />;
  return <AllocationBody />;
}

function AllocationBody() {
  const settings = useSettings();
  const [form, setForm] = useState<Form>(() => ({
    amount: settings.amount, currency: settings.currency, profile: settings.profile, hide_dust: settings.hideDust,
  }));
  const [saving, setSaving] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const params = useDebounced(form);
  const valid = isValidAmount(params.amount);
  const allocation = useAllocation(params, valid);
  const data = allocation.data;
  const isDefault = form.amount === settings.amount && form.currency === settings.currency
    && form.profile === settings.profile && form.hide_dust === settings.hideDust;
  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <>
      <PageHeader title="Allocation" subtitle="Split a planned amount across the stocks of a profile. Target amounts only — no trades." />
      <div className="grid gap-5 xl:grid-cols-[minmax(300px,1fr)_minmax(0,2.4fr)]">
        <Card className="h-fit">
          <CardHeader title="Plan" subtitle="Amounts reconcile exactly to your input." />
          <div className="space-y-5">
            <AmountInput value={form.amount} currency={form.currency} onChange={(amount) => update({ amount })} label="Amount to allocate" />
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">Currency label</p>
              <Segmented label="Currency" value={form.currency} onChange={(currency) => update({ currency })}
                options={[{ value: "INR", label: "INR ₹" }, { value: "USD", label: "USD $" }]} />
              <p className="mt-1.5 text-xs text-muted">Label only — no FX conversion.</p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">Profile</p>
              <Select label="Profile" value={form.profile} className="w-full" onChange={(e) => update({ profile: e.target.value as ProfileName })}>
                {PROFILE_NAMES.map((name) => <option key={name} value={name}>{PROFILE_LABELS[name]}</option>)}
              </Select>
            </div>
            <Switch label="Hide holdings below 0.5%" description="Grouped into one row; still allocated." checked={form.hide_dust}
              onChange={(hide_dust) => update({ hide_dust })} />
            <Button className="w-full" disabled={isDefault || !isValidAmount(form.amount)}
              onClick={() => settings.update({ amount: form.amount, currency: form.currency, profile: form.profile, hideDust: form.hide_dust })}>
              {isDefault ? "These are your defaults" : "Save as default"}
            </Button>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          {!valid ? (
            <ErrorCard title="Invalid amount" error={new Error("Enter a positive amount with at most two decimals.")} />
          ) : allocation.isError ? (
            <ErrorCard error={allocation.error} onRetry={() => allocation.refetch()} />
          ) : !data ? (
            <SectionSkeleton className="h-96" />
          ) : (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="grid flex-1 grid-cols-2 gap-5 sm:grid-cols-4">
                    <Stat label="Total" value={money(data.display.total, data.currency as Currency, 2)} />
                    <Stat label="Profile" value={PROFILE_LABELS[data.target_profile.name]} />
                    <Stat label="Holdings shown" value={Object.keys(data.display.amounts).length} />
                    <Stat label="Hidden small holdings" value={data.display.hidden_assets.length ? money(data.display.hidden_amount, data.currency as Currency, 2) : "None"} />
                  </div>
                  {allocation.isFetching && <Badge>Updating…</Badge>}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => { setExportError(null); downloadCsv("/api/allocate/export.csv", { method: "POST", body: params }).catch((e: Error) => setExportError(e.message)); }}>
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                  <Button onClick={() => setSaving(true)}><Save className="h-4 w-4" /> Save plan</Button>
                  <Link href={`/explainer?amount=${encodeURIComponent(params.amount)}&currency=${params.currency}&profile=${params.profile}`}>
                    <Button variant="ghost"><Sparkles className="h-4 w-4" /> Explain this allocation</Button>
                  </Link>
                </div>
                {exportError && <p className="mt-2 text-sm text-negative">{exportError}</p>}
              </Card>
              <div className="grid gap-5">
                <Card>
                  <CardHeader title="Per-stock amounts" subtitle="Display rounded to cents/paise; totals reconcile exactly." />
                  <AllocationTable allocation={data} />
                  <div className="mt-5"><RoundingAudit allocation={data} /></div>
                </Card>
                <Card>
                  <CardHeader title="By sector group" />
                  <AllocationDonut label="Allocation by group" slices={data.breakdown.by_group.map((g) => ({
                    key: g.group, label: g.group, weight: g.weight, color: groupColor(g.group), detail: g.tickers.join(", "),
                  }))} />
                </Card>
              </div>
              <Note>{data.notice} {data.currency_notice}</Note>
              <Footnote>{data.target_profile.disclaimer}</Footnote>
            </>
          )}
        </div>
      </div>
      <SavePlanDialog open={saving} onClose={() => setSaving(false)} form={params} />
    </>
  );
}
