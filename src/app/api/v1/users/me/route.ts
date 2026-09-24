import { apiOptions, apiRoute } from "@/lib/api-route";
import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { currentUserView } from "@/modules/identity/auth-service";
import { listUserOrganizations } from "@/modules/identity/organization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const view = await currentUserView(auth.user);
  const organizations = await listUserOrganizations(auth.user.id);
  return json({ ...view, organizations });
});

export const OPTIONS = apiOptions();
