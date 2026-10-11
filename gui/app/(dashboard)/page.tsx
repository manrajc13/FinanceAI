import { Suspense } from "react";
import { PageSkeleton } from "@/components/common/blocks";
import { OverviewView } from "./overview-view";

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OverviewView />
    </Suspense>
  );
}
