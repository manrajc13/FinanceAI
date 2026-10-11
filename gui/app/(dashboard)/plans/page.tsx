import { Suspense } from "react";
import { PageSkeleton } from "@/components/common/blocks";
import { PlansView } from "./plans-view";

export default function PlansPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlansView />
    </Suspense>
  );
}
