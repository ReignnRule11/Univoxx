import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody, parseSearchParams } from "@/lib/http";
import { createReaction, listReactions, removeReaction } from "@/modules/community/content-service";
import { createReactionSchema, deleteReactionQuerySchema, listReactionsQuerySchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const query = parseSearchParams(new URL(request.url), listReactionsQuerySchema);
  const reactions = await listReactions(auth.user.id, context.params.communityId, query.targetType, query.targetId);
  return json({ reactions });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createReactionSchema);
  const reaction = await createReaction(auth.user, context.params.communityId, body);
  return json({ reaction }, { status: 201 });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const query = parseSearchParams(new URL(request.url), deleteReactionQuerySchema);
  await removeReaction(auth.user, context.params.communityId, query);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
