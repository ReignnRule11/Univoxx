"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { Button, Card, Field, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";

export default function StudioSettingsPage() {
  const { user, refresh, signOut } = useSession();
  const [displayName, setDisplayName] = useState(user?.user.displayName ?? "");
  const [handle, setHandle] = useState(user?.profile?.handle ?? "");
  const [bio, setBio] = useState(user?.profile?.bio ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(user?.user.displayName ?? "");
    setHandle(user?.profile?.handle ?? "");
    setBio(user?.profile?.bio ?? "");
  }, [user]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (displayName.trim().length < 2) {
      next.displayName = "Name must be at least 2 characters";
    }
    if (handle && !/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(handle.trim().toLowerCase())) {
      next.handle = "Handle must be 3-32 lowercase letters, numbers, and hyphens";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (!user?.profile) {
        await apiFetch("/api/v1/profiles", {
          method: "POST",
          body: JSON.stringify({
            handle: handle.trim().toLowerCase(),
            bio: bio || undefined,
          }),
        });
      } else {
        await apiFetch("/api/v1/profiles/me", {
          method: "PATCH",
          body: JSON.stringify({
            displayName,
            handle: handle.trim().toLowerCase() || undefined,
            bio: bio || null,
          }),
        });
      }
      await refresh();
      setOk(true);
      setMessage("Profile saved");
    } catch (error) {
      setOk(false);
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Studio" title="Settings" lede="Your public profile and session. Passwords are never displayed." />
      <Card>
        <form className="stack" onSubmit={(event) => void onSave(event)} noValidate>
          <Field label="Display name" htmlFor="displayName" error={errors.displayName}>
            <input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </Field>
          <Field label="Handle" htmlFor="handle" error={errors.handle} hint="Used for public lookup on Discover.">
            <input id="handle" value={handle} onChange={(event) => setHandle(event.target.value)} />
          </Field>
          <Field label="Bio" htmlFor="bio">
            <textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving" : "Save profile"}
          </Button>
        </form>
        {message ? <StatusMessage tone={ok ? "ok" : "error"}>{message}</StatusMessage> : null}
        <div style={{ marginTop: 24 }}>
          <Button type="button" variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </>
  );
}
