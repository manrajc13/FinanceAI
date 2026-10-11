import { Suspense } from "react";
import { PageSkeleton } from "@/components/common/blocks";
import { ExplainerView } from "./explainer-view";

export default function ExplainerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExplainerView />
    </Suspense>
  );
}
