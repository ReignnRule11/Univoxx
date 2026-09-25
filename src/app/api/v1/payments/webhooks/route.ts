import { apiOptions, apiRoute } from "@/lib/api-route";
import { json } from "@/lib/http";
import { handlePaymentWebhook } from "@/modules/payments/payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  const result = await handlePaymentWebhook(request);
  return json({
    ok: true,
    duplicate: result.duplicate,
    transaction: result.transaction ?? null,
  });
});

export const OPTIONS = apiOptions();
