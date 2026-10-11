"use client";

import { ArrowLeft, Download, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AllocationTable, RoundingAudit } from "@/components/allocation/allocation-tables";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { PageSkeleton, SectionSkeleton } from "@/components/common/blocks";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorCard, Footnote, Note, Stat } from "@/components/ui/primitives";
import { ApiError, downloadCsv } from "@/lib/api/client";
import { usePlan } from "@/lib/api/queries";
import { dateTime, money, type Currency } from "@/lib/format";
import { groupColor, PROFILE_LABELS, type ProfileName } from "@/lib/labels";
import { useSettings, useSettingsHydrated } from "@/lib/store/settings";
import { DeletePlanDialog } from "../plans-view";

export function PlanDetailView() {
  const hydrated = useSettingsHydrated();
  const { id } = useParams<{ id: string }>();
  const [deleted, setDeleted] = useState(false);
  const plan = usePlan(id, !deleted);
  const router = useRouter();
  const update = useSettings((s) => s.update);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!hydrated) return <PageSkeleton />;

  const back = <Link href="/plans" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> All plans</Link>;
  if (plan.isError) {
    return (
      <>
        <PageHeader title="Saved plan" subtitle="Plans are saved target allocations, not executed trades." />
        <div className="mb-4">{back}</div>
        {plan.error instanceof ApiError && plan.error.status === 404
          ? <EmptyState title="Plan not found">It may have been deleted.</EmptyState>
          : <ErrorCard error={plan.error} onRetry={() => plan.refetch()} />}
      </>
    );
  }
  const data = plan.data;
  return (
    <>
      <PageHeader title={data?.name ?? "Saved plan"} subtitle="Saved target allocation snapshot — not an executed trade." />
      <div className="mb-4">{back}</div>
      {!data ? <SectionSkeleton className="h-96" /> : (
        <div className="space-y-5">
          <Card>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat label="Amount" value={money(data.amount, data.currency as Currency, 2)} />
              <Stat label="Profile" value={PROFILE_LABELS[data.profile as ProfileName]} />
              <Stat label="Saved" value={dateTime(data.created_at)} />
              <Stat label="Dataset" value={`${data.dataset_start.slice(0, 4)}–${data.dataset_end.slice(0, 4)}`}
                hint={data.dataset_matches_current ? "matches current data" : undefined} />
            </div>
            {!data.dataset_matches_current && (
              <Note tone="warning" className="mt-4">This plan was saved with a different dataset window than the server now uses. Re-run it to compare.</Note>
            )}
            {data.note && <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-slate-700">{data.note}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => { setError(null); downloadCsv(`/api/plans/${data.id}/export.csv`, { method: "GET" }).catch((e: Error) => setError(e.message)); }}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={() => { update({ amount: data.amount, currency: data.currency as Currency, profile: data.profile as ProfileName, hideDust: data.hide_dust }); router.push("/allocation"); }}>
                <RefreshCw className="h-4 w-4" /> Re-run with current data
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4 text-negative" /> Delete</Button>
              {data.hide_dust && <Badge>Small holdings grouped</Badge>}
            </div>
            {error && <p className="mt-2 text-sm text-negative">{error}</p>}
          </Card>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Per-stock amounts" subtitle="As saved; totals reconcile exactly." />
              <AllocationTable allocation={data.allocation} />
              <div className="mt-5"><RoundingAudit allocation={data.allocation} /></div>
            </Card>
            <Card>
              <CardHeader title="By sector group" />
              <AllocationDonut label="Saved allocation by group" slices={data.allocation.breakdown.by_group.map((g) => ({
                key: g.group, label: g.group, weight: g.weight, color: groupColor(g.group), detail: g.tickers.join(", "),
              }))} />
            </Card>
          </div>
          <Note>{data.allocation.notice} {data.allocation.currency_notice}</Note>
          <Footnote>{data.allocation.target_profile.disclaimer}</Footnote>
        </div>
      )}
      {data && <DeletePlanDialog plan={deleting ? data : null} onClose={() => setDeleting(false)} onDeleted={() => { setDeleted(true); router.push("/plans"); }} />}
    </>
  );
}
