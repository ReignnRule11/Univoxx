import { describe, expect, it } from "vitest";
import { readBearerToken, requireSession, signSession, verifySession } from "@/lib/auth";
import { AppError } from "@/lib/errors";

describe("authentication foundation", () => {
  it("signs and verifies a session", async () => {
    const token = await signSession({ sub: "user_1", email: "creator@univox.test", sid: "session_1" });
    await expect(verifySession(token)).resolves.toEqual({
      sub: "user_1",
      email: "creator@univox.test",
      sid: "session_1",
    });
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ sub: "user_1", email: "creator@univox.test", sid: "session_1" });
    await expect(verifySession(`${token}x`)).rejects.toBeInstanceOf(AppError);
  });

  it("reads a bearer token from the Authorization header", () => {
    const request = new Request("http://localhost/api/v1/users", {
      headers: { authorization: "Bearer abc.def.ghi" },
    });
    expect(readBearerToken(request)).toBe("abc.def.ghi");
  });

  it("requires a session for protected handlers", async () => {
    const request = new Request("http://localhost/api/v1/users");
    await expect(requireSession(request)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });
});
