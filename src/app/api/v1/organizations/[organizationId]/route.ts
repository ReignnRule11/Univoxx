import { apiOptions, apiRoute } from "@/lib/api-route";
import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { getOrganization } from "@/modules/identity/organization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const organization = await getOrganization(auth.user.id, context.params.organizationId);
  return json({ organization });
});

export const OPTIONS = apiOptions();
