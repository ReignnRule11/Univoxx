import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createProduct, listOwnProducts } from "@/modules/payments/payment-service";
import { createProductSchema } from "@/modules/payments/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const products = await listOwnProducts(auth.user.id);
  return json({ products });
});

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createProductSchema);
  const product = await createProduct(auth.user, body);
  return json({ product }, { status: 201 });
});

export const OPTIONS = apiOptions();
