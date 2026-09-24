import { apiOptions, apiRoute } from "@/lib/api-route";
import { json, parseJsonBody } from "@/lib/http";
import { requestMeta } from "@/lib/auth";
import { requestPasswordReset } from "@/modules/identity/auth-service";
import { forgotPasswordSchema } from "@/modules/identity/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const body = await parseJsonBody(request, forgotPasswordSchema);
  const result = await requestPasswordReset(body.email, requestMeta(request).ip);
  return json({
    accepted: true,
    ...(result.resetToken ? { resetToken: result.resetToken } : {}),
  });
});

export const OPTIONS = apiOptions();
