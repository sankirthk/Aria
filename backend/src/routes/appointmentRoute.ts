import express from "express";
import { getAppointments, bookAppointment } from "../controllers/appointmentController";

const appointmentRouter = express.Router();

appointmentRouter.get("/", getAppointments);
appointmentRouter.post("/book", bookAppointment);

export default appointmentRouter;
