"use client";

import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageSkeleton, SectionSkeleton } from "@/components/common/blocks";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorCard } from "@/components/ui/primitives";
import { ApiError, downloadCsv, type Schemas } from "@/lib/api/client";
import { useDeletePlan, usePlans } from "@/lib/api/queries";
import { dateTime, money, type Currency } from "@/lib/format";
import { PROFILE_LABELS, type ProfileName } from "@/lib/labels";
import { useSettingsHydrated } from "@/lib/store/settings";

const PAGE_SIZE = 20;

export function DeletePlanDialog({ plan, onClose, onDeleted }: {
  plan: Schemas["PlanSummary"] | null; onClose: () => void; onDeleted?: () => void;
}) {
  const remove = useDeletePlan();
  return (
    <Dialog open={!!plan} onClose={() => { remove.reset(); onClose(); }} title="Delete plan?"
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={remove.isPending}
          onClick={() => plan && remove.mutate(plan.id, { onSuccess: () => { onClose(); onDeleted?.(); } })}>
          {remove.isPending ? "Deleting…" : "Delete"}
        </Button>
      </>}>
      <p className="text-sm text-slate-700">“{plan?.name}” will be permanently removed. This cannot be undone.</p>
      {remove.isError && <p className="mt-2 text-sm text-negative">{(remove.error as Error).message}</p>}
    </Dialog>
  );
}

export function PlansView() {
  const hydrated = useSettingsHydrated();
  const [page, setPage] = useState(0);
  const plans = usePlans(PAGE_SIZE, page * PAGE_SIZE);
  const [deleting, setDeleting] = useState<Schemas["PlanSummary"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!hydrated) return <PageSkeleton />;
  const data = plans.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader title="Saved plans" subtitle="Plans are saved target allocations, not executed trades." />
      <Card>
        <CardHeader title="Your plans" subtitle={data ? `${data.total} saved` : undefined}
          action={<Link href="/allocation"><Button variant="primary" size="sm">New plan</Button></Link>} />
        {plans.isError ? (
          plans.error instanceof ApiError && plans.error.status === 404
            ? <EmptyState title="Saved plans are disabled on this server" />
            : <ErrorCard error={plans.error} onRetry={() => plans.refetch()} />
        ) : !data ? <SectionSkeleton className="h-48" /> : data.items.length === 0 ? (
          <EmptyState title="No saved plans yet" action={<Link href="/allocation"><Button>Create one in Allocation</Button></Link>}>
            Save an allocation to keep its exact amounts and dataset window for later.
          </EmptyState>
        ) : (
          <>
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold">Created</th>
                    <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                    <th className="py-2 pr-3 font-semibold">Profile</th>
                    <th className="py-2 pr-3 font-semibold">Dataset</th>
                    <th className="py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((plan) => (
                    <tr key={plan.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-3">
                        <Link href={`/plans/${plan.id}`} className="font-semibold text-text hover:text-primary hover:underline">{plan.name}</Link>
                        {plan.note && <p className="max-w-64 truncate text-xs text-muted">{plan.note}</p>}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">{dateTime(plan.created_at)}</td>
                      <td className="tabular py-3 pr-3 text-right font-semibold">{money(plan.amount, plan.currency as Currency, 2)}</td>
                      <td className="py-3 pr-3">{PROFILE_LABELS[plan.profile as ProfileName]}</td>
                      <td className="py-3 pr-3">
                        {plan.dataset_matches_current ? <span className="text-xs text-muted">{plan.dataset_start} → {plan.dataset_end}</span>
                          : <Badge tone="warning">Dataset changed</Badge>}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Link href={`/plans/${plan.id}`}><Button size="sm" variant="ghost">View</Button></Link>
                          <Button size="sm" variant="ghost" aria-label={`Export ${plan.name} as CSV`}
                            onClick={() => { setError(null); downloadCsv(`/api/plans/${plan.id}/export.csv`, { method: "GET" }).catch((e: Error) => setError(e.message)); }}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" aria-label={`Delete ${plan.name}`} onClick={() => setDeleting(plan)}>
                            <Trash2 className="h-4 w-4 text-negative" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="mt-3 text-sm text-negative">{error}</p>}
            {pages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="text-muted">Page {page + 1} of {pages}</span>
                <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            )}
          </>
        )}
      </Card>
      <DeletePlanDialog plan={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
