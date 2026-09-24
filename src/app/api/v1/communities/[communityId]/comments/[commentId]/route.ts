import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { deleteComment, updateComment } from "@/modules/community/content-service";
import { updateCommentSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateCommentSchema);
  const comment = await updateComment(auth.user, context.params.communityId, context.params.commentId, body.body);
  return json({ comment });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const comment = await deleteComment(auth.user, context.params.communityId, context.params.commentId);
  return json({ comment });
});

export const OPTIONS = apiOptions();
