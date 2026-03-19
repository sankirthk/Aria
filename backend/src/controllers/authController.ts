import { Request, Response } from "express";
import {
  fetchInviteCodePrisma,
  updateInviteCodePrisma,
} from "../services/prismaService";
import { auth } from "../lib/auth/auth";
import { getLogger } from "../config/logger";
import { signUpSchema } from "../validators/authSchema";
import { z } from "zod";

const logger = getLogger("AuthController");

/**
 * Validate Invite Code
 */
export const validateInviteCodeController = async (
  req: Request,
  res: Response,
) => {
  const { code } = req.body;

  if (!code?.trim()) {
    logger.warn("Invite code missing in request body");
    return res.status(400).json({
      success: false,
      valid: false,
      message: "Please enter an invite code to continue.",
    });
  }

  try {
    const invite = await fetchInviteCodePrisma(code);

    if (!invite) {
      logger.info("Invalid invite code attempt", { code });
      return res.status(404).json({
        success: false,
        valid: false,
        message:
          "The invite code you entered is invalid. Please check and try again.",
      });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      logger.info("Invite code expired", {
        code,
        expiresAt: invite.expiresAt.toISOString(),
      });
      return res.status(403).json({
        success: false,
        valid: false,
        message:
          "This invite code has expired. Please contact your administrator for a new one.",
      });
    }

    if (invite.usedCount >= invite.maxUses) {
      logger.info("Invite code exhausted", {
        code,
        usedCount: invite.usedCount,
        maxUses: invite.maxUses,
      });
      return res.status(403).json({
        success: false,
        valid: false,
        message:
          "This invite code has already been used the maximum number of times.",
      });
    }

    // Valid code
    logger.info("Invite code validated successfully", { code });
    return res.status(200).json({
      success: true,
      valid: true,
      message: "Invite code validated successfully!",
    });
  } catch (err: any) {
    logger.error("Unexpected error validating invite code", {
      code,
      error: err.message,
      stack: err.stack,
    });

    // Only show a gentle message to the client
    return res.status(500).json({
      success: false,
      valid: false,
      message:
        "Something went wrong while validating your invite code. Please try again shortly or contact support.",
    });
  }
};

/**
 * Sign Up Controller
 */
export const signUpController = async (req: Request, res: Response) => {
  // --- Validate request body using Zod ---
  const parsed = signUpSchema.safeParse(req.body);

  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);
    logger.warn("Signup validation failed", { details: formatted });
    const properties = formatted.properties ?? {};

    // Convert to ["field", "error message"] list
    const messages = Object.entries(properties).map(([field, value]) => {
      return `${field}: ${value.errors.join(", ")}`;
    });

    return res.status(400).json({
      success: false,
      error: "Invalid input",
      details: formatted,
      messages,
    });
  }

  const { name, email, password, inviteCode, callbackURL } = parsed.data;

  try {
    // --- Check invite code validity ---
    const invite = await fetchInviteCodePrisma(inviteCode);
    if (
      !invite ||
      (invite.expiresAt && invite.expiresAt < new Date()) ||
      invite.usedCount >= invite.maxUses
    ) {
      logger.info("Invalid or expired invite code used during signup", {
        email,
        inviteCode,
        usedCount: invite?.usedCount,
        maxUses: invite?.maxUses,
      });
      return res.status(403).json({ error: "Invalid invite code" });
    }

    // --- Register user via Better Auth ---
    const data = await auth.api.signUpEmail({
      body: { name, email, password, callbackURL },
    });

    // Increment invite code usage
    await updateInviteCodePrisma(inviteCode);

    logger.info("User signed up successfully", {
      email,
      inviteCode,
      userId: data?.user?.id,
    });

    return res
      .status(201)
      .json({ success: true, message: "User registered successfully", data });
  } catch (err: any) {
    logger.error("Error during user signup", {
      email,
      inviteCode,
      error: err.message,
      statusCode: err.statusCode,
      stack: err.stack,
    });

    if (err.statusCode && err.body?.message) {
      return res.status(err.statusCode).json({ error: err.body.message });
    }
    return res.status(500).json({ error: "Internal server error during signup" });
  }
};
