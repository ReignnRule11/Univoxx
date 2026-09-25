import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBodyOptional } from "@/lib/http";
import { publishContent } from "@/modules/content/content-service";
import { publishContentSchema } from "@/modules/content/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBodyOptional(request, publishContentSchema);
  const content = await publishContent(auth.user, context.params.contentId, body.visibility);
  return json({ content });
});

export const OPTIONS = apiOptions();
