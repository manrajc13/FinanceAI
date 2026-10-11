import { Suspense } from "react";
import { PageSkeleton } from "@/components/common/blocks";
import { AllocationView } from "./allocation-view";

export default function AllocationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AllocationView />
    </Suspense>
  );
}
