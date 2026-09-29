"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useSession } from "@/components/session";
import { Button, Card, Field, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (displayName.trim().length < 2) {
      next.displayName = "Name must be at least 2 characters";
    }
    if (!email.trim()) {
      next.email = "Email is required";
    }
    if (password.length < 10) {
      next.password = "Password must be at least 10 characters";
    } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      next.password = "Password must include a letter and a number";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      });
      await refresh();
      router.push("/");
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(errorMessage(error, "Could not create account"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <PageHeader kicker="Account" title="Join UNIVOX" lede="Create an account to follow creators, join communities, and open Creator Studio." />
      <Card className="auth-panel">
        <form className="stack" onSubmit={(event) => void onSubmit(event)} noValidate>
          <Field label="Display name" htmlFor="displayName" error={errors.displayName}>
            <input id="displayName" name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password} hint="At least 10 characters, with a letter and a number.">
            <input id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {formError ? <StatusMessage tone="error">{formError}</StatusMessage> : null}
          <Button type="submit" disabled={busy} block>
            {busy ? "Creating account" : "Create account"}
          </Button>
        </form>
        <p className="lede" style={{ marginTop: 16 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </Card>
    </main>
  );
}
