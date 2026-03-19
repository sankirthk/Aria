import dotenv from "dotenv";
dotenv.config();

import prisma from "../clients/prismaClient";
import crypto from "crypto";
import { getLogger } from "../config/logger";

const logger = getLogger("GenerateInviteCode");

/**
 * Generates a new invite code securely.
 * @param maxUses Number of allowed uses (default: 1)
 * @param createdBy Email or identifier of creator (optional)
 * @param expiresInHours Expiry window in hours (default: 7 days)
 */
async function generateInviteCode(
  maxUses: number = 1,
  createdBy?: string,
  expiresInHours: number = 24 * 7
) {
  try {
    const code = crypto.randomBytes(8).toString("hex"); // 16-char token
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const invite = await prisma.inviteCode.create({
      data: {
        code,
        maxUses,
        createdBy,
        expiresAt,
      },
    });

    logger.info("Invite code created successfully", {
      createdBy: invite.createdBy,
      expiresAt: invite.expiresAt?.toISOString(),
      maxUses: invite.maxUses,
    });

    // Log the code only in development mode for debugging
    if (process.env.NODE_ENV === "development") {
      logger.info("Development invite code output", { inviteCode: invite.code });
    }

    return invite;
  } catch (err: any) {
    logger.error("Failed to generate invite code", {
      error: err.message,
      stack: err.stack,
    });
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// Example invocation (you can remove this when integrating into CLI)
generateInviteCode(3, "admin@example.com")
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
