import { apiOptions, apiRoute } from "@/lib/api-route";
import { json, parseJsonBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { createProfileSchema } from "@/modules/identity/schemas";
import { createCreatorProfile, getOwnProfile } from "@/modules/identity/profile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const profile = await getOwnProfile(auth.user);
  return json({ profile });
});

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createProfileSchema);
  const profile = await createCreatorProfile(auth.user, body);
  return json({ profile }, { status: 201 });
});

export const OPTIONS = apiOptions();
