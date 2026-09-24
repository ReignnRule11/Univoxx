import { apiOptions, apiRoute } from "@/lib/api-route";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async () => json({ status: "ok", check: "live" }));

export const OPTIONS = apiOptions();
