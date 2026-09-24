import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { applyModerationAction, listModerationActions } from "@/modules/community/moderation-service";
import { createModerationSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const actions = await listModerationActions(auth.user.id, context.params.communityId);
  return json({ actions });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createModerationSchema);
  const action = await applyModerationAction(auth.user, context.params.communityId, body);
  return json({ action }, { status: 201 });
});

export const OPTIONS = apiOptions();
