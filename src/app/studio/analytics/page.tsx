"use client";

import { useSession } from "@/components/session";
import { Card, ErrorState, LoadingState, Metric, MiniChart, PageHeader } from "@/components/ui";
import { compactNumber, money, percent } from "@/lib/format";
import { useApi } from "@/hooks/use-api";
import type { CreatorDashboard } from "@/lib/ui-types";

export default function StudioAnalyticsPage() {
  const { user } = useSession();
  const query = useApi<{ dashboard: CreatorDashboard }>(user ? "/api/v1/analytics" : null);
  const dashboard = query.data?.dashboard;

  return (
    <>
      <PageHeader
        kicker="Studio"
        title="Analytics"
        lede="Server-side aggregation only. Revenue is succeeded payments. Views are unique per viewer and content."
      />
      {query.loading ? <LoadingState label="Loading analytics" /> : null}
      {query.error ? <ErrorState message={query.error} onRetry={() => void query.reload()} /> : null}
      {dashboard ? (
        <div className="stack">
          <p className="lede">
            Range {new Date(dashboard.range.from).toLocaleDateString()} – {new Date(dashboard.range.to).toLocaleDateString()}
          </p>
          <div className="metrics">
            <Metric label="Followers" value={compactNumber(dashboard.audience.followers)} />
            <Metric label="Published" value={compactNumber(dashboard.content.published)} />
            <Metric label="Views" value={compactNumber(dashboard.content.views)} />
            <Metric label="Likes" value={compactNumber(dashboard.content.likes)} />
            <Metric label="Comments" value={compactNumber(dashboard.content.comments)} />
            <Metric label="Shares" value={compactNumber(dashboard.content.shares)} />
            <Metric label="Engagement rate" value={percent(dashboard.content.engagementRate)} />
            <Metric label="Community engagement" value={compactNumber(dashboard.community.engagement)} />
            <Metric label="Gross" value={money(dashboard.monetization.grossRevenueCents, dashboard.monetization.currency)} />
            <Metric label="Fees" value={money(dashboard.monetization.platformFeeCents, dashboard.monetization.currency)} />
            <Metric label="Net" value={money(dashboard.monetization.creatorEarningsCents, dashboard.monetization.currency)} />
            <Metric label="Paying members" value={compactNumber(dashboard.monetization.payingMembers)} />
            <Metric label="Event registrations" value={compactNumber(dashboard.events.registrations)} />
            <Metric label="Attendance" value={compactNumber(dashboard.events.attendance)} />
          </div>
          <div className="grid-cards two">
            <Card>
              <h2>Followers</h2>
              <MiniChart points={dashboard.charts.followers} />
            </Card>
            <Card>
              <h2>Views</h2>
              <MiniChart points={dashboard.charts.views} />
            </Card>
            <Card>
              <h2>Revenue</h2>
              <MiniChart points={dashboard.charts.revenueCents} />
            </Card>
            <Card>
              <h2>Event registrations</h2>
              <MiniChart points={dashboard.charts.eventRegistrations} />
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
