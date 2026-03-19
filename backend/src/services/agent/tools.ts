import { tool } from "langchain";
import { z } from "zod";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import prisma from "../../clients/prismaClient";
import { sendBookingConfirmation, sendCancellationConfirmation, sendRescheduleConfirmation } from "../emailService";
import { getLogger } from "../../config/logger";
import { normalizePhone } from "../../utils/normalizePhone";
import { hashPhone } from "../../utils/crypto";

const logger = getLogger("AgentTools");

const PRACTICE_ADDRESS = "123 Westside Blvd, Suite 400, Los Angeles, CA 90025";

function formatLADateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getLATimeParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "numeric",
    hour: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    month: Number(lookup.month),
    weekday: lookup.weekday?.toLowerCase() ?? "",
    hour: Number(lookup.hour),
  };
}

// get_providers — returns all providers for Aria to semantically match against
export const getProvidersTool = tool(
  async () => {
    const providers = await prisma.provider.findMany({ orderBy: { name: "asc" } });
    return JSON.stringify(
      providers.map((p) => ({
        id: p.id,
        name: p.name,
        specialty: p.specialty,
        keywords: p.keywords,
        bio: p.bio,
      }))
    );
  },
  {
    name: "get_providers",
    description:
      "Get all available healthcare providers and their specialties. Use this to semantically match a patient's concern to the right provider. Never show the provider list directly to the patient — make the selection transparently.",
    schema: z.object({}),
  }
);

// get_available_slots — returns open slots for a given provider
export const getAvailableSlotsTool = tool(
  async ({ providerId, dayOfWeek, timeOfDay, month, limit = 5 }) => {
    const now = new Date();

    // If a specific month is requested, search across the full 60-day window
    // so month-based filtering has enough candidates to work with.
    // Without a month filter, restrict to the standard 30–60 day seed window.
    const windowStart = month ? now : (() => { const d = new Date(now); d.setDate(d.getDate() + 30); return d; })();
    const windowEnd = new Date(now);
    windowEnd.setDate(now.getDate() + 60);

    const slots = await prisma.slot.findMany({
      where: {
        providerId,
        available: true,
        startTime: { gte: windowStart, lte: windowEnd },
      },
      include: { provider: true },
      orderBy: { startTime: "asc" },
    });

    const dayMap: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
    };

    let filtered = slots;

    if (month) {
      filtered = filtered.filter((s) => getLATimeParts(s.startTime).month === month);
    }

    if (dayOfWeek) {
      const targetDay = dayMap[dayOfWeek.toLowerCase()];
      if (targetDay !== undefined) {
        filtered = filtered.filter((s) => {
          const weekday = getLATimeParts(s.startTime).weekday;
          return dayMap[weekday] === targetDay;
        });
      }
    }

    if (timeOfDay) {
      filtered = filtered.filter((s) => {
        const hour = getLATimeParts(s.startTime).hour;
        if (timeOfDay === "morning") return hour >= 9 && hour < 12;
        if (timeOfDay === "afternoon") return hour >= 12 && hour < 17;
        return true;
      });
    }

    const results = filtered.slice(0, limit).map((s) => ({
      slotId: s.id,
      providerId: s.providerId,
      providerName: s.provider.name,
      specialty: s.provider.specialty,
      startTime: formatLADateTime(s.startTime),
      startTimeISO: s.startTime.toISOString(),
    }));

    return JSON.stringify(results);
  },
  {
    name: "get_available_slots",
    description:
      "Get available appointment slots for a specific provider within the next 30–60 days. Use the slotId from the response when booking.",
    schema: z.object({
      providerId: z.string().describe("The provider ID from get_providers"),
      month: z.number().min(1).max(12).optional().describe("Filter by month number (1=January, 12=December)"),
      dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]).optional(),
      timeOfDay: z
        .enum(["morning", "afternoon"])
        .optional()
        .describe("morning = 9AM–12PM, afternoon = 12PM–5PM"),
      limit: z.number().optional().default(5),
    }),
  }
);

// book_appointment — atomically books a slot, sends confirmation email
export const bookAppointmentTool = tool(
  async ({ slotId }, config: LangGraphRunnableConfig) => {
    const userId = (config.configurable as any)?.userId as string | undefined;
    if (!userId) return JSON.stringify({ error: "No user session found." });

    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return JSON.stringify({ error: "Patient profile not found. Please complete your profile first." });

    const user = await prisma.user.findUnique({ where: { id: userId } });

    try {
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

      if (user?.email) {
        void sendBookingConfirmation({
          to: user.email,
          patientName: `${patient.firstName} ${patient.lastName}`,
          providerName: booking.provider.name,
          specialty: booking.provider.specialty,
          dateTime: booking.slot.startTime,
          address: PRACTICE_ADDRESS,
        }).catch((err) => logger.error("Booking email failed", { error: err.message }));
      }

      logger.info("Appointment booked via agent", { bookingId: booking.id, patientId: patient.id, slotId });

      return JSON.stringify({
        bookingId: booking.id,
        providerName: booking.provider.name,
        specialty: booking.provider.specialty,
        dateTime: formatLADateTime(booking.slot.startTime),
        address: PRACTICE_ADDRESS,
        status: "confirmed",
      });
    } catch (err: any) {
      if (err.code === "NOT_FOUND") return JSON.stringify({ error: "Slot not found." });
      if (err.code === "CONFLICT") return JSON.stringify({ error: "That slot is no longer available. Please choose another." });
      logger.error("Booking error in agent tool", { error: err.message });
      return JSON.stringify({ error: "Booking failed. Please try again." });
    }
  },
  {
    name: "book_appointment",
    description:
      "Book an appointment slot for the current patient. Only call this AFTER the patient has explicitly confirmed the slot details. Returns booking confirmation.",
    schema: z.object({
      slotId: z.string().describe("The slot ID from get_available_slots"),
    }),
  }
);

// update_patient_profile — upserts patient profile record
export const updatePatientProfileTool = tool(
  async ({ firstName, lastName, dateOfBirth, phone }, config: LangGraphRunnableConfig) => {
    const userId = (config.configurable as any)?.userId as string | undefined;
    if (!userId) return JSON.stringify({ error: "No user session found." });

    try {
      const normalizedPhone = normalizePhone(phone);
      const isValidE164Phone = /^\+[1-9]\d{9,14}$/.test(normalizedPhone);

      if (!isValidE164Phone) {
        logger.warn("Rejected invalid patient phone during profile update", {
          userId,
          phone,
          normalizedPhone,
        });
        return JSON.stringify({
          error:
            "Invalid phone number. Please provide a full phone number in E.164 format, for example +14155550123.",
        });
      }

      const phoneHash = hashPhone(normalizedPhone);

      const patient = await prisma.patient.upsert({
        where: { userId },
        create: { userId, firstName, lastName, dateOfBirth, phone: normalizedPhone, phoneHash, profileComplete: true },
        update: { firstName, lastName, dateOfBirth, phone: normalizedPhone, phoneHash, profileComplete: true },
      });

      logger.info("Patient profile updated via agent", { patientId: patient.id });

      return JSON.stringify({
        success: true,
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          phone: patient.phone,
          profileComplete: patient.profileComplete,
        },
      });
    } catch (err: any) {
      logger.error("Profile update error in agent tool", { error: err.message });
      return JSON.stringify({ error: "Failed to save profile. Please try again." });
    }
  },
  {
    name: "update_patient_profile",
    description:
      "Save the patient's profile after collecting and confirming firstName, lastName, dateOfBirth (YYYY-MM-DD), and phone (E.164 format e.g. +14155550123). Always confirm the details with the patient before calling this tool.",
    schema: z.object({
      firstName: z.string(),
      lastName: z.string(),
      dateOfBirth: z.string().describe("ISO date format: YYYY-MM-DD"),
      phone: z.string().describe("E.164 format, e.g. +14155550123"),
    }),
  }
);

// cancel_appointment — marks booking cancelled and frees the slot
export const cancelAppointmentTool = tool(
  async ({ bookingId }, config: LangGraphRunnableConfig) => {
    const userId = (config.configurable as any)?.userId as string | undefined;
    if (!userId) return JSON.stringify({ error: "No user session found." });

    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return JSON.stringify({ error: "Patient profile not found." });
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true, provider: true },
    });

    if (!booking) return JSON.stringify({ error: "Booking not found." });
    if (booking.patientId !== patient.id) return JSON.stringify({ error: "This booking does not belong to you." });
    if (booking.status === "cancelled") return JSON.stringify({ error: "This appointment is already cancelled." });
    if (booking.slot.startTime <= new Date()) return JSON.stringify({ error: "Cannot cancel a past appointment." });

    await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } }),
      prisma.slot.update({ where: { id: booking.slotId }, data: { available: true } }),
    ]);

    if (user?.email) {
      void sendCancellationConfirmation({
        to: user.email,
        patientName: `${patient.firstName} ${patient.lastName}`,
        providerName: booking.provider.name,
        specialty: booking.provider.specialty,
        dateTime: booking.slot.startTime,
        address: PRACTICE_ADDRESS,
      }).catch((err) => logger.error("Cancellation email failed", { error: err.message }));
    }

    logger.info("Appointment cancelled via agent", { bookingId, patientId: patient.id });

    return JSON.stringify({
      success: true,
      message: `Your appointment with ${booking.provider.name} has been cancelled and the slot is now available for others.`,
    });
  },
  {
    name: "cancel_appointment",
    description:
      "Cancel an upcoming appointment. The bookingId is shown in brackets next to each appointment in the patient's upcoming appointments list. Cannot cancel past appointments. Always confirm with the patient before calling this tool.",
    schema: z.object({
      bookingId: z.string().describe("The booking ID to cancel"),
    }),
  }
);

// reschedule_appointment — swaps the slot on an existing booking
export const rescheduleAppointmentTool = tool(
  async ({ bookingId, newSlotId }, config: LangGraphRunnableConfig) => {
    const userId = (config.configurable as any)?.userId as string | undefined;
    if (!userId) return JSON.stringify({ error: "No user session found." });

    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return JSON.stringify({ error: "Patient profile not found." });
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true, provider: true },
    });

    if (!existing) return JSON.stringify({ error: "Booking not found." });
    if (existing.patientId !== patient.id) return JSON.stringify({ error: "This booking does not belong to you." });
    if (existing.status === "cancelled") return JSON.stringify({ error: "Cannot reschedule a cancelled appointment." });
    if (existing.slot.startTime <= new Date()) return JSON.stringify({ error: "Cannot reschedule a past appointment." });

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const newSlot = await tx.slot.findUnique({ where: { id: newSlotId }, include: { provider: true } });
        if (!newSlot) throw Object.assign(new Error("New slot not found"), { code: "NOT_FOUND" });
        if (!newSlot.available) throw Object.assign(new Error("New slot already booked"), { code: "CONFLICT" });

        // Free the old slot
        await tx.slot.update({ where: { id: existing.slotId }, data: { available: true } });
        // Reserve the new slot
        await tx.slot.update({ where: { id: newSlotId }, data: { available: false } });

        return tx.booking.update({
          where: { id: bookingId },
          data: { slotId: newSlotId, providerId: newSlot.providerId },
          include: { provider: true, slot: true },
        });
      });

      if (user?.email) {
        void sendRescheduleConfirmation({
          to: user.email,
          patientName: `${patient.firstName} ${patient.lastName}`,
          providerName: updated.provider.name,
          specialty: updated.provider.specialty,
          dateTime: updated.slot.startTime,
          address: PRACTICE_ADDRESS,
        }).catch((err) => logger.error("Reschedule email failed", { error: err.message }));
      }

      logger.info("Appointment rescheduled via agent", { bookingId, newSlotId, patientId: patient.id });

      return JSON.stringify({
        success: true,
        providerName: updated.provider.name,
        specialty: updated.provider.specialty,
        dateTime: formatLADateTime(updated.slot.startTime),
        address: PRACTICE_ADDRESS,
      });
    } catch (err: any) {
      if (err.code === "NOT_FOUND") return JSON.stringify({ error: "New slot not found." });
      if (err.code === "CONFLICT") return JSON.stringify({ error: "That slot is no longer available. Please choose another." });
      logger.error("Reschedule error in agent tool", { error: err.message });
      return JSON.stringify({ error: "Reschedule failed. Please try again." });
    }
  },
  {
    name: "reschedule_appointment",
    description:
      "Reschedule an existing upcoming appointment to a new slot. Use get_available_slots to find newSlotId options first, then confirm the new time with the patient before calling this. Cannot reschedule past or cancelled appointments.",
    schema: z.object({
      bookingId: z.string().describe("The booking ID to reschedule (from upcoming appointments list)"),
      newSlotId: z.string().describe("The new slot ID from get_available_slots"),
    }),
  }
);

export const agentTools = [
  getProvidersTool,
  getAvailableSlotsTool,
  bookAppointmentTool,
  cancelAppointmentTool,
  rescheduleAppointmentTool,
  updatePatientProfileTool,
];
