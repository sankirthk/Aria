import { PrismaClient, Prisma } from "../generated/prisma";
import { fieldEncryptionExtension } from "prisma-field-encryption";
import { getLogger } from "../config/logger";
import { FIELD_ENCRYPTION_KEY } from "../config/env";

const logger = getLogger("PrismaClient");

const baseClient = new PrismaClient({
  log: [
    { emit: "event", level: "warn" },
    { emit: "event", level: "error" },
  ],
});

baseClient.$on("warn", (event) => {
  logger.warn("Prisma warning", { target: event.target, message: event.message });
});

baseClient.$on("error", (event) => {
  logger.error("Prisma error", { target: event.target, message: event.message });
});

const prisma = baseClient.$extends(
  fieldEncryptionExtension({ encryptionKey: FIELD_ENCRYPTION_KEY, dmmf: Prisma.dmmf })
);

export default prisma;
