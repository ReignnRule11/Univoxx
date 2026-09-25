export const PRODUCT_TYPES = ["MEMBERSHIP", "DIGITAL", "EVENT", "TIP"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const TRANSACTION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const MEMBERSHIP_GRANT_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED"] as const;
export type MembershipGrantStatus = (typeof MEMBERSHIP_GRANT_STATUSES)[number];

export type ProductRecord = {
  id: string;
  creatorId: string;
  type: ProductType;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  intervalDays: number | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionRecord = {
  id: string;
  payerId: string;
  recipientId: string;
  productId: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string;
  platformFeeCents: number;
  creatorAmountCents: number;
  status: TransactionStatus;
  idempotencyKeyHash: string | null;
  requestFingerprint: string | null;
  failureReason: string | null;
  succeededAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentAuditRecord = {
  id: string;
  transactionId: string;
  actorType: string;
  actorId: string | null;
  fromStatus: TransactionStatus | null;
  toStatus: TransactionStatus | null;
  event: string;
  data: unknown;
  createdAt: Date;
};

export type CreatorMembershipRecord = {
  id: string;
  subscriberId: string;
  creatorId: string;
  productId: string;
  transactionId: string;
  status: MembershipGrantStatus;
  startsAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicProduct = {
  id: string;
  creatorId: string;
  type: ProductType;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  intervalDays: number | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
};

export type PublicTransaction = {
  id: string;
  payerId: string;
  recipientId: string;
  productId: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string;
  platformFeeCents: number;
  creatorAmountCents: number;
  status: TransactionStatus;
  failureReason: string | null;
  succeededAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicCheckout = {
  transaction: PublicTransaction;
  checkoutUrl: string;
};

export type CreatorEarnings = {
  grossRevenueCents: number;
  platformFeeCents: number;
  netCreatorAmountCents: number;
  succeededCount: number;
  currency: string;
  transactions: PublicTransaction[];
};
