import prisma from "../clients/prismaClient";
import { Prisma } from "../generated/prisma";
import type { InviteCode } from "../generated/prisma";
import { getLogger } from "../config/logger";

const logger = getLogger("Prisma-Service");

export const fetchInviteCodePrisma = async (
  code: string
): Promise<InviteCode> => {
  try {
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code },
    });

    if (!inviteCode) {
      logger.warn("Invite code not found in database", { code });
      throw new Error("Invite code not found in the database");
    }

    logger.info("Invite code found and returned", { code });
    return inviteCode;
  } catch (err: any) {
    logger.error("Error fetching invite code", {
      code,
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }
};

export const updateInviteCodePrisma = async (code: string) => {
  try {
    const updatedInvite = await prisma.inviteCode.update({
      where: { code },
      data: { usedCount: { increment: 1 } },
    });

    logger.info("Invite code usage incremented successfully", {
      code,
      usedCount: updatedInvite.usedCount,
    });

    return updatedInvite;
  } catch (err: any) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      logger.warn("Invite code not found while updating", { code });
      throw new Error("Invite code not found");
    }

    logger.error("Error updating invite code", {
      code,
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }
};
