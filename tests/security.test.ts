import { afterEach, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  applyCorsHeaders,
  applySecurityHeaders,
  consumeRateLimit,
  resetRateLimitStore,
  resolveCorsOrigin,
} from "@/lib/security";

describe("security foundation", () => {
  afterEach(() => {
    resetRateLimitStore();
  });

  it("allows only configured CORS origins", () => {
    expect(resolveCorsOrigin("http://localhost:3000", ["http://localhost:3000"])).toBe(
      "http://localhost:3000",
    );
    expect(resolveCorsOrigin("https://evil.example", ["http://localhost:3000"])).toBeNull();
  });

  it("sets CORS headers for allowed origins only", () => {
    const allowed = new Request("http://localhost/api/v1/health", {
      headers: { origin: "http://localhost:3000" },
    });
    const allowedResponse = applyCorsHeaders(new NextResponse(null, { status: 204 }), allowed, [
      "http://localhost:3000",
    ]);
    expect(allowedResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");

    const blocked = new Request("http://localhost/api/v1/health", {
      headers: { origin: "https://evil.example" },
    });
    const blockedResponse = applyCorsHeaders(new NextResponse(null, { status: 204 }), blocked, [
      "http://localhost:3000",
    ]);
    expect(blockedResponse.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("applies secure HTTP headers", () => {
    const response = applySecurityHeaders(new NextResponse("ok"), true);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("rate limits repeated keys", () => {
    consumeRateLimit("test:ip", 2, 60_000);
    consumeRateLimit("test:ip", 2, 60_000);
    expect(() => consumeRateLimit("test:ip", 2, 60_000)).toThrow(/Too many requests/);
  });
});
