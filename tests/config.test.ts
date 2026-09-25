import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, parseCorsOrigins } from "@/lib/config";

const validEnv = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://univox:univox@localhost:5432/univox_test",
  AUTH_SECRET: "test-auth-secret-must-be-at-least-32-chars",
  CORS_ORIGINS: "http://localhost:3000,https://app.example.com",
  LOG_LEVEL: "silent",
  RATE_LIMIT_MAX: "50",
  RATE_LIMIT_WINDOW_MS: "1000",
  TRUST_PROXY: "false",
  PAYMENTS_PROVIDER: "sandbox",
  PAYMENTS_WEBHOOK_SECRET: "test-payments-webhook-secret",
} as NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("loads a valid configuration", () => {
    const config = loadConfig(validEnv);
    expect(config.APP_URL).toBe("http://localhost:3000");
    expect(config.RATE_LIMIT_MAX).toBe(50);
    expect(config.TRUST_PROXY).toBe(false);
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: "" })).toThrow(ConfigError);
  });

  it("rejects a short AUTH_SECRET", () => {
    expect(() => loadConfig({ ...validEnv, AUTH_SECRET: "too-short" })).toThrow(/AUTH_SECRET/);
  });

  it("rejects placeholder secrets in production", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        NODE_ENV: "production",
        APP_URL: "https://univox.example",
        DATABASE_URL: "postgresql://prod-user:prod-pass@db.internal:5432/univox",
        AUTH_SECRET: "test-auth-secret-must-be-at-least-32-chars",
      }),
    ).toThrow(/unique production secret/);
  });

  it("rejects local database defaults in production", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        NODE_ENV: "production",
        APP_URL: "https://univox.example",
        DATABASE_URL: "postgresql://univox:univox@localhost:5432/univox",
        AUTH_SECRET: "production-secret-value-with-enough-length",
      }),
    ).toThrow(/must not use the local development default/);
  });

  it("rejects sandbox payments in production", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        NODE_ENV: "production",
        APP_URL: "https://univox.example",
        DATABASE_URL: "postgresql://prod-user:prod-pass@db.internal:5432/univox",
        AUTH_SECRET: "production-secret-value-with-enough-length",
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "univox-media",
        S3_ACCESS_KEY_ID: "access",
        S3_SECRET_ACCESS_KEY: "secret",
        PAYMENTS_PROVIDER: "sandbox",
        PAYMENTS_WEBHOOK_SECRET: "production-webhook-secret",
      }),
    ).toThrow(/live provider in production/);
  });

  it("requires Stripe credentials when Stripe is selected", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        PAYMENTS_PROVIDER: "stripe",
      }),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("parses CORS origins", () => {
    expect(parseCorsOrigins("http://localhost:3000, https://app.example.com")).toEqual([
      "http://localhost:3000",
      "https://app.example.com",
    ]);
  });
});
