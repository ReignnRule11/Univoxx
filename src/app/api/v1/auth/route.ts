import { apiOptions, apiRoute } from "@/lib/api-route";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async () =>
  json({
    module: "auth",
    endpoints: [
      "POST /api/v1/auth/register",
      "POST /api/v1/auth/login",
      "POST /api/v1/auth/logout",
      "POST /api/v1/auth/refresh",
      "POST /api/v1/auth/revoke",
      "POST /api/v1/auth/forgot-password",
      "POST /api/v1/auth/reset-password",
    ],
  }),
);

export const OPTIONS = apiOptions();
