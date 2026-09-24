import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { addCommunityMember, listCommunityMembers } from "@/modules/community/community-service";
import { addCommunityMemberSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const members = await listCommunityMembers(auth.user.id, context.params.communityId);
  return json({ members });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, addCommunityMemberSchema);
  const member = await addCommunityMember(auth.user, context.params.communityId, {
    userId: body.userId,
    email: body.email,
    role: body.role ?? "MEMBER",
  });
  return json({ member }, { status: 201 });
});

export const OPTIONS = apiOptions();
