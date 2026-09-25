import type { ProductRecord, PublicProduct, PublicTransaction, TransactionRecord } from "./types";

export function publicProduct(product: ProductRecord): PublicProduct {
  return {
    id: product.id,
    creatorId: product.creatorId,
    type: product.type,
    name: product.name,
    description: product.description,
    amountCents: product.amountCents,
    currency: product.currency,
    intervalDays: product.intervalDays,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function publicTransaction(transaction: TransactionRecord): PublicTransaction {
  return {
    id: transaction.id,
    payerId: transaction.payerId,
    recipientId: transaction.recipientId,
    productId: transaction.productId,
    amountCents: transaction.amountCents,
    currency: transaction.currency,
    provider: transaction.provider,
    providerReference: transaction.providerReference,
    platformFeeCents: transaction.platformFeeCents,
    creatorAmountCents: transaction.creatorAmountCents,
    status: transaction.status,
    failureReason: transaction.failureReason,
    succeededAt: transaction.succeededAt ? transaction.succeededAt.toISOString() : null,
    refundedAt: transaction.refundedAt ? transaction.refundedAt.toISOString() : null,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}
