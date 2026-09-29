"use client";

import { Button, ErrorState } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="app-main">
      <ErrorState message={error.message || "An unexpected error occurred"} onRetry={reset} />
      <div className="cluster" style={{ justifyContent: "center" }}>
        <Button type="button" variant="ghost" onClick={reset}>
          Reload
        </Button>
      </div>
    </main>
  );
}
