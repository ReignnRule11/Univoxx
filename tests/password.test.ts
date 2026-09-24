import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct-horse-1");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correct-horse-1");
    await expect(verifyPassword("correct-horse-1", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-1");
    await expect(verifyPassword("wrong-password-1", hash)).resolves.toBe(false);
  });
});
