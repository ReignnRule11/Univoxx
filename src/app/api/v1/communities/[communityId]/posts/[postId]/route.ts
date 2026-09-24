import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { deletePost, getPost, updatePost } from "@/modules/community/content-service";
import { updatePostSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const post = await getPost(auth.user.id, context.params.communityId, context.params.postId);
  return json({ post });
});

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updatePostSchema);
  const post = await updatePost(auth.user, context.params.communityId, context.params.postId, body);
  return json({ post });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const post = await deletePost(auth.user, context.params.communityId, context.params.postId);
  return json({ post });
});

export const OPTIONS = apiOptions();
