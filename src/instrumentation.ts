export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  const { getConfig } = await import("./lib/config");
  const { getLogger } = await import("./lib/logger");
  const config = getConfig();
  getLogger().info({ env: config.NODE_ENV, service: "univox" }, "process started");
}
