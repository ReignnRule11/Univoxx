import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { shareContent } from "@/modules/content/content-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const share = await shareContent(auth.user, context.params.contentId);
  return json({ share }, { status: 201 });
});

export const OPTIONS = apiOptions();
