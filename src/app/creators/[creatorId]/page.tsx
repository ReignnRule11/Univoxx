"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useSession } from "@/components/session";
import { Button, Card, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api-client";

export default function CreatorPage() {
  const params = useParams<{ creatorId: string }>();
  const creatorId = params.creatorId;
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function follow() {
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/creators/${creatorId}/follow`, { method: "POST" });
      setOk(true);
      setMessage("Following");
    } catch (error) {
      setOk(false);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function unfollow() {
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/creators/${creatorId}/follow`, { method: "DELETE" });
      setOk(true);
      setMessage("Unfollowed");
    } catch (error) {
      setOk(false);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <PageHeader kicker="Creator" title="Follow a creator" lede="Following is stored on the server. It is required for the following feed." />
      <RequireAuth>
        <Card>
          <p className="lede">Creator ID {creatorId}</p>
          {user?.user.id === creatorId ? (
            <p className="lede" style={{ marginTop: 12 }}>
              This is you. Follow yourself is not allowed.
            </p>
          ) : (
            <div className="cluster" style={{ marginTop: 16 }}>
              <Button type="button" disabled={busy} onClick={() => void follow()}>
                Follow
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void unfollow()}>
                Unfollow
              </Button>
            </div>
          )}
          {message ? <StatusMessage tone={ok ? "ok" : "error"}>{message}</StatusMessage> : null}
        </Card>
      </RequireAuth>
    </main>
  );
}
