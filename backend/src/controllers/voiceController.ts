import { Request, Response } from "express";
import { auth } from "../lib/auth/auth";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";
import { initiateHandoffCall, serializeTranscript } from "../services/vapiService";
import { z } from "zod";

const logger = getLogger("VoiceController");

const handoffSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  quickCall: z
    .object({
      phone: z.string().min(1),
      name: z.string().min(1),
    })
    .optional(),
});

// POST /voice/handoff
export const handoff = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    logger.warn("Unauthorized request to voice handoff");
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const parsed = handoffSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("Voice handoff validation failed", { userId: session.user.id, details: parsed.error.flatten() });
    return res.status(400).json({ success: false, error: "Invalid input", details: parsed.error.flatten() });
  }

  const { sessionId, quickCall } = parsed.data;

  try {
    // Verify session belongs to user
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!chatSession) {
      logger.warn("Voice handoff chat session not found", { userId: session.user.id, sessionId });
      return res.status(404).json({ success: false, error: "Chat session not found" });
    }
    if (chatSession.userId !== session.user.id) {
      logger.warn("Voice handoff forbidden", { userId: session.user.id, sessionId, chatSessionUserId: chatSession.userId });
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });

    // Quick-call path: caller provided phone + name directly, no full profile required
    const callPhone = quickCall?.phone ?? patient?.phone;
    const callName = quickCall?.name ?? (patient ? `${patient.firstName} ${patient.lastName}` : null);

    if (!callPhone || !callName) {
      logger.warn("Handoff rejected: no phone/name available", { userId: session.user.id, quickCall: !!quickCall });
      return res.status(400).json({
        success: false,
        error: "Please provide your name and phone number to request a call.",
      });
    }

    const transcript = serializeTranscript(chatSession.messages);

    const result = await initiateHandoffCall({
      phone: callPhone,
      patientId: patient?.id ?? "unknown",
      patientName: callName,
      chatSessionId: sessionId,
      transcript,
    });

    logger.info("Voice handoff initiated", { patientId: patient?.id, sessionId, callId: result.callId, quickCall: !!quickCall });

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    logger.error("Error initiating voice handoff", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to initiate call. Please try again." });
  }
};
