import { Suspense } from "react";
import { PageSkeleton } from "@/components/common/blocks";
import { PlanDetailView } from "./plan-detail-view";

export default function PlanDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlanDetailView />
    </Suspense>
  );
}
