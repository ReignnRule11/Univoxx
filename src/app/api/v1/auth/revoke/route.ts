import { apiOptions, apiRoute } from "@/lib/api-route";
import { jsonClearedAuth, parseJsonBodyOptional } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { revokeSessions } from "@/modules/identity/auth-service";
import { revokeSchema } from "@/modules/identity/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBodyOptional(request, revokeSchema);
  const result = await revokeSessions(auth.user.id, auth.session.id, Boolean(body.all));
  return jsonClearedAuth({ ok: true, revoked: result.revoked });
});

export const OPTIONS = apiOptions();
