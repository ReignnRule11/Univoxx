import { conflict } from "@/lib/errors";
import type {
  CreateAuditInput,
  CreateMembershipInput,
  CreateProductInput,
  CreateTransactionInput,
  PaymentsStore,
  UpdateProductInput,
  UpdateTransactionInput,
} from "@/modules/payments/store";
import type {
  CreatorMembershipRecord,
  PaymentAuditRecord,
  ProductRecord,
  TransactionRecord,
} from "@/modules/payments/types";

function now(): Date {
  return new Date();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createPaymentsMemoryStore(): PaymentsStore {
  const products = new Map<string, ProductRecord>();
  const transactions = new Map<string, TransactionRecord>();
  const audits = new Map<string, PaymentAuditRecord>();
  const webhooks = new Map<string, { provider: string; eventId: string; transactionId: string | null }>();
  const memberships = new Map<string, CreatorMembershipRecord>();

  function webhookKey(provider: string, eventId: string): string {
    return `${provider}:${eventId}`;
  }

  const store: PaymentsStore = {
    async createProduct(input: CreateProductInput) {
      const created: ProductRecord = {
        id: id("product"),
        creatorId: input.creatorId,
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        amountCents: input.amountCents,
        currency: input.currency,
        intervalDays: input.intervalDays ?? null,
        status: input.status ?? "DRAFT",
        createdAt: now(),
        updatedAt: now(),
      };
      products.set(created.id, created);
      return created;
    },
    async findProductById(productId) {
      return products.get(productId) ?? null;
    },
    async listProductsByCreator(creatorId) {
      return [...products.values()]
        .filter((row) => row.creatorId === creatorId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async updateProduct(productId, data: UpdateProductInput) {
      const current = products.get(productId);
      if (!current) {
        throw new Error("Product not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      products.set(productId, updated);
      return updated;
    },
    async createTransaction(input: CreateTransactionInput) {
      if ([...transactions.values()].some((row) => row.providerReference === input.providerReference)) {
        throw conflict("Duplicate payment request");
      }
      if (
        input.idempotencyKeyHash &&
        [...transactions.values()].some(
          (row) => row.payerId === input.payerId && row.idempotencyKeyHash === input.idempotencyKeyHash,
        )
      ) {
        throw conflict("Duplicate payment request");
      }
      const created: TransactionRecord = {
        id: input.id ?? id("txn"),
        payerId: input.payerId,
        recipientId: input.recipientId,
        productId: input.productId,
        amountCents: input.amountCents,
        currency: input.currency,
        provider: input.provider,
        providerReference: input.providerReference,
        platformFeeCents: input.platformFeeCents,
        creatorAmountCents: input.creatorAmountCents,
        status: input.status ?? "PENDING",
        idempotencyKeyHash: input.idempotencyKeyHash ?? null,
        requestFingerprint: input.requestFingerprint ?? null,
        failureReason: null,
        succeededAt: null,
        refundedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      transactions.set(created.id, created);
      return created;
    },
    async findTransactionById(transactionId) {
      return transactions.get(transactionId) ?? null;
    },
    async findTransactionByProviderReference(providerReference) {
      return [...transactions.values()].find((row) => row.providerReference === providerReference) ?? null;
    },
    async findTransactionByIdempotency(payerId, idempotencyKeyHash) {
      return (
        [...transactions.values()].find(
          (row) => row.payerId === payerId && row.idempotencyKeyHash === idempotencyKeyHash,
        ) ?? null
      );
    },
    async listTransactionsByPayer(payerId) {
      return [...transactions.values()]
        .filter((row) => row.payerId === payerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async listTransactionsByRecipient(recipientId) {
      return [...transactions.values()]
        .filter((row) => row.recipientId === recipientId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async updateTransaction(transactionId, data: UpdateTransactionInput) {
      const current = transactions.get(transactionId);
      if (!current) {
        throw new Error("Transaction not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      transactions.set(transactionId, updated);
      return updated;
    },
    async createAudit(input: CreateAuditInput) {
      const created: PaymentAuditRecord = {
        id: id("audit"),
        transactionId: input.transactionId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        event: input.event,
        data: input.data ?? {},
        createdAt: now(),
      };
      audits.set(created.id, created);
      return created;
    },
    async listAudits(transactionId) {
      return [...audits.values()]
        .filter((row) => row.transactionId === transactionId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async claimWebhookEvent(provider, eventId, transactionId) {
      const key = webhookKey(provider, eventId);
      if (webhooks.has(key)) {
        return false;
      }
      webhooks.set(key, { provider, eventId, transactionId: transactionId ?? null });
      return true;
    },
    async findWebhookEvent(provider, eventId) {
      return webhooks.get(webhookKey(provider, eventId)) ?? null;
    },
    async createMembership(input: CreateMembershipInput) {
      const created: CreatorMembershipRecord = {
        id: id("membership"),
        subscriberId: input.subscriberId,
        creatorId: input.creatorId,
        productId: input.productId,
        transactionId: input.transactionId,
        status: input.status ?? "ACTIVE",
        startsAt: input.startsAt,
        expiresAt: input.expiresAt ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      memberships.set(created.id, created);
      return created;
    },
    async findMembershipByTransaction(transactionId) {
      return [...memberships.values()].find((row) => row.transactionId === transactionId) ?? null;
    },
    async findActiveMembership(subscriberId, creatorId, at = now()) {
      return (
        [...memberships.values()].find(
          (row) =>
            row.subscriberId === subscriberId &&
            row.creatorId === creatorId &&
            row.status === "ACTIVE" &&
            row.startsAt.getTime() <= at.getTime() &&
            (!row.expiresAt || row.expiresAt.getTime() > at.getTime()),
        ) ?? null
      );
    },
  };

  return store;
}
