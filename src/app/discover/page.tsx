"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useSession } from "@/components/session";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/hooks/use-api";
import type { PublicCommunity, PublicProfile } from "@/lib/ui-types";

export default function DiscoverPage() {
  const { user } = useSession();
  const communities = useApi<{ communities: PublicCommunity[] }>(user ? "/api/v1/communities" : null);
  const [handle, setHandle] = useState("");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    const value = handle.trim().toLowerCase().replace(/^@/, "");
    if (!value) {
      setLookupError("Enter a creator handle");
      return;
    }
    setBusy(true);
    setLookupError(null);
    setProfile(null);
    try {
      const result = await apiFetch<{ profile: PublicProfile }>(`/api/v1/profiles/${encodeURIComponent(value)}`);
      setProfile(result.profile);
    } catch (error) {
      setLookupError(errorMessage(error, "Creator not found"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <PageHeader
        kicker="Discover"
        title="Find people and rooms"
        lede="Look up a public creator handle or browse communities you can already see."
      />
      <RequireAuth>
        <div className="grid-cards two">
          <Card>
            <h2>Creator lookup</h2>
            <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => void onSearch(event)}>
              <Field label="Handle" htmlFor="handle" hint="Lowercase letters, numbers, and hyphens.">
                <input id="handle" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="studio-name" />
              </Field>
              <Button type="submit" disabled={busy}>
                {busy ? "Searching" : "Search"}
              </Button>
            </form>
            {lookupError ? <StatusMessage tone="error">{lookupError}</StatusMessage> : null}
            {profile ? (
              <div className="stack" style={{ marginTop: 16 }}>
                <p>
                  <strong>{profile.displayName}</strong> @{profile.handle}
                </p>
                <p className="lede">{profile.bio || "No bio yet."}</p>
                <Link className="btn secondary" href={`/creators/${profile.userId}`}>
                  Open profile
                </Link>
              </div>
            ) : null}
          </Card>
          <Card>
            <h2>Communities</h2>
            {communities.loading ? <LoadingState label="Loading communities" /> : null}
            {communities.error ? <ErrorState message={communities.error} onRetry={() => void communities.reload()} /> : null}
            {!communities.loading && !communities.data?.communities.length ? (
              <EmptyState title="No communities yet" body="Create one from Studio once you have an organization." />
            ) : (
              <div className="stack" style={{ marginTop: 16 }}>
                {communities.data?.communities.map((community) => (
                  <Link key={community.id} href={`/communities/${community.id}`} className="card quiet">
                    <strong>{community.name}</strong>
                    <p className="lede">{community.description || "No description"}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </RequireAuth>
    </main>
  );
}
