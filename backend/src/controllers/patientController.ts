import { Request, Response } from "express";
import { auth } from "../lib/auth/auth";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";
import { updatePatientSchema } from "../validators/patientSchema";
import { normalizePhone } from "../utils/normalizePhone";
import { hashPhone } from "../utils/crypto";
import { z } from "zod";

const logger = getLogger("PatientController");

export const getProfile = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    logger.warn("Unauthorized request to getProfile");
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const patient = await prisma.patient.findUnique({
      where: { userId: session.user.id },
    });

    if (!patient) {
      logger.info("Patient profile not found", { userId: session.user.id });
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    logger.info("Patient profile fetched", { userId: session.user.id, patientId: patient.id });
    return res.status(200).json({ success: true, data: patient });
  } catch (err: any) {
    logger.error("Error fetching patient profile", { userId: session.user.id, error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    logger.warn("Unauthorized request to updateProfile");
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const parsed = updatePatientSchema.safeParse(req.body);
  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error);
    logger.warn("updateProfile validation failed", { userId: session.user.id, details: formatted });
    return res.status(400).json({ success: false, error: "Invalid input", details: formatted });
  }

  const { firstName, lastName, dateOfBirth, phone } = parsed.data;
  const normalizedPhone = normalizePhone(phone);
  const phoneHash = hashPhone(normalizedPhone);

  try {
    const patient = await prisma.patient.upsert({
      where: { userId: session.user.id },
      update: { firstName, lastName, dateOfBirth, phone: normalizedPhone, phoneHash, profileComplete: true },
      create: { userId: session.user.id, firstName, lastName, dateOfBirth, phone: normalizedPhone, phoneHash, profileComplete: true },
    });

    logger.info("Patient profile updated", { userId: session.user.id });
    return res.status(200).json({ success: true, data: patient });
  } catch (err: any) {
    logger.error("Error updating patient profile", { error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};
