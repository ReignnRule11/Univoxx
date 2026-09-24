import { apiOptions, apiRoute } from "@/lib/api-route";
import { json, parseJsonBody } from "@/lib/http";
import { resetPassword } from "@/modules/identity/auth-service";
import { resetPasswordSchema } from "@/modules/identity/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const body = await parseJsonBody(request, resetPasswordSchema);
  await resetPassword(body.token, body.password);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
