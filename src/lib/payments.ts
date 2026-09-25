import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "./config";
import { serviceUnavailable, unauthorized } from "./errors";

export const PAYMENT_PROVIDERS = ["sandbox", "stripe", "paystack", "flutterwave"] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export type CheckoutSession = {
  provider: PaymentProviderName;
  providerReference: string;
  checkoutUrl: string;
};

export type WebhookVerification = {
  provider: PaymentProviderName;
  eventId: string;
  providerReference: string;
  outcome: "succeeded" | "failed" | "cancelled" | "refunded";
  amountCents: number;
  currency: string;
};

export type PaymentProvider = {
  name: PaymentProviderName;
  createCheckout(input: {
    transactionId: string;
    amountCents: number;
    currency: string;
    payerEmail: string;
    productName: string;
  }): Promise<CheckoutSession>;
  verifyWebhook(request: Request, rawBody: string): Promise<WebhookVerification>;
};

export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox" as const;

  constructor(private readonly webhookSecret: string) {}

  async createCheckout(input: {
    transactionId: string;
    amountCents: number;
    currency: string;
    payerEmail: string;
    productName: string;
  }): Promise<CheckoutSession> {
    const providerReference = `sandbox_${input.transactionId}`;
    return {
      provider: this.name,
      providerReference,
      checkoutUrl: `/api/v1/payments/sandbox/checkout?ref=${encodeURIComponent(providerReference)}`,
    };
  }

  async verifyWebhook(request: Request, rawBody: string): Promise<WebhookVerification> {
    const signature = request.headers.get("x-univox-sandbox-signature");
    if (!signature || !this.webhookSecret) {
      throw unauthorized("Invalid payment webhook signature");
    }
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const provided = Buffer.from(signature);
    const computed = Buffer.from(expected);
    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      throw unauthorized("Invalid payment webhook signature");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw unauthorized("Invalid payment webhook payload");
    }
    if (!payload || typeof payload !== "object") {
      throw unauthorized("Invalid payment webhook payload");
    }
    const body = payload as Record<string, unknown>;
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const providerReference = typeof body.providerReference === "string" ? body.providerReference : "";
    const outcome = body.outcome;
    const amountCents = typeof body.amountCents === "number" ? body.amountCents : NaN;
    const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "";
    if (
      !eventId ||
      !providerReference ||
      (outcome !== "succeeded" && outcome !== "failed" && outcome !== "cancelled" && outcome !== "refunded") ||
      !Number.isInteger(amountCents) ||
      amountCents < 1 ||
      !currency
    ) {
      throw unauthorized("Invalid payment webhook payload");
    }
    return {
      provider: this.name,
      eventId,
      providerReference,
      outcome,
      amountCents,
      currency,
    };
  }
}

function configuredProviderName(): PaymentProviderName | undefined {
  const config = getConfig();
  if (config.PAYMENTS_PROVIDER) {
    return config.PAYMENTS_PROVIDER;
  }
  return config.NODE_ENV === "production" ? undefined : "sandbox";
}

export function createPaymentProvider(): PaymentProvider {
  const config = getConfig();
  const name = configuredProviderName();
  if (!name) {
    throw serviceUnavailable("Payments provider is not configured");
  }
  if (name === "sandbox") {
    if (config.NODE_ENV === "production") {
      throw serviceUnavailable("Sandbox payments are not allowed in production");
    }
    if (!config.PAYMENTS_WEBHOOK_SECRET) {
      throw serviceUnavailable("Payments webhook secret is not configured");
    }
    return new SandboxPaymentProvider(config.PAYMENTS_WEBHOOK_SECRET);
  }
  throw serviceUnavailable(`${name} payments require live credentials that are not configured`);
}

let activeProvider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!activeProvider) {
    activeProvider = createPaymentProvider();
  }
  return activeProvider;
}

export function setPaymentProvider(provider: PaymentProvider): void {
  activeProvider = provider;
}

export function resetPaymentProvider(): void {
  activeProvider = undefined;
}

export function signSandboxWebhook(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}
