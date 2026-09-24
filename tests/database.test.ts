import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = queryRaw;
  },
}));

describe("database connectivity", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns ok when SELECT 1 succeeds", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const { checkDatabase } = await import("@/lib/db");
    await expect(checkDatabase()).resolves.toEqual({ ok: true });
  });

  it("returns a structured failure when the database is unreachable", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const { checkDatabase } = await import("@/lib/db");
    const result = await checkDatabase();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ECONNREFUSED");
    }
  });
});
