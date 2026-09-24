import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { deleteChannel, getChannel, updateChannel } from "@/modules/community/content-service";
import { updateChannelSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const channel = await getChannel(auth.user.id, context.params.communityId, context.params.channelId);
  return json({ channel });
});

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateChannelSchema);
  const channel = await updateChannel(auth.user, context.params.communityId, context.params.channelId, body);
  return json({ channel });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  await deleteChannel(auth.user, context.params.communityId, context.params.channelId);
  return json({ ok: true });
});

export const OPTIONS = apiOptions();
