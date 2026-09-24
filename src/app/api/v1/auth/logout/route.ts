import { apiOptions, apiRoute } from "@/lib/api-route";
import { jsonClearedAuth } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { logoutSession } from "@/modules/identity/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  await logoutSession(auth.session.id);
  return jsonClearedAuth({ ok: true });
});

export const OPTIONS = apiOptions();
