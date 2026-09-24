import { apiOptions, apiRoute } from "@/lib/api-route";
import { json, parseJsonBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { updateProfileSchema } from "@/modules/identity/schemas";
import { getOwnProfile, updateCreatorProfile } from "@/modules/identity/profile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const profile = await getOwnProfile(auth.user);
  return json({ profile });
});

export const PATCH = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateProfileSchema);
  const profile = await updateCreatorProfile(auth.user, body);
  return json({ profile });
});

export const OPTIONS = apiOptions();
