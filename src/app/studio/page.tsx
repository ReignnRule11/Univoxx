"use client";

import Link from "next/link";
import { useSession } from "@/components/session";
import { ErrorState, LoadingState, Metric, MiniChart, PageHeader } from "@/components/ui";
import { compactNumber, money, percent } from "@/lib/format";
import { useApi } from "@/hooks/use-api";
import type { CreatorDashboard } from "@/lib/ui-types";

export default function StudioOverviewPage() {
  const { user } = useSession();
  const query = useApi<{ dashboard: CreatorDashboard }>(user ? "/api/v1/analytics" : null);
  const dashboard = query.data?.dashboard;

  return (
    <>
      <PageHeader
        kicker="Creator Studio"
        title="Overview"
        lede="Verified numbers from your own persisted data. Nothing here is estimated or vanity-inflated."
        actions={
          <Link className="btn" href="/studio/content">
            New draft
          </Link>
        }
      />
      {query.loading ? <LoadingState label="Loading overview" /> : null}
      {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
      {dashboard ? (
        <div className="stack">
          <div className="metrics">
            <Metric label="Followers" value={compactNumber(dashboard.audience.followers)} hint={`+${dashboard.audience.followerGrowth} in range`} />
            <Metric label="Views" value={compactNumber(dashboard.content.views)} hint={`${dashboard.content.published} published`} />
            <Metric label="Engagement" value={percent(dashboard.content.engagementRate)} />
            <Metric
              label="Earnings"
              value={money(dashboard.monetization.creatorEarningsCents, dashboard.monetization.currency)}
              hint={`${dashboard.monetization.payingMembers} paying members`}
            />
          </div>
          <section className="card">
            <h2>Views</h2>
            <MiniChart points={dashboard.charts.views} />
          </section>
        </div>
      ) : null}
    </>
  );
}
