import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { GET as listProducts, POST as createProduct } from "@/app/api/v1/products/route";
import { GET as getProduct, PATCH as patchProduct } from "@/app/api/v1/products/[productId]/route";
import { GET as listPayments, POST as initiatePayment } from "@/app/api/v1/payments/route";
import { GET as getPayment, POST as settlePayment } from "@/app/api/v1/payments/[transactionId]/route";
import { POST as paymentWebhook } from "@/app/api/v1/payments/webhooks/route";
import { GET as getEarnings } from "@/app/api/v1/creators/me/earnings/route";
import { resetPaymentProvider, signSandboxWebhook } from "@/lib/payments";
import { resetRateLimitStore } from "@/lib/security";
import { resetIdentityStore, setIdentityStore } from "@/modules/identity/store";
import { resetPaymentsStore, setPaymentsStore } from "@/modules/payments/store";
import { emptyRouteContext, routeContext } from "./helpers/invoke";
import { createMemoryStore } from "./helpers/memory-store";
import { createPaymentsMemoryStore } from "./helpers/payments-memory-store";

const PASSWORD = "creator-pass-1";
const WEBHOOK_SECRET = "test-payments-webhook-secret";

type AuthPayload = {
  user: { id: string; email: string };
  tokens: { accessToken: string };
};

function jsonRequest(url: string, method: string, body?: unknown, token?: string, extra?: Record<string, string>): Request {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function registerUser(email: string, displayName: string): Promise<AuthPayload> {
  const response = await register(
    jsonRequest("http://localhost/api/v1/auth/register", "POST", { email, password: PASSWORD, displayName }),
    emptyRouteContext,
  );
  expect(response.status).toBe(201);
  return (await response.json()) as AuthPayload;
}

async function createMembershipProduct(token: string, name = "Club") {
  const response = await createProduct(
    jsonRequest(
      "http://localhost/api/v1/products",
      "POST",
      { type: "MEMBERSHIP", name, amountCents: 1000, currency: "USD", intervalDays: 30 },
      token,
    ),
    emptyRouteContext,
  );
  expect(response.status).toBe(201);
  return response.json() as Promise<{ product: { id: string; amountCents: number; currency: string } }>;
}

function webhookRequest(payload: Record<string, unknown>, secret = WEBHOOK_SECRET, signature?: string): Request {
  const rawBody = JSON.stringify(payload);
  return new Request("http://localhost/api/v1/payments/webhooks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-univox-sandbox-signature": signature ?? signSandboxWebhook(secret, rawBody),
    },
    body: rawBody,
  });
}

describe("payments", () => {
  beforeEach(() => {
    resetRateLimitStore();
    setIdentityStore(createMemoryStore());
    setPaymentsStore(createPaymentsMemoryStore());
    resetPaymentProvider();
  });

  afterEach(() => {
    resetIdentityStore();
    resetPaymentsStore();
    resetPaymentProvider();
    resetRateLimitStore();
  });

  it("creates a paid membership product owned by the creator", async () => {
    const creator = await registerUser("creator@univox.test", "Creator");
    const created = await createProduct(
      jsonRequest(
        "http://localhost/api/v1/products",
        "POST",
        { type: "MEMBERSHIP", name: "Inner Circle", description: "Monthly access", amountCents: 2500, currency: "usd" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.product.type).toBe("MEMBERSHIP");
    expect(body.product.status).toBe("ACTIVE");
    expect(body.product.creatorId).toBe(creator.user.id);
    expect(body.product.currency).toBe("USD");
    const listed = await listProducts(
      jsonRequest("http://localhost/api/v1/products", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.products).toHaveLength(1);
  });

  it("initiates a pending payment and never trusts the client to mark success", async () => {
    const creator = await registerUser("creator@univox.test", "Creator");
    const payer = await registerUser("fan@univox.test", "Fan");
    const { product } = await createMembershipProduct(creator.tokens.accessToken);
    const initiated = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken),
      emptyRouteContext,
    );
    expect(initiated.status).toBe(201);
    const checkout = await initiated.json();
    expect(checkout.transaction.status).toBe("PENDING");
    expect(checkout.transaction.payerId).toBe(payer.user.id);
    expect(checkout.transaction.recipientId).toBe(creator.user.id);
    expect(checkout.transaction.amountCents).toBe(1000);
    expect(checkout.transaction.platformFeeCents).toBe(100);
    expect(checkout.transaction.creatorAmountCents).toBe(900);
    expect(checkout.transaction.provider).toBe("sandbox");
    const clientSettle = await settlePayment(
      jsonRequest(
        `http://localhost/api/v1/payments/${checkout.transaction.id}`,
        "POST",
        { status: "SUCCEEDED" },
        payer.tokens.accessToken,
      ),
      routeContext({ transactionId: checkout.transaction.id }),
    );
    expect(clientSettle.status).toBe(403);
    const stillPending = await getPayment(
      jsonRequest(
        `http://localhost/api/v1/payments/${checkout.transaction.id}`,
        "GET",
        undefined,
        payer.tokens.accessToken,
      ),
      routeContext({ transactionId: checkout.transaction.id }),
    );
    expect(stillPending.status).toBe(200);
    await expect(stillPending.json()).resolves.toMatchObject({ transaction: { status: "PENDING" } });
  });

  it("settles a payment only after a signed successful webhook", async () => {
    const creator = await registerUser("creator@univox.test", "Creator");
    const payer = await registerUser("fan@univox.test", "Fan");
    const { product } = await createMembershipProduct(creator.tokens.accessToken);
    const initiated = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken),
      emptyRouteContext,
    );
    const checkout = await initiated.json();
    const webhook = await paymentWebhook(
      webhookRequest({
        eventId: "evt_success_1",
        providerReference: checkout.transaction.providerReference,
        outcome: "succeeded",
        amountCents: 1000,
        currency: "USD",
      }),
      emptyRouteContext,
    );
    expect(webhook.status).toBe(200);
    const webhookBody = await webhook.json();
    expect(webhookBody.duplicate).toBe(false);
    expect(webhookBody.transaction.status).toBe("SUCCEEDED");
    expect(webhookBody.transaction.succeededAt).toBeTruthy();
    const fetched = await getPayment(
      jsonRequest(
        `http://localhost/api/v1/payments/${checkout.transaction.id}`,
        "GET",
        undefined,
        creator.tokens.accessToken,
      ),
      routeContext({ transactionId: checkout.transaction.id }),
    );
    expect(fetched.status).toBe(200);
    await expect(fetched.json()).resolves.toMatchObject({ transaction: { status: "SUCCEEDED" } });
  });

  it("records a failed provider payment without granting earnings", async () => {
    const creator = await registerUser("creator@univox.test", "Creator");
    const payer = await registerUser("fan@univox.test", "Fan");
    const { product } = await createMembershipProduct(creator.tokens.accessToken);
    const initiated = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken),
      emptyRouteContext,
    );
    const checkout = await initiated.json();
    const webhook = await paymentWebhook(
      webhookRequest({
        eventId: "evt_fail_1",
        providerReference: checkout.transaction.providerReference,
        outcome: "failed",
        amountCents: 1000,
        currency: "USD",
      }),
      emptyRouteContext,
    );
    expect(webhook.status).toBe(200);
    await expect(webhook.json()).resolves.toMatchObject({ transaction: { status: "FAILED" } });
    const earnings = await getEarnings(
      jsonRequest("http://localhost/api/v1/creators/me/earnings", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    const earningsBody = await earnings.json();
    expect(earningsBody.earnings.grossRevenueCents).toBe(0);
    expect(earningsBody.earnings.netCreatorAmountCents).toBe(0);
  });

  it("ignores duplicate webhooks and rejects invalid signatures", async () => {
    const creator = await registerUser("creator@univox.test", "Creator");
    const payer = await registerUser("fan@univox.test", "Fan");
    const { product } = await createMembershipProduct(creator.tokens.accessToken);
    const initiated = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken),
      emptyRouteContext,
    );
    const checkout = await initiated.json();
    const payload = {
      eventId: "evt_dup_1",
      providerReference: checkout.transaction.providerReference,
      outcome: "succeeded",
      amountCents: 1000,
      currency: "USD",
    };
    const first = await paymentWebhook(webhookRequest(payload), emptyRouteContext);
    expect(first.status).toBe(200);
    const second = await paymentWebhook(webhookRequest(payload), emptyRouteContext);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ duplicate: true, transaction: { status: "SUCCEEDED" } });
    const invalid = await paymentWebhook(webhookRequest(payload, WEBHOOK_SECRET, "deadbeef"), emptyRouteContext);
    expect(invalid.status).toBe(401);
  });

  it("returns the same pending transaction for a reused idempotency key", async () => {
    const creator = await registerUser("creator@univox.test", "Creator");
    const payer = await registerUser("fan@univox.test", "Fan");
    const { product } = await createMembershipProduct(creator.tokens.accessToken);
    const first = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken, {
        "idempotency-key": "pay-once",
      }),
      emptyRouteContext,
    );
    const firstBody = await first.json();
    const second = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken, {
        "idempotency-key": "pay-once",
      }),
      emptyRouteContext,
    );
    expect(second.status).toBe(201);
    const secondBody = await second.json();
    expect(secondBody.transaction.id).toBe(firstBody.transaction.id);
    const other = await createMembershipProduct(creator.tokens.accessToken, "Club B");
    const conflicted = await initiatePayment(
      jsonRequest(
        "http://localhost/api/v1/payments",
        "POST",
        { productId: other.product.id },
        payer.tokens.accessToken,
        { "idempotency-key": "pay-once" },
      ),
      emptyRouteContext,
    );
    expect(conflicted.status).toBe(409);
  });

  it("rejects authorization bypass and mismatched webhook amounts", async () => {
    const creator = await registerUser("creator@univox.test", "Creator");
    const payer = await registerUser("fan@univox.test", "Fan");
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const { product } = await createMembershipProduct(creator.tokens.accessToken);
    const patched = await patchProduct(
      jsonRequest(
        `http://localhost/api/v1/products/${product.id}`,
        "PATCH",
        { name: "Hijacked" },
        stranger.tokens.accessToken,
      ),
      routeContext({ productId: product.id }),
    );
    expect(patched.status).toBe(403);
    const initiated = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken),
      emptyRouteContext,
    );
    const checkout = await initiated.json();
    const strangerView = await getPayment(
      jsonRequest(
        `http://localhost/api/v1/payments/${checkout.transaction.id}`,
        "GET",
        undefined,
        stranger.tokens.accessToken,
      ),
      routeContext({ transactionId: checkout.transaction.id }),
    );
    expect(strangerView.status).toBe(403);
    const mismatch = await paymentWebhook(
      webhookRequest({
        eventId: "evt_mismatch",
        providerReference: checkout.transaction.providerReference,
        outcome: "succeeded",
        amountCents: 9999,
        currency: "USD",
      }),
      emptyRouteContext,
    );
    expect(mismatch.status).toBe(409);
    const listed = await listPayments(
      jsonRequest("http://localhost/api/v1/payments", "GET", undefined, payer.tokens.accessToken),
      emptyRouteContext,
    );
    const listedBody = await listed.json();
    expect(listedBody.transactions[0].status).toBe("PENDING");
  });

  it("calculates creator earnings from verified successful transactions only", async () => {
    const creator = await registerUser("creator@univox.test", "Creator");
    const payer = await registerUser("fan@univox.test", "Fan");
    const { product } = await createMembershipProduct(creator.tokens.accessToken, "Club A");
    const first = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken),
      emptyRouteContext,
    );
    const firstCheckout = await first.json();
    await paymentWebhook(
      webhookRequest({
        eventId: "evt_earn_1",
        providerReference: firstCheckout.transaction.providerReference,
        outcome: "succeeded",
        amountCents: 1000,
        currency: "USD",
      }),
      emptyRouteContext,
    );
    const second = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId: product.id }, payer.tokens.accessToken),
      emptyRouteContext,
    );
    const secondCheckout = await second.json();
    await paymentWebhook(
      webhookRequest({
        eventId: "evt_earn_2",
        providerReference: secondCheckout.transaction.providerReference,
        outcome: "failed",
        amountCents: 1000,
        currency: "USD",
      }),
      emptyRouteContext,
    );
    const earnings = await getEarnings(
      jsonRequest("http://localhost/api/v1/creators/me/earnings", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    expect(earnings.status).toBe(200);
    const body = await earnings.json();
    expect(body.earnings.grossRevenueCents).toBe(1000);
    expect(body.earnings.platformFeeCents).toBe(100);
    expect(body.earnings.netCreatorAmountCents).toBe(900);
    expect(body.earnings.succeededCount).toBe(1);
    expect(body.earnings.transactions).toHaveLength(2);
    const stranger = await registerUser("other@univox.test", "Other");
    const strangerEarnings = await getEarnings(
      jsonRequest("http://localhost/api/v1/creators/me/earnings", "GET", undefined, stranger.tokens.accessToken),
      emptyRouteContext,
    );
    const strangerBody = await strangerEarnings.json();
    expect(strangerBody.earnings.grossRevenueCents).toBe(0);
    const ownProduct = await getProduct(
      jsonRequest(`http://localhost/api/v1/products/${product.id}`, "GET", undefined, payer.tokens.accessToken),
      routeContext({ productId: product.id }),
    );
    expect(ownProduct.status).toBe(200);
  });
});
