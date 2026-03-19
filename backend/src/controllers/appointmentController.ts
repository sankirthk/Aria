import { Request, Response } from "express";
import { auth } from "../lib/auth/auth";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";
import { bookAppointmentSchema } from "../validators/appointmentSchema";
import { sendBookingConfirmation } from "../services/emailService";

const logger = getLogger("AppointmentController");

export const getAppointments = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    logger.warn("Unauthorized request to getAppointments");
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
    if (!patient) {
      logger.warn("Patient profile missing while fetching appointments", { userId: session.user.id });
      return res.status(404).json({ success: false, error: "Patient profile not found" });
    }

    const bookings = await prisma.booking.findMany({
      where: { patientId: patient.id },
      include: {
        provider: true,
        slot: true,
      },
      orderBy: { slot: { startTime: "asc" } },
    });

    const now = new Date();
    const upcoming = bookings.filter((b) => b.slot.startTime >= now);
    const past = bookings.filter((b) => b.slot.startTime < now);

    logger.info("Appointments fetched", { userId: session.user.id, patientId: patient.id, upcoming: upcoming.length, past: past.length });
    return res.status(200).json({ success: true, data: { upcoming, past } });
  } catch (err: any) {
    logger.error("Error fetching appointments", { userId: session.user.id, error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const bookAppointment = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    logger.warn("Unauthorized request to bookAppointment");
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const parsed = bookAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("bookAppointment validation failed", { userId: session.user.id, details: parsed.error.flatten() });
    return res.status(400).json({ success: false, error: "Invalid input", details: parsed.error.flatten() });
  }

  const { slotId } = parsed.data;

  try {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
    if (!patient) {
      logger.warn("Patient profile missing while booking appointment", { userId: session.user.id, slotId });
      return res.status(404).json({ success: false, error: "Patient profile not found" });
    }

    const booking = await prisma.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({ where: { id: slotId }, include: { provider: true } });

      if (!slot) throw Object.assign(new Error("Slot not found"), { code: "NOT_FOUND" });
      if (!slot.available) throw Object.assign(new Error("Slot already booked"), { code: "CONFLICT" });

      await tx.slot.update({ where: { id: slotId }, data: { available: false } });

      return tx.booking.create({
        data: {
          patientId: patient.id,
          providerId: slot.providerId,
          slotId,
          status: "confirmed",
        },
        include: { provider: true, slot: true },
      });
    });

    // Fire-and-forget confirmation email
    void sendBookingConfirmation({
      to: session.user.email,
      patientName: `${patient.firstName} ${patient.lastName}`,
      providerName: booking.provider.name,
      specialty: booking.provider.specialty,
      dateTime: booking.slot.startTime,
      address: "123 Westside Blvd, Suite 400, Los Angeles, CA 90025",
    }).catch((err) => logger.error("Booking email failed", { error: err.message }));

    logger.info("Appointment booked", { bookingId: booking.id, patientId: patient.id, slotId });
    return res.status(201).json({ success: true, data: booking });
  } catch (err: any) {
    if (err.code === "NOT_FOUND") {
      logger.warn("Attempted to book missing slot", { userId: session.user.id, slotId });
      return res.status(404).json({ success: false, error: "Slot not found" });
    }
    if (err.code === "CONFLICT") {
      logger.warn("Attempted to book unavailable slot", { userId: session.user.id, slotId });
      return res.status(409).json({ success: false, error: "Slot is no longer available" });
    }
    logger.error("Error booking appointment", { error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};
