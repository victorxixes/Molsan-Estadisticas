import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/pool.js";

const app = await buildApp();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await closeDatabase();
  process.exit(1);
}

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "Shutting down API");
  await app.close();
  await closeDatabase();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));