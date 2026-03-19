import express from "express";
import { getProviders, getSlots } from "../controllers/providerController";

const providerRouter = express.Router();

providerRouter.get("/", getProviders);
providerRouter.get("/:id/slots", getSlots);

export default providerRouter;
