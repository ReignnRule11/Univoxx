import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  checkDatabase: vi.fn(),
}));

import { checkDatabase } from "@/lib/db";
import { GET as healthGet } from "@/app/api/v1/health/route";
import { GET as liveGet } from "@/app/api/v1/health/live/route";
import { GET as readyGet } from "@/app/api/v1/health/ready/route";
import { resetRateLimitStore } from "@/lib/security";
import { emptyRouteContext } from "./helpers/invoke";

describe("health endpoints", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.mocked(checkDatabase).mockReset();
  });

  it("returns live status without a database", async () => {
    const response = await liveGet(new Request("http://localhost/api/v1/health/live"), emptyRouteContext);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", check: "live" });
  });

  it("reports ok when the database is reachable", async () => {
    vi.mocked(checkDatabase).mockResolvedValue({ ok: true });
    const response = await healthGet(new Request("http://localhost/api/v1/health"), emptyRouteContext);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("v1");
    expect(body.checks).toEqual({ config: "ok", database: "ok" });
  });

  it("reports degraded health when the database is down", async () => {
    vi.mocked(checkDatabase).mockResolvedValue({ ok: false, error: "connect ECONNREFUSED" });
    const response = await healthGet(new Request("http://localhost/api/v1/health"), emptyRouteContext);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { config: "ok", database: "error" },
    });
  });

  it("fails readiness when the database is down", async () => {
    vi.mocked(checkDatabase).mockResolvedValue({ ok: false, error: "connect ECONNREFUSED" });
    const response = await readyGet(new Request("http://localhost/api/v1/health/ready"), emptyRouteContext);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
