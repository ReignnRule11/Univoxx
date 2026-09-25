import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody, parseSearchParams } from "@/lib/http";
import { createReaction, deleteReaction, listReactions } from "@/modules/content/content-service";
import { createContentReactionSchema, deleteContentReactionQuerySchema } from "@/modules/content/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const reactions = await listReactions(context.params.contentId, auth.user.id);
  return json({ reactions });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createContentReactionSchema);
  const reaction = await createReaction(auth.user, context.params.contentId, body.emoji);
  return json({ reaction }, { status: 201 });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const query = parseSearchParams(new URL(request.url), deleteContentReactionQuerySchema);
  await deleteReaction(auth.user, context.params.contentId, query.emoji);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
