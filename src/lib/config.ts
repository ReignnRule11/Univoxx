import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

export const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    CORS_ORIGINS: z.string().min(1, "CORS_ORIGINS is required"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    STORAGE_PROVIDER: z.enum(["memory", "s3"]).optional(),
    S3_ENDPOINT: z.string().url().optional().or(z.literal("")),
    S3_REGION: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    PAYMENTS_PROVIDER: z.enum(["sandbox", "stripe", "paystack", "flutterwave"]).optional(),
    PAYMENTS_WEBHOOK_SECRET: z.string().min(16).optional().or(z.literal("")),
    PAYMENTS_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(1000),
    STRIPE_SECRET_KEY: z.string().min(1).optional().or(z.literal("")),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional().or(z.literal("")),
    PAYSTACK_SECRET_KEY: z.string().min(1).optional().or(z.literal("")),
    FLUTTERWAVE_SECRET_KEY: z.string().min(1).optional().or(z.literal("")),
    FLUTTERWAVE_WEBHOOK_HASH: z.string().min(1).optional().or(z.literal("")),
    LIVE_PROVIDER: z.enum(["local", "daily", "livekit"]).optional(),
    LIVE_API_KEY: z.string().min(1).optional().or(z.literal("")),
    LIVE_API_URL: z.string().url().optional().or(z.literal("")),
    AI_PROVIDER: z.enum(["openai", "gemini", "anthropic"]).optional(),
    AI_MODEL: z.string().min(1).optional().or(z.literal("")),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(15_000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
    OPENAI_API_KEY: z.string().min(1).optional().or(z.literal("")),
    OPENAI_BASE_URL: z.string().url().optional().or(z.literal("")),
    GEMINI_API_KEY: z.string().min(1).optional().or(z.literal("")),
    ANTHROPIC_API_KEY: z.string().min(1).optional().or(z.literal("")),
  })
  .superRefine((env, ctx) => {
    const provider = env.STORAGE_PROVIDER ?? (env.NODE_ENV === "production" ? "s3" : "memory");
    const paymentsProvider =
      env.PAYMENTS_PROVIDER ?? (env.NODE_ENV === "production" ? undefined : "sandbox");
    const liveProvider = env.LIVE_PROVIDER ?? (env.NODE_ENV === "production" ? undefined : "local");
    const aiProvider = env.AI_PROVIDER;
    if (env.NODE_ENV === "production") {
      if (env.AUTH_SECRET.includes("replace-with") || env.AUTH_SECRET.includes("test-auth-secret")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message: "AUTH_SECRET must be a unique production secret",
        });
      }
      if (env.DATABASE_URL.includes("univox:univox@localhost")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message: "DATABASE_URL must not use the local development default in production",
        });
      }
      if (provider === "memory") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STORAGE_PROVIDER"],
          message: "STORAGE_PROVIDER must be s3 in production",
        });
      }
      if (paymentsProvider === "sandbox") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PAYMENTS_PROVIDER"],
          message: "PAYMENTS_PROVIDER must be a live provider in production",
        });
      }
      if (liveProvider === "local") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["LIVE_PROVIDER"],
          message: "LIVE_PROVIDER must be a real media provider in production",
        });
      }
    }
    if (paymentsProvider === "sandbox") {
      if (!env.PAYMENTS_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PAYMENTS_WEBHOOK_SECRET"],
          message: "PAYMENTS_WEBHOOK_SECRET is required for the sandbox provider",
        });
      }
    }
    if (paymentsProvider === "stripe") {
      if (!env.STRIPE_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_SECRET_KEY"],
          message: "STRIPE_SECRET_KEY is required",
        });
      }
      if (!env.STRIPE_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_WEBHOOK_SECRET"],
          message: "STRIPE_WEBHOOK_SECRET is required",
        });
      }
    }
    if (paymentsProvider === "paystack" && !env.PAYSTACK_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PAYSTACK_SECRET_KEY"],
        message: "PAYSTACK_SECRET_KEY is required",
      });
    }
    if (paymentsProvider === "flutterwave") {
      if (!env.FLUTTERWAVE_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["FLUTTERWAVE_SECRET_KEY"],
          message: "FLUTTERWAVE_SECRET_KEY is required",
        });
      }
      if (!env.FLUTTERWAVE_WEBHOOK_HASH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["FLUTTERWAVE_WEBHOOK_HASH"],
          message: "FLUTTERWAVE_WEBHOOK_HASH is required",
        });
      }
    }
    if (aiProvider === "openai" && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      });
    }
    if (aiProvider === "gemini" && !env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GEMINI_API_KEY"],
        message: "GEMINI_API_KEY is required when AI_PROVIDER=gemini",
      });
    }
    if (aiProvider === "anthropic" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ANTHROPIC_API_KEY"],
        message: "ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic",
      });
    }
    if ((liveProvider === "daily" || liveProvider === "livekit") && !env.LIVE_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["LIVE_API_KEY"],
        message: "LIVE_API_KEY is required for the configured live provider",
      });
    }
    if (provider === "s3") {
      if (!env.S3_BUCKET) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["S3_BUCKET"], message: "S3_BUCKET is required" });
      }
      if (!env.S3_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["S3_ACCESS_KEY_ID"],
          message: "S3_ACCESS_KEY_ID is required",
        });
      }
      if (!env.S3_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["S3_SECRET_ACCESS_KEY"],
          message: "S3_SECRET_ACCESS_KEY is required",
        });
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid application configuration: ${details}`);
  }
  return parsed.data;
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}

export function resetConfigCache(): void {
  cached = undefined;
}

export function parseCorsOrigins(origins: string): string[] {
  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
