import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createComment, listComments } from "@/modules/content/content-service";
import { createContentCommentSchema } from "@/modules/content/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const comments = await listComments(context.params.contentId, auth.user.id);
  return json({ comments });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createContentCommentSchema);
  const comment = await createComment(auth.user, context.params.contentId, body);
  return json({ comment }, { status: 201 });
});

export const OPTIONS = apiOptions();
