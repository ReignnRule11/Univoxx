import { apiOptions, apiRoute } from "@/lib/api-route";
import { json, parseJsonBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { addMemberSchema } from "@/modules/identity/schemas";
import { addOrganizationMember, listOrganizationMembers } from "@/modules/identity/organization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const members = await listOrganizationMembers(auth.user.id, context.params.organizationId);
  return json({ members });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, addMemberSchema);
  const member = await addOrganizationMember(auth.user, context.params.organizationId, {
    userId: body.userId,
    email: body.email,
    role: body.role ?? "MEMBER",
  });
  return json({ member }, { status: 201 });
});

export const OPTIONS = apiOptions();
