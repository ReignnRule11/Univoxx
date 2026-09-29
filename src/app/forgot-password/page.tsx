"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button, Card, Field, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await apiFetch<{ accepted: true; resetToken?: string }>("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setAccepted(true);
      setResetToken(result.resetToken ?? null);
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <PageHeader kicker="Account" title="Reset password" lede="If an account exists for that email, a reset path is issued. We never confirm whether the email is registered." />
      <Card className="auth-panel">
        {accepted ? (
          <div className="stack">
            <StatusMessage tone="ok">If that account exists, a reset was accepted.</StatusMessage>
            {resetToken ? (
              <p className="lede">
                Development token available. Continue to <Link href={`/reset-password?token=${encodeURIComponent(resetToken)}`}>reset password</Link>.
              </p>
            ) : (
              <p className="lede">Check your reset channel. Production does not display tokens here.</p>
            )}
            <Link className="btn secondary" href="/login">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="stack" onSubmit={(event) => void onSubmit(event)} noValidate>
            <Field label="Email" htmlFor="email" error={errors.email}>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </Field>
            {formError ? <StatusMessage tone="error">{formError}</StatusMessage> : null}
            <Button type="submit" disabled={busy} block>
              {busy ? "Sending" : "Send reset"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
