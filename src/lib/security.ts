import { NextResponse } from "next/server";
import { getConfig, parseCorsOrigins } from "./config";
import { rateLimited } from "./errors";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
};

export function applySecurityHeaders(response: NextResponse, isProduction: boolean): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (isProduction) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  response.headers.delete("X-Powered-By");
  return response;
}

export function resolveCorsOrigin(origin: string | null, allowed: string[]): string | null {
  if (!origin) {
    return null;
  }
  return allowed.includes(origin) ? origin : null;
}

export function applyCorsHeaders(response: NextResponse, request: Request, allowedOrigins: string[]): NextResponse {
  const allowed = resolveCorsOrigin(request.headers.get("origin"), allowedOrigins);
  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", allowed);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization,Content-Type,X-Request-Id,X-CSRF-Token",
    );
    response.headers.set("Access-Control-Max-Age", "600");
  }
  return response;
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function resetRateLimitStore(): void {
  buckets.clear();
}

export function getClientIp(request: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }
  }
  return request.headers.get("x-real-ip") ?? "local";
}

export function consumeRateLimit(key: string, max: number, windowMs: number, now = Date.now()): {
  remaining: number;
  resetAt: number;
} {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { remaining: max - 1, resetAt };
  }
  existing.count += 1;
  if (existing.count > max) {
    throw rateLimited();
  }
  return { remaining: Math.max(0, max - existing.count), resetAt: existing.resetAt };
}

export function enforceApiGuard(request: Request): { remaining: number; resetAt: number; requestId: string } {
  const config = getConfig();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const ip = getClientIp(request, config.TRUST_PROXY);
  const result = consumeRateLimit(`ip:${ip}`, config.RATE_LIMIT_MAX, config.RATE_LIMIT_WINDOW_MS);
  return { ...result, requestId };
}

export function applyRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  resetAt: number,
  max: number,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(max));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  return response;
}

export function getAllowedOrigins(): string[] {
  return parseCorsOrigins(getConfig().CORS_ORIGINS);
}
