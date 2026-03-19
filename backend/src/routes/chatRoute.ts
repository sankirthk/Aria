import express from "express";
import { createSession, getActiveSession, getSessions, getSession, deleteSession, sendMessage } from "../controllers/chatController";

const chatRouter = express.Router();

chatRouter.post("/session", createSession);
chatRouter.get("/sessions", getSessions);
chatRouter.get("/session/active", getActiveSession);
chatRouter.get("/session/:sessionId", getSession);
chatRouter.delete("/session/:sessionId", deleteSession);
chatRouter.post("/session/:sessionId/message", sendMessage);

export default chatRouter;
