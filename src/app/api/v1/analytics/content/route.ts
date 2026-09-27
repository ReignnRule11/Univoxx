import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseSearchParams } from "@/lib/http";
import { getCreatorDashboard } from "@/modules/analytics/analytics-service";
import { dashboardQuerySchema } from "@/modules/analytics/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const query = parseSearchParams(new URL(request.url), dashboardQuerySchema);
  const dashboard = await getCreatorDashboard(auth.user, query);
  return json({ range: dashboard.range, content: dashboard.content, chart: dashboard.charts.views });
});

export const OPTIONS = apiOptions();
