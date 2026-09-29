"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { useSession } from "@/components/session";
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import type { PublicCommunity } from "@/lib/ui-types";

export default function CommunitiesPage() {
  const { user } = useSession();
  const query = useApi<{ communities: PublicCommunity[] }>(user ? "/api/v1/communities" : null);

  return (
    <main id="main" className="app-main">
      <PageHeader
        kicker="Communities"
        title="Rooms you can enter"
        lede="Public communities in your organizations, plus memberships you already hold."
        actions={
          <Link className="btn secondary" href="/studio/community">
            Manage in Studio
          </Link>
        }
      />
      <RequireAuth>
        {query.loading ? <LoadingState label="Loading communities" /> : null}
        {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
        {!query.loading && !query.error && !query.data?.communities.length ? (
          <EmptyState
            title="No communities yet"
            body="An organization admin can create the first community from Creator Studio."
            action={
              <Link className="btn" href="/studio/community">
                Open Studio
              </Link>
            }
          />
        ) : (
          <div className="grid-cards">
            {query.data?.communities.map((community) => (
              <Link key={community.id} href={`/communities/${community.id}`} className="card">
                <div className="cluster">
                  <Badge>{community.visibility}</Badge>
                  {community.membership ? <Badge tone="success">{community.membership.role}</Badge> : null}
                </div>
                <h2 style={{ marginTop: 12 }}>{community.name}</h2>
                <p className="lede">{community.description || "A space for members and posts."}</p>
              </Link>
            ))}
          </div>
        )}
      </RequireAuth>
    </main>
  );
}
