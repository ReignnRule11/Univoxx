import { apiOptions, apiRoute } from "@/lib/api-route";
import { moduleNotImplemented } from "@/lib/module-stub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async () => moduleNotImplemented("analytics"));
export const POST = apiRoute(async () => moduleNotImplemented("analytics"));
export const OPTIONS = apiOptions();
