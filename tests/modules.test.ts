import { beforeEach, describe, expect, it } from "vitest";
import { GET as authGet } from "@/app/api/v1/auth/route";
import { GET as paymentsGet } from "@/app/api/v1/payments/route";
import { GET as aiGet } from "@/app/api/v1/ai/route";
import { resetRateLimitStore } from "@/lib/security";
import { emptyRouteContext } from "./helpers/invoke";

describe("foundational modules", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("does not expose fake payment settlement or unauthenticated AI", async () => {
    const payments = await paymentsGet(new Request("http://localhost/api/v1/payments"), emptyRouteContext);
    const ai = await aiGet(new Request("http://localhost/api/v1/ai"), emptyRouteContext);
    expect(payments.status).toBe(401);
    expect(ai.status).toBe(401);
    await expect(payments.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
    await expect(ai.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("advertises identity auth endpoints", async () => {
    const response = await authGet(new Request("http://localhost/api/v1/auth"), emptyRouteContext);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.module).toBe("auth");
    expect(body.endpoints).toEqual(
      expect.arrayContaining(["POST /api/v1/auth/register", "POST /api/v1/auth/login"]),
    );
  });
});
