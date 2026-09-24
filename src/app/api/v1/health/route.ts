import { apiOptions, apiRoute } from "@/lib/api-route";
import { checkDatabase } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async () => {
  const config = getConfig();
  const database = await checkDatabase();
  const status = database.ok ? 200 : 503;
  return json(
    {
      status: database.ok ? "ok" : "degraded",
      version: "v1",
      service: "univox",
      env: config.NODE_ENV,
      checks: {
        config: "ok",
        database: database.ok ? "ok" : "error",
      },
      time: new Date().toISOString(),
    },
    { status },
  );
});

export const OPTIONS = apiOptions();
