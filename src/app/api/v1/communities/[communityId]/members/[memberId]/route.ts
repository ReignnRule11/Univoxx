import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { removeCommunityMember, updateCommunityMember } from "@/modules/community/community-service";
import { updateCommunityMemberSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateCommunityMemberSchema);
  const member = await updateCommunityMember(auth.user, context.params.communityId, context.params.memberId, body);
  return json({ member });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  await removeCommunityMember(auth.user, context.params.communityId, context.params.memberId);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
