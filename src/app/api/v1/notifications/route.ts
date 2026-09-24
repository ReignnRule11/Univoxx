import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { listNotifications } from "@/modules/community/notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const notifications = await listNotifications(auth.user.id);
  return json({ notifications });
});

export const OPTIONS = apiOptions();
