import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createContent, listOwnContent } from "@/modules/content/content-service";
import { createContentSchema } from "@/modules/content/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const content = await listOwnContent(auth.user.id);
  return json({ content });
});

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createContentSchema);
  const item = await createContent(auth.user, body);
  return json({ content: item }, { status: 201 });
});

export const OPTIONS = apiOptions();
