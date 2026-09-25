import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseSearchParams } from "@/lib/http";
import { listFeed } from "@/modules/content/content-service";
import { feedQuerySchema } from "@/modules/content/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const query = parseSearchParams(new URL(request.url), feedQuerySchema);
  const feed = await listFeed(auth.user.id, {
    scope: query.scope ?? "newest",
    communityId: query.communityId,
    limit: query.limit ?? 20,
    cursor: query.cursor,
  });
  return json(feed);
});

export const OPTIONS = apiOptions();
