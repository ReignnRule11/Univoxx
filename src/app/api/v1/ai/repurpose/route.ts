import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { repurposeContent } from "@/modules/ai/ai-service";
import { repurposeSchema } from "@/modules/ai/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, repurposeSchema);
  const result = await repurposeContent(auth.user, body);
  return json(result, { status: 201 });
});

export const OPTIONS = apiOptions();
