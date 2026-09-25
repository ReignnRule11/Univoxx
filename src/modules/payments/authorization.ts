import { forbidden, notFound } from "@/lib/errors";
import { getPaymentsStore } from "./store";
import type { ProductRecord, TransactionRecord } from "./types";

export async function requireProductOwner(productId: string, userId: string): Promise<ProductRecord> {
  const product = await getPaymentsStore().findProductById(productId);
  if (!product) {
    throw notFound("Product not found");
  }
  if (product.creatorId !== userId) {
    throw forbidden("Only the product owner can manage this product");
  }
  return product;
}

export async function requireTransactionParty(transactionId: string, userId: string): Promise<TransactionRecord> {
  const transaction = await getPaymentsStore().findTransactionById(transactionId);
  if (!transaction) {
    throw notFound("Transaction not found");
  }
  if (transaction.payerId !== userId && transaction.recipientId !== userId) {
    throw forbidden("Not authorized to view this transaction");
  }
  return transaction;
}
