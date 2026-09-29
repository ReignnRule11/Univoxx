import type { ApiErrorBody } from "./ui-types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & ApiErrorBody) : ({} as T & ApiErrorBody);
  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload.error?.code ?? "INTERNAL_ERROR",
      payload.error?.message ?? "Request failed",
      payload.error?.details,
    );
  }
  return payload;
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiClientError) || !Array.isArray(error.details)) {
    return {};
  }
  const next: Record<string, string> = {};
  for (const item of error.details) {
    if (item && typeof item === "object" && "path" in item && "message" in item) {
      const path = String((item as { path: string }).path);
      const message = String((item as { message: string }).message);
      if (path && path !== "(root)") {
        next[path] = message;
      }
    }
  }
  return next;
}

export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
