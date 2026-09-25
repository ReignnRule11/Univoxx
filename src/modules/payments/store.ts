import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { conflict } from "@/lib/errors";
import type {
  CreatorMembershipRecord,
  MembershipGrantStatus,
  PaymentAuditRecord,
  ProductRecord,
  ProductStatus,
  ProductType,
  TransactionRecord,
  TransactionStatus,
} from "./types";

export type CreateProductInput = {
  creatorId: string;
  type: ProductType;
  name: string;
  description?: string | null;
  amountCents: number;
  currency: string;
  intervalDays?: number | null;
  status?: ProductStatus;
};

export type UpdateProductInput = Partial<
  Pick<ProductRecord, "name" | "description" | "amountCents" | "currency" | "intervalDays" | "status">
>;

export type CreateTransactionInput = {
  id?: string;
  payerId: string;
  recipientId: string;
  productId: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string;
  platformFeeCents: number;
  creatorAmountCents: number;
  status?: TransactionStatus;
  idempotencyKeyHash?: string | null;
  requestFingerprint?: string | null;
};

export type UpdateTransactionInput = Partial<
  Pick<
    TransactionRecord,
    | "status"
    | "providerReference"
    | "failureReason"
    | "succeededAt"
    | "refundedAt"
    | "amountCents"
    | "platformFeeCents"
    | "creatorAmountCents"
  >
>;

export type CreateAuditInput = {
  transactionId: string;
  actorType: string;
  actorId?: string | null;
  fromStatus?: TransactionStatus | null;
  toStatus?: TransactionStatus | null;
  event: string;
  data?: unknown;
};

export type CreateMembershipInput = {
  subscriberId: string;
  creatorId: string;
  productId: string;
  transactionId: string;
  status?: MembershipGrantStatus;
  startsAt: Date;
  expiresAt?: Date | null;
};

export type PaymentsStore = {
  createProduct(input: CreateProductInput): Promise<ProductRecord>;
  findProductById(id: string): Promise<ProductRecord | null>;
  listProductsByCreator(creatorId: string): Promise<ProductRecord[]>;
  updateProduct(id: string, data: UpdateProductInput): Promise<ProductRecord>;
  createTransaction(input: CreateTransactionInput): Promise<TransactionRecord>;
  findTransactionById(id: string): Promise<TransactionRecord | null>;
  findTransactionByProviderReference(providerReference: string): Promise<TransactionRecord | null>;
  findTransactionByIdempotency(payerId: string, idempotencyKeyHash: string): Promise<TransactionRecord | null>;
  listTransactionsByPayer(payerId: string): Promise<TransactionRecord[]>;
  listTransactionsByRecipient(recipientId: string): Promise<TransactionRecord[]>;
  updateTransaction(id: string, data: UpdateTransactionInput): Promise<TransactionRecord>;
  createAudit(input: CreateAuditInput): Promise<PaymentAuditRecord>;
  listAudits(transactionId: string): Promise<PaymentAuditRecord[]>;
  claimWebhookEvent(provider: string, eventId: string, transactionId?: string | null): Promise<boolean>;
  findWebhookEvent(provider: string, eventId: string): Promise<{ eventId: string; transactionId: string | null } | null>;
  createMembership(input: CreateMembershipInput): Promise<CreatorMembershipRecord>;
  findMembershipByTransaction(transactionId: string): Promise<CreatorMembershipRecord | null>;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const prismaPaymentsStore: PaymentsStore = {
  async createProduct(input) {
    return prisma.product.create({
      data: {
        creatorId: input.creatorId,
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        amountCents: input.amountCents,
        currency: input.currency,
        intervalDays: input.intervalDays ?? null,
        status: input.status ?? "DRAFT",
      },
    });
  },
  async findProductById(id) {
    return prisma.product.findUnique({ where: { id } });
  },
  async listProductsByCreator(creatorId) {
    return prisma.product.findMany({
      where: { creatorId },
      orderBy: { createdAt: "desc" },
    });
  },
  async updateProduct(id, data) {
    return prisma.product.update({ where: { id }, data });
  },
  async createTransaction(input) {
    try {
      return await prisma.transaction.create({
        data: {
          id: input.id,
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
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Duplicate payment request");
      }
      throw error;
    }
  },
  async findTransactionById(id) {
    return prisma.transaction.findUnique({ where: { id } });
  },
  async findTransactionByProviderReference(providerReference) {
    return prisma.transaction.findUnique({ where: { providerReference } });
  },
  async findTransactionByIdempotency(payerId, idempotencyKeyHash) {
    return prisma.transaction.findUnique({
      where: { payerId_idempotencyKeyHash: { payerId, idempotencyKeyHash } },
    });
  },
  async listTransactionsByPayer(payerId) {
    return prisma.transaction.findMany({
      where: { payerId },
      orderBy: { createdAt: "desc" },
    });
  },
  async listTransactionsByRecipient(recipientId) {
    return prisma.transaction.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" },
    });
  },
  async updateTransaction(id, data) {
    return prisma.transaction.update({ where: { id }, data });
  },
  async createAudit(input) {
    return prisma.paymentAuditEvent.create({
      data: {
        transactionId: input.transactionId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        event: input.event,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      },
    });
  },
  async listAudits(transactionId) {
    return prisma.paymentAuditEvent.findMany({
      where: { transactionId },
      orderBy: { createdAt: "asc" },
    });
  },
  async claimWebhookEvent(provider, eventId, transactionId) {
    try {
      await prisma.processedWebhookEvent.create({
        data: { provider, eventId, transactionId: transactionId ?? null },
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  },
  async findWebhookEvent(provider, eventId) {
    const row = await prisma.processedWebhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
    });
    return row ? { eventId: row.eventId, transactionId: row.transactionId } : null;
  },
  async createMembership(input) {
    return prisma.creatorMembership.create({
      data: {
        subscriberId: input.subscriberId,
        creatorId: input.creatorId,
        productId: input.productId,
        transactionId: input.transactionId,
        status: input.status ?? "ACTIVE",
        startsAt: input.startsAt,
        expiresAt: input.expiresAt ?? null,
      },
    });
  },
  async findMembershipByTransaction(transactionId) {
    return prisma.creatorMembership.findFirst({ where: { transactionId } });
  },
};

let activeStore: PaymentsStore = prismaPaymentsStore;

export function getPaymentsStore(): PaymentsStore {
  return activeStore;
}

export function setPaymentsStore(store: PaymentsStore): void {
  activeStore = store;
}

export function resetPaymentsStore(): void {
  activeStore = prismaPaymentsStore;
}
