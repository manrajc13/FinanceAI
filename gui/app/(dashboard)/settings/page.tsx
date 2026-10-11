import { Suspense } from "react";
import { PageSkeleton } from "@/components/common/blocks";
import { SettingsView } from "./settings-view";

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsView />
    </Suspense>
  );
}
