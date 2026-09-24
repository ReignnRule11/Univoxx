import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { parseJsonBody, parseSearchParams } from "@/lib/http";

const payloadSchema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
});

describe("request validation", () => {
  it("accepts a valid JSON body", async () => {
    const request = new Request("http://localhost/api/v1/users", {
      method: "POST",
      body: JSON.stringify({ email: "creator@univox.test", age: 30 }),
    });
    await expect(parseJsonBody(request, payloadSchema)).resolves.toEqual({
      email: "creator@univox.test",
      age: 30,
    });
  });

  it("rejects invalid JSON", async () => {
    const request = new Request("http://localhost/api/v1/users", {
      method: "POST",
      body: "{not-json",
    });
    await expect(parseJsonBody(request, payloadSchema)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    } satisfies Partial<AppError>);
  });

  it("rejects schema mismatches with field details", async () => {
    const request = new Request("http://localhost/api/v1/users", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", age: -1 }),
    });
    try {
      await parseJsonBody(request, payloadSchema);
      throw new Error("expected validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.status).toBe(400);
      expect(appError.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "email" }),
          expect.objectContaining({ path: "age" }),
        ]),
      );
    }
  });

  it("validates query parameters", () => {
    const url = new URL("http://localhost/api/v1/users?limit=10");
    const result = parseSearchParams(url, z.object({ limit: z.coerce.number().int().max(100) }));
    expect(result.limit).toBe(10);
  });
});
