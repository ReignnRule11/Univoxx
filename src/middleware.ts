import { NextResponse, type NextRequest } from "next/server";
import { getConfig, parseCorsOrigins } from "./lib/config";
import { applyCorsHeaders, applySecurityHeaders, consumeRateLimit, getClientIp } from "./lib/security";
import { ERROR_CODES } from "./lib/errors";

export function middleware(request: NextRequest) {
  const config = getConfig();
  const allowedOrigins = parseCorsOrigins(config.CORS_ORIGINS);

  if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api/")) {
    const response = new NextResponse(null, { status: 204 });
    applyCorsHeaders(response, request, allowedOrigins);
    applySecurityHeaders(response, config.NODE_ENV === "production");
    return response;
  }

  try {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      consumeRateLimit(
        `mw:${getClientIp(request, config.TRUST_PROXY)}`,
        config.RATE_LIMIT_MAX,
        config.RATE_LIMIT_WINDOW_MS,
      );
    }
  } catch {
    const response = NextResponse.json(
      { error: { code: ERROR_CODES.RATE_LIMITED, message: "Too many requests" } },
      { status: 429 },
    );
    applyCorsHeaders(response, request, allowedOrigins);
    applySecurityHeaders(response, config.NODE_ENV === "production");
    return response;
  }

  const response = NextResponse.next();
  applyCorsHeaders(response, request, allowedOrigins);
  applySecurityHeaders(response, config.NODE_ENV === "production");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
