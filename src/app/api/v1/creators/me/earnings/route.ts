import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { getCreatorEarnings } from "@/modules/payments/payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const earnings = await getCreatorEarnings(auth.user.id);
  return json({ earnings });
});

export const OPTIONS = apiOptions();
