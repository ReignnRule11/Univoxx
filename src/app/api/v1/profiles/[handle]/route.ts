import { apiOptions, apiRoute } from "@/lib/api-route";
import { json } from "@/lib/http";
import { readAccessToken, verifySession } from "@/lib/auth";
import { getPublicProfile } from "@/modules/identity/profile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  let viewerId: string | undefined;
  const token = readAccessToken(request);
  if (token) {
    try {
      const claims = await verifySession(token);
      viewerId = claims.sub;
    } catch {
      viewerId = undefined;
    }
  }
  const profile = await getPublicProfile(context.params.handle, viewerId);
  return json({ profile });
});

export const OPTIONS = apiOptions();
