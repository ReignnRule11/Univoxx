"use client";

import { StudioNav } from "@/components/navigation";
import { RequireAuth } from "@/components/require-auth";
import type { ReactNode } from "react";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="app-main studio">
      <RequireAuth title="Sign in to Creator Studio">
        <StudioNav />
        <div>{children}</div>
      </RequireAuth>
    </main>
  );
}
