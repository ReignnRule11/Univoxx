import pino, { type Logger } from "pino";
import { getConfig, type AppConfig } from "./config";

export function createLogger(config?: AppConfig): Logger {
  const resolved = config ?? getConfig();
  return pino({
    level: resolved.LOG_LEVEL,
    base: {
      service: "univox",
      env: resolved.NODE_ENV,
    },
    redact: {
      paths: [
        "password",
        "passwordHash",
        "authorization",
        "cookie",
        "req.headers.authorization",
        "req.headers.cookie",
        "*.secret",
        "*.token",
        "prompt",
        "completion",
        "transcript",
        "*.prompt",
        "*.completion",
        "*.text",
      ],
      censor: "[redacted]",
    },
  });
}

let cached: Logger | undefined;

export function getLogger(): Logger {
  if (!cached) {
    cached = createLogger();
  }
  return cached;
}

export function resetLogger(): void {
  cached = undefined;
}

export const logger: Logger = new Proxy({} as Logger, {
  get(_target, property) {
    const instance = getLogger();
    const value = Reflect.get(instance, property, instance) as unknown;
    return typeof value === "function" ? (value as (...args: never[]) => unknown).bind(instance) : value;
  },
});
