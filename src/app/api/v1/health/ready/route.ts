import { apiOptions, apiRoute } from "@/lib/api-route";
import { checkDatabase } from "@/lib/db";
import { json } from "@/lib/http";
import { serviceUnavailable } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async () => {
  const database = await checkDatabase();
  if (!database.ok) {
    throw serviceUnavailable("Database is not ready");
  }
  return json({ status: "ok", check: "ready", database: "ok" });
});

export const OPTIONS = apiOptions();
