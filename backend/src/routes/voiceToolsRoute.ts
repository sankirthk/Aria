import { Router } from "express";
import {
  getContext,
  getProviders,
  getAvailableSlots,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
} from "../controllers/voiceToolsController";

const voiceToolsRouter = Router();

// Called by Vapi when the voice assistant invokes a server tool.
// Auth is Bearer VAPI_WEBHOOK_SECRET — no session middleware here.

voiceToolsRouter.post("/getContext", getContext);
voiceToolsRouter.post("/getProviders", getProviders);
voiceToolsRouter.post("/getAvailableSlots", getAvailableSlots);
voiceToolsRouter.post("/bookAppointment", bookAppointment);
voiceToolsRouter.post("/cancelAppointment", cancelAppointment);
voiceToolsRouter.post("/rescheduleAppointment", rescheduleAppointment);

export default voiceToolsRouter;
