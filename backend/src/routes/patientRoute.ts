import express from "express";
import { getProfile, updateProfile } from "../controllers/patientController";

const patientRouter = express.Router();

patientRouter.get("/profile", getProfile);
patientRouter.put("/profile", updateProfile);

export default patientRouter;
