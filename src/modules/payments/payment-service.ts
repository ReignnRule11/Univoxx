import { createHash, randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import { conflict, forbidden, notFound, unauthorized, validationError } from "@/lib/errors";
import { getPaymentProvider } from "@/lib/payments";
import type { UserRecord } from "@/modules/identity/types";
import { publicProduct, publicTransaction } from "./serializers";
import { getPaymentsStore } from "./store";
import type {
  CreatorEarnings,
  ProductStatus,
  ProductType,
  PublicCheckout,
  PublicProduct,
  PublicTransaction,
  TransactionRecord,
  TransactionStatus,
} from "./types";

const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  PENDING: ["PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"],
  PROCESSING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: ["REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

function hashIdempotency(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function fingerprint(productId: string, amountCents: number, currency: string): string {
  return createHash("sha256").update(`${productId}:${amountCents}:${currency}`).digest("hex");
}

export function splitAmount(amountCents: number, feeBps = getConfig().PAYMENTS_PLATFORM_FEE_BPS): {
  platformFeeCents: number;
  creatorAmountCents: number;
} {
  const platformFeeCents = Math.floor((amountCents * feeBps) / 10_000);
  return { platformFeeCents, creatorAmountCents: amountCents - platformFeeCents };
}

function assertTransition(from: TransactionStatus, to: TransactionStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw conflict(`Invalid transaction transition ${from} -> ${to}`);
  }
}

async function requireProduct(productId: string) {
  const product = await getPaymentsStore().findProductById(productId);
  if (!product) {
    throw notFound("Product not found");
  }
  return product;
}

export async function createProduct(
  user: UserRecord,
  input: {
    type?: ProductType;
    name: string;
    description?: string;
    amountCents: number;
    currency?: string;
    intervalDays?: number;
    status?: ProductStatus;
  },
): Promise<PublicProduct> {
  const type = input.type ?? "MEMBERSHIP";
  if (type !== "MEMBERSHIP") {
    throw validationError("Only membership products are supported in this release");
  }
  const product = await getPaymentsStore().createProduct({
    creatorId: user.id,
    type,
    name: input.name,
    description: input.description ?? null,
    amountCents: input.amountCents,
    currency: (input.currency ?? "USD").toUpperCase(),
    intervalDays: input.intervalDays ?? 30,
    status: input.status ?? "ACTIVE",
  });
  return publicProduct(product);
}

export async function listOwnProducts(userId: string): Promise<PublicProduct[]> {
  const products = await getPaymentsStore().listProductsByCreator(userId);
  return products.map(publicProduct);
}

export async function getProduct(productId: string, viewerId: string): Promise<PublicProduct> {
  const product = await requireProduct(productId);
  if (product.status !== "ACTIVE" && product.creatorId !== viewerId) {
    throw notFound("Product not found");
  }
  return publicProduct(product);
}

export async function updateProduct(
  user: UserRecord,
  productId: string,
  input: {
    name?: string;
    description?: string | null;
    amountCents?: number;
    currency?: string;
    intervalDays?: number | null;
    status?: ProductStatus;
  },
): Promise<PublicProduct> {
  const product = await requireProduct(productId);
  if (product.creatorId !== user.id) {
    throw forbidden("Only the product owner can update this product");
  }
  const updated = await getPaymentsStore().updateProduct(product.id, {
    ...input,
    currency: input.currency ? input.currency.toUpperCase() : undefined,
  });
  return publicProduct(updated);
}

export async function initiatePayment(
  user: UserRecord,
  productId: string,
  idempotencyKey?: string | null,
): Promise<PublicCheckout> {
  const product = await requireProduct(productId);
  if (product.status !== "ACTIVE") {
    throw forbidden("Product is not available for purchase");
  }
  if (product.creatorId === user.id) {
    throw forbidden("Creators cannot purchase their own product");
  }
  const store = getPaymentsStore();
  const keyHash = idempotencyKey ? hashIdempotency(idempotencyKey) : null;
  const requestFingerprint = fingerprint(product.id, product.amountCents, product.currency);
  if (keyHash) {
    const existing = await store.findTransactionByIdempotency(user.id, keyHash);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw conflict("Idempotency key reused with a different payment request");
      }
      return {
        transaction: publicTransaction(existing),
        checkoutUrl: `/api/v1/payments/${existing.id}`,
      };
    }
  }
  const provider = getPaymentProvider();
  const { platformFeeCents, creatorAmountCents } = splitAmount(product.amountCents);
  const transactionId = `txn_${randomUUID()}`;
  const checkout = await provider.createCheckout({
    transactionId,
    amountCents: product.amountCents,
    currency: product.currency,
    payerEmail: user.email,
    productName: product.name,
  });
  const transaction = await store.createTransaction({
    id: transactionId,
    payerId: user.id,
    recipientId: product.creatorId,
    productId: product.id,
    amountCents: product.amountCents,
    currency: product.currency,
    provider: checkout.provider,
    providerReference: checkout.providerReference,
    platformFeeCents,
    creatorAmountCents,
    status: "PENDING",
    idempotencyKeyHash: keyHash,
    requestFingerprint,
  });
  await store.createAudit({
    transactionId: transaction.id,
    actorType: "payer",
    actorId: user.id,
    fromStatus: null,
    toStatus: "PENDING",
    event: "payment.initiated",
    data: { productId: product.id, provider: checkout.provider },
  });
  return { transaction: publicTransaction(transaction), checkoutUrl: checkout.checkoutUrl };
}

export async function getTransaction(userId: string, transactionId: string): Promise<PublicTransaction> {
  const transaction = await getPaymentsStore().findTransactionById(transactionId);
  if (!transaction) {
    throw notFound("Transaction not found");
  }
  if (transaction.payerId !== userId && transaction.recipientId !== userId) {
    throw forbidden("Not authorized to view this transaction");
  }
  return publicTransaction(transaction);
}

export async function listOwnPurchases(userId: string): Promise<PublicTransaction[]> {
  const rows = await getPaymentsStore().listTransactionsByPayer(userId);
  return rows.map(publicTransaction);
}

export async function getCreatorEarnings(userId: string): Promise<CreatorEarnings> {
  const rows = await getPaymentsStore().listTransactionsByRecipient(userId);
  const succeeded = rows.filter((row) => row.status === "SUCCEEDED");
  const grossRevenueCents = succeeded.reduce((sum, row) => sum + row.amountCents, 0);
  const platformFeeCents = succeeded.reduce((sum, row) => sum + row.platformFeeCents, 0);
  const netCreatorAmountCents = succeeded.reduce((sum, row) => sum + row.creatorAmountCents, 0);
  return {
    grossRevenueCents,
    platformFeeCents,
    netCreatorAmountCents,
    succeededCount: succeeded.length,
    currency: succeeded[0]?.currency ?? rows[0]?.currency ?? "USD",
    transactions: rows.map(publicTransaction),
  };
}

async function applyVerifiedOutcome(
  transaction: TransactionRecord,
  outcome: "succeeded" | "failed" | "cancelled" | "refunded",
  actorId: string | null,
): Promise<TransactionRecord> {
  const store = getPaymentsStore();
  const nextStatus: TransactionStatus =
    outcome === "succeeded"
      ? "SUCCEEDED"
      : outcome === "failed"
        ? "FAILED"
        : outcome === "cancelled"
          ? "CANCELLED"
          : "REFUNDED";
  if (transaction.status === nextStatus) {
    return transaction;
  }
  assertTransition(transaction.status, nextStatus);
  const now = new Date();
  const updated = await store.updateTransaction(transaction.id, {
    status: nextStatus,
    succeededAt: nextStatus === "SUCCEEDED" ? now : transaction.succeededAt,
    refundedAt: nextStatus === "REFUNDED" ? now : transaction.refundedAt,
    failureReason: nextStatus === "FAILED" ? "provider_failed" : transaction.failureReason,
  });
  await store.createAudit({
    transactionId: transaction.id,
    actorType: "provider",
    actorId,
    fromStatus: transaction.status,
    toStatus: nextStatus,
    event: `payment.${outcome}`,
    data: { provider: transaction.provider, providerReference: transaction.providerReference },
  });
  if (nextStatus === "SUCCEEDED") {
    const existing = await store.findMembershipByTransaction(transaction.id);
    if (!existing) {
      const product = await requireProduct(transaction.productId);
      const expiresAt =
        product.intervalDays && product.intervalDays > 0
          ? new Date(now.getTime() + product.intervalDays * 24 * 60 * 60 * 1000)
          : null;
      await store.createMembership({
        subscriberId: transaction.payerId,
        creatorId: transaction.recipientId,
        productId: transaction.productId,
        transactionId: transaction.id,
        startsAt: now,
        expiresAt,
      });
    }
  }
  return updated;
}

export async function handlePaymentWebhook(request: Request): Promise<{ duplicate: boolean; transaction?: PublicTransaction }> {
  const rawBody = await request.text();
  const provider = getPaymentProvider();
  const verified = await provider.verifyWebhook(request, rawBody);
  const store = getPaymentsStore();
  let transaction = await store.findTransactionByProviderReference(verified.providerReference);
  if (!transaction) {
    throw notFound("Transaction not found for provider reference");
  }
  if (transaction.provider !== verified.provider) {
    throw unauthorized("Webhook provider does not match transaction");
  }
  if (transaction.amountCents !== verified.amountCents || transaction.currency !== verified.currency) {
    throw conflict("Webhook amount or currency does not match transaction");
  }
  const claimed = await store.claimWebhookEvent(verified.provider, verified.eventId, transaction.id);
  if (!claimed) {
    return { duplicate: true, transaction: publicTransaction(transaction) };
  }
  if (transaction.status === "PENDING") {
    transaction = await store.updateTransaction(transaction.id, { status: "PROCESSING" });
    await store.createAudit({
      transactionId: transaction.id,
      actorType: "provider",
      actorId: verified.eventId,
      fromStatus: "PENDING",
      toStatus: "PROCESSING",
      event: "payment.processing",
      data: { eventId: verified.eventId },
    });
  }
  const updated = await applyVerifiedOutcome(transaction, verified.outcome, verified.eventId);
  return { duplicate: false, transaction: publicTransaction(updated) };
}

export function assertClientCannotSettle(): never {
  throw forbidden("Payment status must come from a verified provider webhook");
}
