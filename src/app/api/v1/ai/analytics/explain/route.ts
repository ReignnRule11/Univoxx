import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBodyOptional } from "@/lib/http";
import { explainCreatorAnalytics } from "@/modules/ai/ai-service";
import { analyticsExplainSchema } from "@/modules/ai/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBodyOptional(request, analyticsExplainSchema);
  const result = await explainCreatorAnalytics(auth.user, body.question);
  return json(result, { status: 201 });
});

export const OPTIONS = apiOptions();
