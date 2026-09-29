"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Button, Card, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (token.trim().length < 20) {
      next.token = "A valid reset token is required";
    }
    if (password.length < 10) {
      next.password = "Password must be at least 10 characters";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="auth-panel">
      {done ? (
        <div className="stack">
          <StatusMessage tone="ok">Password updated. Sign in with your new password.</StatusMessage>
          <Link className="btn" href="/login">
            Sign in
          </Link>
        </div>
      ) : (
        <form className="stack" onSubmit={(event) => void onSubmit(event)} noValidate>
          <Field label="Reset token" htmlFor="token" error={errors.token}>
            <input id="token" value={token} onChange={(event) => setToken(event.target.value)} />
          </Field>
          <Field label="New password" htmlFor="password" error={errors.password}>
            <input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {formError ? <StatusMessage tone="error">{formError}</StatusMessage> : null}
          <Button type="submit" disabled={busy} block>
            {busy ? "Updating" : "Update password"}
          </Button>
        </form>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <main id="main" className="app-main">
      <PageHeader kicker="Account" title="Choose a new password" />
      <Suspense fallback={<LoadingState label="Loading reset form" />}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
