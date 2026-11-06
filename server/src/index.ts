import "reflect-metadata";

import { env } from "./config/env.js";
import { describeUnlabelledTarget, refuseDatabaseTarget } from "./config/runtime-env.js";
import { factoryFromAccount } from "./db/factory-context.js";
import { adoptFactoryDatabase } from "./db/factory-database-registry.js";
import { ensureTrustIndexes } from "./db/indexes.js";
import { connectToDatabase, setNextDatabaseRetry } from "./db/mongoose.js";
import { createApp } from "./app.js";
import { seedDatabase } from "./seed.js";
import { closeAllClients } from "./modules/realtime/realtime.bus.js";

let lastDatabaseErrorLog = "";

const connectAndSeedDatabase = async () => {
  try {
    await connectToDatabase();
    await ensureTrustIndexes();
    const factory = factoryFromAccount({
      tenant_id: process.env.INITIAL_ADMIN_TENANT_ID,
      factory_id: process.env.INITIAL_ADMIN_FACTORY_ID,
    });
    if (factory) await adoptFactoryDatabase(factory);
    await seedDatabase();
    console.log(`Mongo database connected: ${env.mongoDbName}`);
  } catch (error) {
    const nextRetryAt = new Date(Date.now() + env.databaseRetryIntervalMs);
    setNextDatabaseRetry(nextRetryAt);
    const message = error instanceof Error ? error.message : String(error);

    if (message !== lastDatabaseErrorLog) {
      lastDatabaseErrorLog = message;
      console.error(
        `MongoDB Atlas is not reachable. Retrying every ${env.databaseRetryIntervalMs / 1000}s.`,
      );
      console.error(message);
      console.error("Fix: add this machine's public IP to MongoDB Atlas Network Access.");
    }

    setTimeout(connectAndSeedDatabase, env.databaseRetryIntervalMs).unref();
  }
};

const start = async () => {
  const refusal = refuseDatabaseTarget(env.appEnv, env.nodeEnv, env.databaseHostClass);
  if (refusal) throw new Error(`Refusing to start: ${refusal}`);
  const unlabelled = describeUnlabelledTarget(env.appEnv, env.databaseHostClass);
  if (unlabelled) console.warn(unlabelled);

  const app = await createApp();
  const server = await app.listen(env.port, env.host);

  console.log(`API listening on http://${env.host}:${env.port}`);
  console.log(`Mongo database target: ${env.mongoDbName} (${env.databaseHostClass})`);
  console.log(`Environment: ${env.appEnv ?? "not declared"}`);
  console.log("Backend mode: NestJS");

  void connectAndSeedDatabase();

  const shutdown = async () => {
    closeAllClients();
    await app.close().catch(() => undefined);

    if (typeof (server as any).closeAllConnections === "function") {
      (server as any).closeAllConnections();
    }

    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGUSR2", () => void shutdown());
};

start().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
