import { Suspense, type ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { ApiStatusBanner, AssumptionsFooter } from "@/components/shell/status-and-footer";

const STATIC_FOOTER = (
  <footer className="border-t border-border px-4 py-4 text-xs text-muted sm:px-8">
    Historical estimates, not forecasts or personalized advice.
  </footer>
);

// Client components that query the API sit behind Suspense so Cache Components can prerender the shell.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <ApiStatusBanner />
        </Suspense>
        <main className="mx-auto w-full max-w-360 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        <Suspense fallback={STATIC_FOOTER}>
          <AssumptionsFooter />
        </Suspense>
      </div>
    </div>
  );
}
