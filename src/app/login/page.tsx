"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useSession } from "@/components/session";
import { Button, Card, Field, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!email.trim()) {
      next.email = "Email is required";
    }
    if (!password) {
      next.password = "Password is required";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refresh();
      router.push("/");
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(errorMessage(error, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <PageHeader kicker="Account" title="Sign in" lede="Continue to your creator operating system." />
      <Card className="auth-panel">
        <form className="stack" onSubmit={(event) => void onSubmit(event)} noValidate>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password}>
            <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {formError ? <StatusMessage tone="error">{formError}</StatusMessage> : null}
          <Button type="submit" disabled={busy} block>
            {busy ? "Signing in" : "Sign in"}
          </Button>
        </form>
        <div className="cluster" style={{ marginTop: 16 }}>
          <Link href="/register">Create account</Link>
          <Link href="/forgot-password">Forgot password</Link>
        </div>
      </Card>
    </main>
  );
}
