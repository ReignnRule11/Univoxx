import { apiOptions, apiRoute } from "@/lib/api-route";
import { json, parseJsonBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { createOrganizationSchema } from "@/modules/identity/schemas";
import { createOrganization, listUserOrganizations } from "@/modules/identity/organization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const organizations = await listUserOrganizations(auth.user.id);
  return json({ organizations });
});

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createOrganizationSchema);
  const organization = await createOrganization(auth.user, body);
  return json({ organization }, { status: 201 });
});

export const OPTIONS = apiOptions();
