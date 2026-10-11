import { Suspense } from "react";
import { PageSkeleton } from "@/components/common/blocks";
import { OptimizerView } from "./optimizer-view";

export default function OptimizerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OptimizerView />
    </Suspense>
  );
}
