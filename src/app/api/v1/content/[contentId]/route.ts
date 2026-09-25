import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { deleteContent, getContent, updateContent } from "@/modules/content/content-service";
import { updateContentSchema } from "@/modules/content/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const content = await getContent(context.params.contentId, auth.user.id);
  return json({ content });
});

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateContentSchema);
  const content = await updateContent(auth.user, context.params.contentId, body);
  return json({ content });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  await deleteContent(auth.user, context.params.contentId);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
