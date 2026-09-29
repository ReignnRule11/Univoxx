"use client";

import { RequireAuth } from "@/components/require-auth";
import { useSession } from "@/components/session";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusMessage } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useApi } from "@/hooks/use-api";
import type { PublicNotification } from "@/lib/ui-types";
import { useState } from "react";

export default function MessagesPage() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);
  const query = useApi<{ notifications: PublicNotification[] }>(user ? "/api/v1/notifications" : null, tick);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = query.data?.notifications ?? [];

  async function mark(id: string, read: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/v1/notifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ read }),
      });
      setTick((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main id="main" className="app-main">
      <PageHeader
        kicker="Messages"
        title="Inbox"
        lede="Operational notices from communities and memberships. Direct chat between users is not in this release."
      />
      <RequireAuth>
        {query.loading ? <LoadingState label="Loading messages" /> : null}
        {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
        {!query.loading && !items.length ? (
          <EmptyState title="Inbox is clear" body="Membership changes, reports, and moderation actions will land here." />
        ) : (
          <div className="stack">
            {items.map((item) => (
              <Card key={item.id}>
                <div className="cluster">
                  <Badge>{item.type}</Badge>
                  {item.readAt ? <Badge tone="success">Read</Badge> : <Badge tone="live">New</Badge>}
                </div>
                <h2 style={{ marginTop: 12 }}>{item.title}</h2>
                <p className="lede">{item.body}</p>
                <p className="lede" style={{ marginTop: 8 }}>
                  {formatDate(item.createdAt)}
                </p>
                <div className="cluster" style={{ marginTop: 12 }}>
                  <Button type="button" variant="secondary" disabled={busyId === item.id} onClick={() => void mark(item.id, !item.readAt)}>
                    {item.readAt ? "Mark unread" : "Mark read"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </RequireAuth>
    </main>
  );
}
