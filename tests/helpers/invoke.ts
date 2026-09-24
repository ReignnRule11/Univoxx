import type { AppRouteContext } from "@/lib/api-route";

export const emptyRouteContext: AppRouteContext = { params: Promise.resolve({}) };

export function routeContext(params: Record<string, string>): AppRouteContext {
  return { params: Promise.resolve(params) };
}
