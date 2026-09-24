import { NextResponse } from "next/server";
import { getConfig } from "./config";
import { AppError } from "./errors";
import { getRequestId, handleRouteError, withRequestId } from "./http";
import { logRequest, requestPath } from "./observability";
import {
  applyCorsHeaders,
  applyRateLimitHeaders,
  applySecurityHeaders,
  consumeRateLimit,
  getAllowedOrigins,
  getClientIp,
} from "./security";

export type RouteContext = { requestId: string; params: Record<string, string> };

type RouteHandler = (request: Request, context: RouteContext) => Promise<NextResponse> | NextResponse;

export type AppRouteContext = { params: Promise<Record<string, string>> };

export function apiRoute(handler: RouteHandler) {
  return async (request: Request, nextContext: AppRouteContext): Promise<NextResponse> => {
    const started = Date.now();
    const requestId = getRequestId(request);
    const config = getConfig();
    const params = (await nextContext.params) ?? {};
    try {
      const ip = getClientIp(request, config.TRUST_PROXY);
      const limit = consumeRateLimit(`ip:${ip}`, config.RATE_LIMIT_MAX, config.RATE_LIMIT_WINDOW_MS);
      const response = await handler(request, { requestId, params });
      applyRateLimitHeaders(response, limit.remaining, limit.resetAt, config.RATE_LIMIT_MAX);
      const finalized = finalize(response, request, requestId, config.NODE_ENV === "production");
      logRequest({
        requestId,
        method: request.method,
        path: requestPath(request),
        status: finalized.status,
        durationMs: Date.now() - started,
      });
      return finalized;
    } catch (error) {
      const response = handleRouteError(error, requestId);
      if (error instanceof AppError && error.status === 429) {
        applyRateLimitHeaders(response, 0, Date.now() + config.RATE_LIMIT_WINDOW_MS, config.RATE_LIMIT_MAX);
        response.headers.set("Retry-After", String(Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)));
      }
      const finalized = finalize(response, request, requestId, config.NODE_ENV === "production");
      logRequest({
        requestId,
        method: request.method,
        path: requestPath(request),
        status: finalized.status,
        durationMs: Date.now() - started,
      });
      return finalized;
    }
  };
}

function finalize(response: NextResponse, request: Request, requestId: string, isProduction: boolean): NextResponse {
  applyCorsHeaders(response, request, getAllowedOrigins());
  applySecurityHeaders(response, isProduction);
  return withRequestId(response, requestId);
}

export function apiOptions() {
  return apiRoute(async () => new NextResponse(null, { status: 204 }));
}
