import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { followCreator, unfollowCreator } from "@/modules/content/content-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const follow = await followCreator(auth.user, context.params.creatorId);
  return json({ follow }, { status: 201 });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  await unfollowCreator(auth.user, context.params.creatorId);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
