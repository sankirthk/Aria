import { Request, Response } from "express";
import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";
import { serializeTranscript } from "../services/vapiService";
import { normalizePhone } from "../utils/normalizePhone";
import { hashPhone } from "../utils/crypto";

const logger = getLogger("WebhookController");

// POST /webhook
export const handle = async (req: Request, res: Response) => {
  // Bearer token validation
  const authHeader = req.headers["authorization"] ?? "";
  const secret = authHeader.replace("Bearer ", "");
  if (!secret || secret !== process.env.VAPI_WEBHOOK_SECRET) {
    logger.warn("Webhook authorization failed", { hasAuthHeader: !!authHeader });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = req.body;
  const messageType: string = payload?.message?.type;

  logger.info("Vapi webhook received", { type: messageType });

  switch (messageType) {
    case "assistant-request":
      return handleAssistantRequest(payload, res);
    case "end-of-call-report":
      return handleEndOfCallReport(payload, res);
    default:
      // Vapi sends many event types (status-update, transcript, speech-update, hang, etc.)
      // that we don't handle. Return 200 so Vapi doesn't retry — just ignore silently.
      logger.debug("Unhandled Vapi webhook type — ignored", { type: messageType });
      return res.status(200).json({ received: true });
  }
};

// ─── assistant-request ────────────────────────────────────────────────────────
// Fired when an inbound call arrives and Vapi needs to know which assistant to use.

async function handleAssistantRequest(payload: any, res: Response) {
  const callerPhone: string = payload?.message?.call?.customer?.number ?? "";
  const vapiCallId: string = payload?.message?.call?.id ?? "";

  const assistant = await prisma.vapiAssistant.findFirst({ where: { active: true } });
  if (!assistant) {
    logger.error("No active VapiAssistant found for assistant-request");
    return res.status(500).json({ error: "Assistant not configured" });
  }

  // Look up patient by phoneHash — the phone column is encrypted ciphertext
  // and cannot be queried with WHERE. phoneHash is a deterministic HMAC of the
  // normalized phone number, stored as a separate indexed column for this purpose.
  const patient = callerPhone
    ? await prisma.patient.findUnique({ where: { phoneHash: hashPhone(normalizePhone(callerPhone)) } })
    : null;

  if (patient) {
    // Returning patient — only inject context from an active (in-progress) session.
    // Completed sessions (active: false) are stale and should not be replayed.
    const session = await prisma.chatSession.findFirst({
      where: { userId: patient.userId, active: true },
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    // Prefer stored summary; fall back to serialized messages; empty if no active session.
    const chatContext = session?.summary
      ? `Previous call summary: ${session.summary}`
      : session
      ? serializeTranscript(session.messages)
      : "";

    const patientName = `${patient.firstName} ${patient.lastName}`;

    // Record the inbound call
    if (vapiCallId) {
      await prisma.voiceCall.upsert({
        where: { vapiCallId },
        create: {
          vapiCallId,
          patientId: patient.id,
          chatSessionId: session?.id ?? null,
          phone: callerPhone,
          direction: "inbound",
          status: "initiated",
        },
        update: {},
      });
    }

    logger.info("assistant-request: returning patient found", { patientId: patient.id, vapiCallId });

    return res.status(200).json({
      assistantId: assistant.vapiAssistantId,
      assistantOverrides: {
        firstMessage: `Hi ${patientName}, it's Aria from Westside Medical Group. Great to hear from you — how can I help you today?`,
        variableValues: {
          patientName,
          chatContext: chatContext || "No prior chat context.",
          callerPhone,
        },
      },
    });
  }

  // Unknown caller — fresh start, begin patient ID collection
  if (vapiCallId) {
    await prisma.voiceCall.upsert({
      where: { vapiCallId },
      create: {
        vapiCallId,
        patientId: "unknown",
        chatSessionId: null,
        phone: callerPhone || "unknown",
        direction: "inbound",
        status: "initiated",
      },
      update: {},
    }).catch(() => {
      // patientId FK will fail for "unknown" — log and continue
      logger.warn("Could not create VoiceCall for unknown caller", { vapiCallId });
    });
  }

  logger.info("assistant-request: unknown caller, fresh start", { callerPhone, vapiCallId });

  return res.status(200).json({
    assistantId: assistant.vapiAssistantId,
    assistantOverrides: {
      firstMessage: "Hi, thanks for calling Westside Medical Group. I'm Aria, your AI assistant. To get started, could I get your first and last name?",
      variableValues: {
        patientName: "there",
        chatContext: "",
        callerPhone,
      },
    },
  });
}

// ─── end-of-call-report ───────────────────────────────────────────────────────
// Fired when a call ends. Persists voice transcript, extracts structured
// outputs, and updates call + session records.

async function handleEndOfCallReport(payload: any, res: Response) {
  const vapiCallId: string = payload?.message?.call?.id ?? "";
  const endedReason: string = payload?.message?.endedReason ?? "unknown";
  const durationSeconds: number | undefined = payload?.message?.durationSeconds;

  // Structured outputs live at message.artifact.structuredOutputs.
  // The object is keyed by structured-output ID — flatten to the first entry
  // since we only attach one structured output to this assistant.
  const rawStructuredOutputs: Record<string, any> =
    payload?.message?.artifact?.structuredOutputs ?? {};

  // Extract fields — handle both flat and nested-under-ID shapes
  const so: Record<string, any> =
    Object.keys(rawStructuredOutputs).length > 0
      ? (typeof Object.values(rawStructuredOutputs)[0] === "object" &&
        !Array.isArray(Object.values(rawStructuredOutputs)[0])
          ? (Object.values(rawStructuredOutputs)[0] as Record<string, any>)
          : rawStructuredOutputs)
      : {};

  const callSummary: string | null = so?.callSummary ?? null;
  const pendingAction: string | null = so?.pendingAction ?? null;
  const bookingBooked: boolean | null = so?.bookingDetails?.booked ?? null;

  logger.info("end-of-call-report received", {
    vapiCallId,
    endedReason,
    durationSeconds,
    callSummary: callSummary ? callSummary.slice(0, 80) : null,
    pendingAction,
    bookingBooked,
  });

  // Look up the VoiceCall record to find the linked ChatSession
  const voiceCall = vapiCallId
    ? await prisma.voiceCall.findUnique({ where: { vapiCallId } })
    : null;

  // Mark the linked chat session as inactive and store the call summary.
  // We do NOT write the voice transcript into ChatMessage — voice transcripts
  // are call-only and should not appear in the web chat history.
  // The summary is used for context injection on the next interaction.
  if (voiceCall?.chatSessionId) {
    await prisma.chatSession.update({
      where: { id: voiceCall.chatSessionId },
      data: {
        active: false,
        ...(callSummary ? { summary: callSummary } : {}),
      },
    });
    logger.info("Chat session closed after call", {
      sessionId: voiceCall.chatSessionId,
      hasSummary: !!callSummary,
    });
  }

  // Update VoiceCall with final status + structured output fields
  if (voiceCall) {
    await prisma.voiceCall.update({
      where: { vapiCallId },
      data: {
        status: "ended",
        endedReason,
        durationSeconds: durationSeconds ?? null,
        ...(callSummary ? { callSummary } : {}),
        ...(pendingAction ? { pendingAction } : {}),
        ...(bookingBooked !== null ? { bookingBooked } : {}),
      },
    });
  }

  logger.info("end-of-call-report processed", { vapiCallId, endedReason, durationSeconds });

  return res.status(200).json({ success: true });
}
