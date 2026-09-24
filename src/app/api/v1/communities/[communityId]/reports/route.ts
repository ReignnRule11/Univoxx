import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createReport, listReports } from "@/modules/community/moderation-service";
import { createReportSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const reports = await listReports(auth.user.id, context.params.communityId);
  return json({ reports });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createReportSchema);
  const report = await createReport(auth.user, context.params.communityId, body);
  return json({ report }, { status: 201 });
});

export const OPTIONS = apiOptions();
