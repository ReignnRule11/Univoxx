import { apiOptions, apiRoute } from "@/lib/api-route";
import { moduleNotImplemented } from "@/lib/module-stub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async () => moduleNotImplemented("ai"));
export const POST = apiRoute(async () => moduleNotImplemented("ai"));
export const OPTIONS = apiOptions();
