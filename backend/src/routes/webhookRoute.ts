import { Router } from "express";
import { handle } from "../controllers/webhookController";

const webhookRouter = Router();

webhookRouter.post("/", handle);

export default webhookRouter;
