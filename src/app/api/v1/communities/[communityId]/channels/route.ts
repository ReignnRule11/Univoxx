import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createChannel, listChannels } from "@/modules/community/content-service";
import { createChannelSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const channels = await listChannels(auth.user.id, context.params.communityId);
  return json({ channels });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createChannelSchema);
  const channel = await createChannel(auth.user, context.params.communityId, body);
  return json({ channel }, { status: 201 });
});

export const OPTIONS = apiOptions();
