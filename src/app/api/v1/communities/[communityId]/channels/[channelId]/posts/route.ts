import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createPost, listPosts } from "@/modules/community/content-service";
import { createPostSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const posts = await listPosts(auth.user.id, context.params.communityId, context.params.channelId);
  return json({ posts });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createPostSchema);
  const post = await createPost(auth.user, context.params.communityId, context.params.channelId, body);
  return json({ post }, { status: 201 });
});

export const OPTIONS = apiOptions();
