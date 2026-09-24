import { apiOptions, apiRoute } from "@/lib/api-route";
import { jsonWithAuth, parseJsonBodyOptional } from "@/lib/http";
import { readRefreshToken } from "@/lib/auth";
import { unauthorized } from "@/lib/errors";
import { refreshSession } from "@/modules/identity/auth-service";
import { refreshSchema } from "@/modules/identity/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const body = await parseJsonBodyOptional(request, refreshSchema);
  const raw = body.refreshToken ?? readRefreshToken(request);
  if (!raw) {
    throw unauthorized("Refresh token required");
  }
  const result = await refreshSession(raw);
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
  );
});

export const OPTIONS = apiOptions();
