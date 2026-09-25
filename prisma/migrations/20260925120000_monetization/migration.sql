-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('MEMBERSHIP', 'DIGITAL', 'EVENT', 'TIP');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipGrantStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'MEMBERSHIP',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "intervalDays" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Product_creatorId_status_idx" ON "Product"("creatorId", "status");

ALTER TABLE "Product" ADD CONSTRAINT "Product_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "creatorAmountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKeyHash" TEXT,
    "requestFingerprint" TEXT,
    "failureReason" TEXT,
    "succeededAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Transaction_providerReference_key" ON "Transaction"("providerReference");
CREATE UNIQUE INDEX "Transaction_payerId_idempotencyKeyHash_key" ON "Transaction"("payerId", "idempotencyKeyHash");
CREATE INDEX "Transaction_payerId_createdAt_idx" ON "Transaction"("payerId", "createdAt");
CREATE INDEX "Transaction_recipientId_status_createdAt_idx" ON "Transaction"("recipientId", "status", "createdAt");
CREATE INDEX "Transaction_productId_idx" ON "Transaction"("productId");
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedWebhookEvent_provider_eventId_key" ON "ProcessedWebhookEvent"("provider", "eventId");
CREATE INDEX "ProcessedWebhookEvent_transactionId_idx" ON "ProcessedWebhookEvent"("transactionId");

-- CreateTable
CREATE TABLE "PaymentAuditEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" "PaymentStatus",
    "toStatus" "PaymentStatus",
    "event" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentAuditEvent_transactionId_createdAt_idx" ON "PaymentAuditEvent"("transactionId", "createdAt");

ALTER TABLE "PaymentAuditEvent" ADD CONSTRAINT "PaymentAuditEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CreatorMembership" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "MembershipGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorMembership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreatorMembership_subscriberId_creatorId_idx" ON "CreatorMembership"("subscriberId", "creatorId");
CREATE INDEX "CreatorMembership_creatorId_status_idx" ON "CreatorMembership"("creatorId", "status");
CREATE INDEX "CreatorMembership_transactionId_idx" ON "CreatorMembership"("transactionId");

ALTER TABLE "CreatorMembership" ADD CONSTRAINT "CreatorMembership_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreatorMembership" ADD CONSTRAINT "CreatorMembership_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreatorMembership" ADD CONSTRAINT "CreatorMembership_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreatorMembership" ADD CONSTRAINT "CreatorMembership_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
