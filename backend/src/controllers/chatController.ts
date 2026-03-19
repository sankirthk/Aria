import { Request, Response } from "express";
import { auth } from "../lib/auth/auth";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";
import { streamAgentResponse } from "../services/agent/agentService";
import { z } from "zod";

const logger = getLogger("ChatController");

const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content cannot be empty"),
});

// POST /chat/session — create a new session, deactivate any existing
export const createSession = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    await prisma.chatSession.updateMany({
      where: { userId: session.user.id, active: true },
      data: { active: false },
    });

    const chatSession = await prisma.chatSession.create({
      data: { userId: session.user.id, active: true },
    });

    logger.info("Chat session created", { userId: session.user.id, sessionId: chatSession.id });
    return res.status(201).json({ success: true, data: chatSession });
  } catch (err: any) {
    logger.error("Error creating chat session", { userId: session.user.id, error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// GET /chat/session/active — get the active session with messages, or null if none exists.
// Does NOT auto-create — session is lazily created on first message send.
export const getActiveSession = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    const chatSession = await prisma.chatSession.findFirst({
      where: { userId: session.user.id, active: true },
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    if (chatSession) {
      logger.info("Active session found", { userId: session.user.id, sessionId: chatSession.id, messageCount: chatSession.messages.length });
    } else {
      logger.info("No active session — fresh start", { userId: session.user.id });
    }

    return res.status(200).json({ success: true, data: chatSession ?? null });
  } catch (err: any) {
    logger.error("Error fetching active session", { error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// GET /chat/sessions — list all sessions for the user (newest first)
export const getSessions = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
    });
    return res.status(200).json({ success: true, data: sessions });
  } catch (err: any) {
    logger.error("Error fetching sessions", { error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// GET /chat/session/:sessionId — get a specific session (must belong to user)
export const getSession = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ success: false, error: "Unauthorized" });

  const { sessionId } = req.params;

  try {
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!chatSession) return res.status(404).json({ success: false, error: "Session not found" });
    if (chatSession.userId !== session.user.id) return res.status(403).json({ success: false, error: "Forbidden" });

    return res.status(200).json({ success: true, data: chatSession });
  } catch (err: any) {
    logger.error("Error fetching session", { sessionId, error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// DELETE /chat/session/:sessionId — permanently delete a session and its messages
export const deleteSession = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ success: false, error: "Unauthorized" });

  const { sessionId } = req.params;

  try {
    const chatSession = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!chatSession) return res.status(404).json({ success: false, error: "Session not found" });
    if (chatSession.userId !== session.user.id) return res.status(403).json({ success: false, error: "Forbidden" });

    await prisma.chatMessage.deleteMany({ where: { sessionId } });
    await prisma.chatSession.delete({ where: { id: sessionId } });

    logger.info("Chat session deleted", { userId: session.user.id, sessionId });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    logger.error("Error deleting session", { sessionId, error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// POST /chat/session/:sessionId/message — send a message, stream SSE response
export const sendMessage = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ success: false, error: "Unauthorized" });

  const { sessionId } = req.params;

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const chatSession = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!chatSession) return res.status(404).json({ success: false, error: "Session not found" });
    if (chatSession.userId !== session.user.id) return res.status(403).json({ success: false, error: "Forbidden" });

    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const writeSSE = (event: string, data: object) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Handle client disconnect
    req.on("close", () => res.end());

    logger.info("Streaming agent response", { sessionId, userId: session.user.id, messageLength: parsed.data.content.length });

    await streamAgentResponse({
      sessionId,
      userMessage: parsed.data.content,
      patient,
      writeSSE,
    });

    logger.info("Agent stream complete", { sessionId });
    return res.end();
  } catch (err: any) {
    logger.error("Error in sendMessage", { sessionId, error: err.message });
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
    res.write(`event: error\ndata: ${JSON.stringify({ message: "Stream error" })}\n\n`);
    return res.end();
  }
};
