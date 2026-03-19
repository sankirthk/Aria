import cors from "cors";
import helmet from "helmet";
import express, { Application } from "express";
import { httpLogger } from "./httpLoggerMiddleware";
import authRouter from "../routes/authRoute";
import patientRouter from "../routes/patientRoute";
import providerRouter from "../routes/providerRoute";
import appointmentRouter from "../routes/appointmentRoute";
import chatRouter from "../routes/chatRoute";
import voiceRouter from "../routes/voiceRoute";
import voiceToolsRouter from "../routes/voiceToolsRoute";
import webhookRouter from "../routes/webhookRoute";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth/auth";
import { getLogger } from "../config/logger";
import { env } from "../config/env";

const logger = getLogger("SetupMiddleware");
const allowedOrigins = env.ALLOWED_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

const setupMiddleware = (app: Application) => {
  logger.info("Registering application middleware and routes");

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(helmet());
  app.use(httpLogger);
  app.use(express.json());

  app.all("/api/auth/*splat", toNodeHandler(auth));
  app.use("/kyron/api/v1/auth", authRouter);
  app.use("/kyron/api/v1/patient", patientRouter);
  app.use("/kyron/api/v1/providers", providerRouter);
  app.use("/kyron/api/v1/appointments", appointmentRouter);
  app.use("/kyron/api/v1/chat", chatRouter);
  app.use("/kyron/api/v1/voice", voiceRouter);

  // Vapi server tools — called by Vapi during a call, no session auth, Bearer secret
  app.use("/voice/tools", voiceToolsRouter);

  // Webhook — root path, no session auth, authenticates via Bearer secret
  app.use("/webhook", webhookRouter);

  logger.info("Application middleware and routes registered");
};

export default setupMiddleware;
