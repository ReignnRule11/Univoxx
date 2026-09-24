import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { deleteCommunity, getCommunity, updateCommunity } from "@/modules/community/community-service";
import { updateCommunitySchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const community = await getCommunity(auth.user.id, context.params.communityId);
  return json({ community });
});

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateCommunitySchema);
  const community = await updateCommunity(auth.user, context.params.communityId, body);
  return json({ community });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  await deleteCommunity(auth.user, context.params.communityId);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
