import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { initiatePayment, listOwnPurchases } from "@/modules/payments/payment-service";
import { initiatePaymentSchema } from "@/modules/payments/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const transactions = await listOwnPurchases(auth.user.id);
  return json({
    module: "payments",
    endpoints: [
      "GET /api/v1/payments",
      "POST /api/v1/payments",
      "GET /api/v1/payments/{transactionId}",
      "POST /api/v1/payments/webhooks",
      "GET /api/v1/products",
      "POST /api/v1/products",
      "GET /api/v1/creators/me/earnings",
    ],
    transactions,
  });
});

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, initiatePaymentSchema);
  const checkout = await initiatePayment(auth.user, body.productId, request.headers.get("idempotency-key"));
  return json(checkout, { status: 201 });
});

export const OPTIONS = apiOptions();
