import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForDb.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForDb.prisma = prisma;
}

export async function checkDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database connection failed";
    logger.error({ err: error }, "database health check failed");
    return { ok: false, error: message };
  }
}
