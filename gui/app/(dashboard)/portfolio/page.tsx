import { Suspense } from "react";
import { PageSkeleton } from "@/components/common/blocks";
import { PortfolioView } from "./portfolio-view";

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PortfolioView />
    </Suspense>
  );
}
