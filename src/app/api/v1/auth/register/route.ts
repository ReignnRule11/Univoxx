import { apiOptions, apiRoute } from "@/lib/api-route";
import { jsonWithAuth, parseJsonBody } from "@/lib/http";
import { requestMeta } from "@/lib/auth";
import { registerUser } from "@/modules/identity/auth-service";
import { registerSchema } from "@/modules/identity/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const body = await parseJsonBody(request, registerSchema);
  const result = await registerUser({ ...body, ...requestMeta(request) });
  return jsonWithAuth(
    {
      user: result.user,
      profile: result.profile,
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      },
    },
    result.tokens,
    { status: 201 },
  );
});

export const OPTIONS = apiOptions();
