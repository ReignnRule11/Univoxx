import { getLogger } from "./logger";

export type RequestLog = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

export function logRequest(entry: RequestLog): void {
  getLogger().info(entry, "request.completed");
}

export function requestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/unknown";
  }
}
