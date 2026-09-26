import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { listOwnUsage } from "@/modules/ai/ai-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const usage = await listOwnUsage(auth.user.id);
  return json({ usage });
});

export const OPTIONS = apiOptions();
