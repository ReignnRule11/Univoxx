import { apiOptions, apiRoute } from "@/lib/api-route";
import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { publicUser } from "@/modules/identity/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  return json({ user: publicUser(auth.user) });
});

export const OPTIONS = apiOptions();
