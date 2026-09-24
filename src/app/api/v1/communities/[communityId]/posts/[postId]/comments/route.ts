import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createComment, listComments } from "@/modules/community/content-service";
import { createCommentSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const comments = await listComments(auth.user.id, context.params.communityId, context.params.postId);
  return json({ comments });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createCommentSchema);
  const comment = await createComment(auth.user, context.params.communityId, context.params.postId, body);
  return json({ comment }, { status: 201 });
});

export const OPTIONS = apiOptions();
