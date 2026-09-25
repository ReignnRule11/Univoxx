import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { assertClientCannotSettle, getTransaction } from "@/modules/payments/payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const transaction = await getTransaction(auth.user.id, context.params.transactionId);
  return json({ transaction });
});

export const POST = apiRoute(async () => {
  assertClientCannotSettle();
});

export const OPTIONS = apiOptions();
