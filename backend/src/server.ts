import "dotenv/config";
import express, { Application } from "express";
import setupMiddleware from "./middleware/setupMiddleware";
import { seedProviders } from "./scripts/seedProviders";
import { seedSlots } from "./scripts/seedSlots";
import { seedVapiAssistant } from "./scripts/seedVapiAssistant";
import { checkpointer } from "./services/agent/checkpointer";
import { getLogger } from "./config/logger";

const app: Application = express();
const PORT = parseInt(process.env.PORT!) || 8000;
const logger = getLogger("Server");

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

setupMiddleware(app);

async function start() {
  try {
    logger.info("Server startup initiated", { port: PORT, env: process.env.NODE_ENV ?? "development" });
    await checkpointer.setup(); // creates LangGraph checkpoint tables (idempotent)
    await seedProviders();
    await seedSlots();
    await seedVapiAssistant();

    app.listen(PORT, "0.0.0.0", () => {
      logger.info("Server listening", { port: PORT, host: "0.0.0.0" });
    });
  } catch (err: any) {
    logger.fatal("Server startup failed", { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

start();

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  process.exit(0);
});
