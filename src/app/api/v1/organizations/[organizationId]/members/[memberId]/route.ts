import { apiOptions, apiRoute } from "@/lib/api-route";
import { json, parseJsonBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { updateMemberSchema } from "@/modules/identity/schemas";
import { removeOrganizationMember, updateOrganizationMember } from "@/modules/identity/organization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateMemberSchema);
  const member = await updateOrganizationMember(
    auth.user,
    context.params.organizationId,
    context.params.memberId,
    body.role,
  );
  return json({ member });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  await removeOrganizationMember(auth.user, context.params.organizationId, context.params.memberId);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
