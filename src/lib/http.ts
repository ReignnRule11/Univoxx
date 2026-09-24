import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getConfig } from "./config";
import { AppError, toErrorBody, validationError } from "./errors";
import { logger } from "./logger";
import { clearAuthCookies, setAuthCookies } from "./auth";

export const API_VERSION = "v1";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function jsonWithAuth<T>(
  data: T,
  tokens: { accessToken: string; refreshToken: string },
  init?: ResponseInit,
): NextResponse {
  const response = NextResponse.json(data, init);
  setAuthCookies(response.headers, tokens.accessToken, tokens.refreshToken);
  return response;
}

export function jsonClearedAuth<T>(data: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  clearAuthCookies(response.headers);
  return response;
}

export function handleRouteError(error: unknown, requestId: string): NextResponse {
  if (error instanceof AppError && error.status < 500) {
    logger.warn({ err: error, requestId, code: error.code }, error.message);
  } else {
    logger.error({ err: error, requestId }, "unhandled api error");
  }

  const config = getConfig();
  const { status, body } = toErrorBody(error, config.NODE_ENV !== "production");
  return NextResponse.json(body, { status });
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw validationError("Request body must be valid JSON");
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw validationError("Request validation failed", formatZodIssues(parsed.error));
  }
  return parsed.data;
}

export async function parseJsonBodyOptional<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const text = await request.text();
  if (!text.trim()) {
    const parsed = schema.safeParse({});
    if (!parsed.success) {
      throw validationError("Request validation failed", formatZodIssues(parsed.error));
    }
    return parsed.data;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw validationError("Request body must be valid JSON");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw validationError("Request validation failed", formatZodIssues(parsed.error));
  }
  return parsed.data;
}

export function parseSearchParams<T>(url: URL, schema: ZodType<T>): T {
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw validationError("Query validation failed", formatZodIssues(parsed.error));
  }
  return parsed.data;
}

export function formatZodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  return response;
}
