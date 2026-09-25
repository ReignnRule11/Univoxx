import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { getProduct, updateProduct } from "@/modules/payments/payment-service";
import { updateProductSchema } from "@/modules/payments/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const product = await getProduct(context.params.productId, auth.user.id);
  return json({ product });
});

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateProductSchema);
  const product = await updateProduct(auth.user, context.params.productId, body);
  return json({ product });
});

export const OPTIONS = apiOptions();
