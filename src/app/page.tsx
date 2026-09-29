"use client";

import Link from "next/link";
import { useState } from "react";
import { ContentCard } from "@/components/content-card";
import { useSession } from "@/components/session";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import type { FeedPage } from "@/lib/ui-types";

export default function HomePage() {
  const { user, loading: sessionLoading } = useSession();
  const [tick, setTick] = useState(0);
  const feed = useApi<FeedPage>(user ? "/api/v1/content/feed?scope=newest&limit=20" : null, tick);

  if (sessionLoading) {
    return (
      <main id="main" className="app-main">
        <LoadingState label="Opening UNIVOX" />
      </main>
    );
  }

  if (!user) {
    return (
      <main id="main" className="app-main">
        <PageHeader
          kicker="Creator OS"
          title="UNIVOX"
          lede="A premium operating system for creators and the people who follow them. Content first. Operations when you need them."
          actions={
            <>
              <Link className="btn" href="/register">
                Join
              </Link>
              <Link className="btn secondary" href="/login">
                Sign in
              </Link>
            </>
          }
        />
        <div className="grid-cards two">
          <section className="card">
            <p className="page-kicker">Audience</p>
            <h2>Watch, join, and show up</h2>
            <p className="lede" style={{ marginTop: 8 }}>
              Follow public work, enter communities, and register for live rooms. Fast, mobile-first, and never cluttered with admin chrome.
            </p>
          </section>
          <section className="card">
            <p className="page-kicker">Creators</p>
            <h2>Operate from Studio</h2>
            <p className="lede" style={{ marginTop: 8 }}>
              Publish, run memberships, host events, and read verified analytics. Studio is powerful without pretending to be a spreadsheet.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="app-main">
      <PageHeader
        kicker="Home"
        title={`Hello, ${user.user.displayName}`}
        lede="Newest public work, in the order it was published. No ranking. No invented popularity."
        actions={
          <Link className="btn" href="/studio/content">
            New draft
          </Link>
        }
      />
      {feed.loading ? <LoadingState label="Loading feed" /> : null}
      {feed.error ? <ErrorState message={feed.error} onRetry={() => void feed.reload()} /> : null}
      {!feed.loading && !feed.error && !feed.data?.items.length ? (
        <EmptyState
          title="Nothing in the feed yet"
          body="Publish something from Studio, or follow creators so their work can appear here."
          action={
            <>
              <Link className="btn" href="/discover">
                Discover
              </Link>
              <Link className="btn secondary" href="/studio/content">
                Create
              </Link>
            </>
          }
        />
      ) : null}
      <div className="feed">
        {feed.data?.items.map((item) => (
          <ContentCard key={item.id} item={item} viewerId={user.user.id} onChanged={() => setTick((value) => value + 1)} />
        ))}
      </div>
    </main>
  );
}
