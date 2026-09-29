"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { useSession } from "@/components/session";
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useApi } from "@/hooks/use-api";
import type { PublicEvent } from "@/lib/ui-types";

export default function LivePage() {
  const { user } = useSession();
  const query = useApi<{ events: PublicEvent[] }>(user ? "/api/v1/events" : null);
  const events = query.data?.events ?? [];
  const live = events.filter((event) => event.status === "LIVE" || event.status === "SCHEDULED");

  return (
    <main id="main" className="app-main">
      <PageHeader
        kicker="Live"
        title="Rooms and upcoming sessions"
        lede="Host events appear here. Audience registration and check-in happen on the event page."
        actions={
          <Link className="btn secondary" href="/studio/events">
            Schedule in Studio
          </Link>
        }
      />
      <RequireAuth>
        {query.loading ? <LoadingState label="Loading events" /> : null}
        {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
        {!query.loading && !live.length ? (
          <EmptyState
            title="No live or upcoming rooms"
            body="Draft and publish an event from Studio. Local rooms are for development until Daily or LiveKit is configured."
            action={
              <Link className="btn" href="/studio/events">
                Create event
              </Link>
            }
          />
        ) : (
          <div className="grid-cards">
            {live.map((event) => (
              <Link key={event.id} href={`/live/${event.id}`} className="card">
                <div className="cluster">
                  <Badge tone={event.status === "LIVE" ? "live" : undefined}>{event.status}</Badge>
                  <Badge>{event.accessType}</Badge>
                </div>
                <h2 style={{ marginTop: 12 }}>{event.title}</h2>
                <p className="lede">{event.description || "No description"}</p>
                <p className="lede" style={{ marginTop: 8 }}>
                  {formatDate(event.startsAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </RequireAuth>
    </main>
  );
}
