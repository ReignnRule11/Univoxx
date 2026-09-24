import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { markNotification } from "@/modules/community/notification-service";
import { markNotificationSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, markNotificationSchema);
  const notification = await markNotification(auth.user.id, context.params.notificationId, body.read);
  return json({ notification });
});

export const OPTIONS = apiOptions();
