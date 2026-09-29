"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSession } from "./session";
import { EmptyState, LoadingState } from "./ui";

export function RequireAuth({ children, title }: { children: ReactNode; title?: string }) {
  const { user, loading } = useSession();
  if (loading) {
    return <LoadingState label="Checking your session" />;
  }
  if (!user) {
    return (
      <EmptyState
        title={title ?? "Sign in to continue"}
        body="This area uses your UNIVOX session. Join or sign in, then come back."
        action={
          <>
            <Link className="btn" href="/login">
              Sign in
            </Link>
            <Link className="btn secondary" href="/register">
              Create account
            </Link>
          </>
        }
      />
    );
  }
  return <>{children}</>;
}
