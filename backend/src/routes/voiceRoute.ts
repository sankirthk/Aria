import { Router } from "express";
import { handoff } from "../controllers/voiceController";

const voiceRouter = Router();

voiceRouter.post("/handoff", handoff);

export default voiceRouter;
