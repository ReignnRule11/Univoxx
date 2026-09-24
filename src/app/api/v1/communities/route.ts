import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody, parseSearchParams } from "@/lib/http";
import { createCommunity, listCommunities } from "@/modules/community/community-service";
import { createCommunitySchema, listCommunitiesQuerySchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const query = parseSearchParams(new URL(request.url), listCommunitiesQuerySchema);
  const communities = await listCommunities(auth.user.id, query.organizationId);
  return json({ communities });
});

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createCommunitySchema);
  const community = await createCommunity(auth.user, body);
  return json({ community }, { status: 201 });
});

export const OPTIONS = apiOptions();
