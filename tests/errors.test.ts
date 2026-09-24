import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES, toErrorBody, validationError } from "@/lib/errors";
import { handleRouteError } from "@/lib/http";

describe("error handling", () => {
  it("serializes AppError details", () => {
    const error = validationError("bad input", [{ path: "email", message: "required" }]);
    const result = toErrorBody(error, false);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(result.body.error.details).toEqual([{ path: "email", message: "required" }]);
  });

  it("hides unexpected errors in production mode", () => {
    const result = toErrorBody(new Error("secret internals"), false);
    expect(result.status).toBe(500);
    expect(result.body.error.message).toBe("An unexpected error occurred");
  });

  it("exposes unexpected errors outside production", () => {
    const result = toErrorBody(new Error("secret internals"), true);
    expect(result.body.error.message).toBe("secret internals");
  });

  it("returns JSON from handleRouteError", async () => {
    const response = handleRouteError(new AppError(404, ERROR_CODES.NOT_FOUND, "missing"), "req-1");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
