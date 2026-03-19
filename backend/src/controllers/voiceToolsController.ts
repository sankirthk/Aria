import { Request, Response } from "express";
import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";
import { sendBookingConfirmation, sendCancellationConfirmation, sendRescheduleConfirmation } from "../services/emailService";
import { normalizePhone } from "../utils/normalizePhone";
import { hashPhone } from "../utils/crypto";

const logger = getLogger("VoiceToolsController");

const PRACTICE_ADDRESS = "123 Westside Blvd, Suite 400, Los Angeles, CA 90025";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkAuth(req: Request): boolean {
  const secret = (req.headers["authorization"] ?? "").replace("Bearer ", "");
  return !!secret && secret === process.env.VAPI_WEBHOOK_SECRET;
}

/** Look up a patient by their E.164 phone number using the HMAC hash index. */
async function findPatientByPhone(phone: string) {
  if (!phone) return null;
  const phoneHash = hashPhone(normalizePhone(phone));
  return prisma.patient.findUnique({ where: { phoneHash } });
}

/**
 * Vapi webhook body for server tool calls:
 * {
 *   message: {
 *     type: "tool-calls",
 *     toolCallList: [{ id: "...", type: "function", function: { name: "...", arguments: { ... } } }]
 *   },
 *   call: {                          ← call is at the ROOT, not inside message
 *     id: "...",
 *     customer: { number: "+1..." }
 *   }
 * }
 *
 * Note: arguments is already a parsed object, not a JSON string.
 */
function parsePayload(req: Request) {
  logger.debug("Voice tool raw body", { body: JSON.stringify(req.body) });

  const body = req.body ?? {};
  const msg = body.message ?? {};
  // toolCallList is inside message
  const toolCall = msg?.toolCallList?.[0] ?? msg?.toolCalls?.[0];
  const toolCallId: string = toolCall?.id ?? "";
  const call = msg.call ?? toolCall?.call ?? body.call ?? {};
  const customer = call.customer ?? toolCall?.customer ?? {};

  // Vapi includes the active call context on tool-call webhooks.
  // Prefer message.call.customer.number, but also support tool-level customer
  // data because some payloads surface the number there.
  const phone: string =
    customer?.number ??
    customer?.phoneNumber ??
    toolCall?.customer?.number ??
    toolCall?.customer?.phoneNumber ??
    "";
  const vapiCallId: string = call?.id ?? toolCall?.call?.id ?? msg?.callId ?? body?.callId ?? "";

  // arguments is already a parsed object (not a JSON string)
  const rawArgs = toolCall?.function?.arguments;
  const args: Record<string, any> =
    rawArgs && typeof rawArgs === "object"
      ? rawArgs
      : (() => { try { return JSON.parse(rawArgs ?? "{}"); } catch { return {}; } })();

  logger.debug("Voice tool payload parsed", { toolCallId, phone: phone ? "present" : "missing", args });
  return { phone, vapiCallId, toolCallId, args };
}

function toolResult(res: Response, toolCallId: string, result: string) {
  if (!toolCallId) {
    logger.warn("Voice tool response missing toolCallId");
  }
  return res.status(200).json({ results: [{ toolCallId, result }] });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
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

  const lookup = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    month: Number(lookup.month),
    weekday: lookup.weekday?.toLowerCase() ?? "",
    hour: Number(lookup.hour),
  };
}

function isValidE164Phone(phone: string) {
  return /^\+[1-9]\d{9,14}$/.test(phone);
}

async function findOrCreateVoicePatient(
  phone: string,
  profile?: { firstName?: string; lastName?: string; dateOfBirth?: string },
) {
  const existingPatient = await findPatientByPhone(phone);
  if (existingPatient) {
    return existingPatient;
  }

  const normalizedPhone = normalizePhone(phone);
  if (!isValidE164Phone(normalizedPhone)) {
    return null;
  }

  const firstName = profile?.firstName?.trim();
  const lastName = profile?.lastName?.trim();
  const dateOfBirth = profile?.dateOfBirth?.trim();

  if (!firstName || !lastName || !dateOfBirth) {
    return null;
  }

  const phoneHash = hashPhone(normalizedPhone);
  const syntheticUserId = `voice:${phoneHash}`;

  return prisma.patient.upsert({
    where: { phoneHash },
    create: {
      userId: syntheticUserId,
      firstName,
      lastName,
      dateOfBirth,
      phone: normalizedPhone,
      phoneHash,
      profileComplete: true,
    },
    update: {
      firstName,
      lastName,
      dateOfBirth,
      phone: normalizedPhone,
      phoneHash,
      profileComplete: true,
    },
  });
}

// ─── Tool: get_context ────────────────────────────────────────────────────────
// Used by the inbound assistant to fetch the patient's latest chat summary,
// recent messages, and upcoming bookings on demand.

export const getContext = async (req: Request, res: Response) => {
  const { toolCallId, args } = parsePayload(req);

  if (!checkAuth(req)) {
    logger.warn("Voice tool unauthorized request", { tool: "get_context" });
    return toolResult(res, toolCallId, JSON.stringify({ error: "Unauthorized" }));
  }

  // phone is passed as a function argument by the assistant (set via variableValues.callerPhone
  // in the assistant-request handler). We never rely on parsing it from the call envelope.
  const phone: string = args.phone ?? "";
  const patient = await findPatientByPhone(phone);

  if (!patient) {
    return toolResult(
      res,
      toolCallId,
      "No patient record found for this number. This appears to be a new patient — collect their name, date of birth, and phone to create a profile."
    );
  }

  // Only pull chat transcript from an active (in-progress) session.
  // Completed sessions (active: false) are stale — don't replay them.
  const session = await prisma.chatSession.findFirst({
    where: { userId: patient.userId, active: true },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: { patientId: patient.id, slot: { startTime: { gte: now } } },
    include: { provider: true, slot: true },
    orderBy: { slot: { startTime: "asc" } },
    take: 3,
  });

  const patientName = `${patient.firstName} ${patient.lastName}`;

  let chatContext: string;
  if (session?.summary) {
    chatContext = session.summary;
  } else if (session && session.messages.length > 0) {
    chatContext = session.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => `${m.role === "user" ? "[Patient]" : "[Aria]"}: ${m.content}`)
      .join("\n");
  } else {
    chatContext = "No active chat session.";
  }

  const upcomingAppointments = bookings.map((b) => ({
    bookingId: b.id,
    providerName: b.provider.name,
    specialty: b.provider.specialty,
    dateTime: formatDateTime(b.slot.startTime),
    dateTimeISO: b.slot.startTime.toISOString(),
    slotId: b.slotId,
  }));

  const result = {
    patientName,
    phone: patient.phone,
    profileComplete: patient.profileComplete,
    chatContext,
    upcomingAppointments,
  };

  logger.info("Voice tool: get_context", { phone, patientId: patient.id });
  return toolResult(res, toolCallId, JSON.stringify(result));
};

// ─── Tool: get_providers ──────────────────────────────────────────────────────
// Returns all providers so Aria can semantically match the patient's concern.

export const getProviders = async (req: Request, res: Response) => {
  const { toolCallId } = parsePayload(req);

  if (!checkAuth(req)) {
    logger.warn("Voice tool unauthorized request", { tool: "get_providers" });
    return toolResult(res, toolCallId, JSON.stringify({ error: "Unauthorized" }));
  }

  const providers = await prisma.provider.findMany({ orderBy: { name: "asc" } });
  const result = JSON.stringify(
    providers.map((p) => ({
      id: p.id,
      name: p.name,
      specialty: p.specialty,
      keywords: p.keywords,
    }))
  );

  logger.info("Voice tool: get_providers");
  return toolResult(res, toolCallId, result);
};

// ─── Tool: getAvailableSlots ──────────────────────────────────────────────────
// Accepts a concern, provider name, or specialty and returns that provider's
// open slots. If only a concern is given, it uses keyword scoring to find the
// best provider match. No need to call getProviders first.

type ProviderMatch = {
  id: string;
  name: string;
  specialty: string;
  keywords: string[];
};

function matchProvider(
  concern: string,
  providers: ProviderMatch[]
): ProviderMatch | null {
  const lower = concern.toLowerCase();
  let best: (typeof providers)[0] | null = null;
  let bestScore = -1;

  for (const p of providers) {
    // Count keyword hits
    const score = p.keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
    // Bonus if the specialty itself appears in the concern
    const specialtyBonus = lower.includes(p.specialty.toLowerCase()) ? 2 : 0;
    const total = score + specialtyBonus;
    if (total > bestScore) {
      bestScore = total;
      best = p;
    }
  }

  return bestScore > 0 ? best : null;
}

function findProviderByNameOrSpecialty(
  providers: ProviderMatch[],
  providerName?: string,
  specialty?: string,
): ProviderMatch | null {
  const normalizedProviderName = providerName?.trim().toLowerCase();
  const normalizedSpecialty = specialty?.trim().toLowerCase();

  if (normalizedProviderName) {
    const exactNameMatch = providers.find(
      (provider) => provider.name.trim().toLowerCase() === normalizedProviderName,
    );
    if (exactNameMatch) return exactNameMatch;

    const partialNameMatch = providers.find((provider) =>
      provider.name.trim().toLowerCase().includes(normalizedProviderName),
    );
    if (partialNameMatch) return partialNameMatch;
  }

  if (normalizedSpecialty) {
    const exactSpecialtyMatch = providers.find(
      (provider) =>
        provider.specialty.trim().toLowerCase() === normalizedSpecialty,
    );
    if (exactSpecialtyMatch) return exactSpecialtyMatch;

    const partialSpecialtyMatch = providers.find((provider) =>
      provider.specialty.trim().toLowerCase().includes(normalizedSpecialty),
    );
    if (partialSpecialtyMatch) return partialSpecialtyMatch;
  }

  return null;
}

export const getAvailableSlots = async (req: Request, res: Response) => {
  const { toolCallId, args } = parsePayload(req);

  if (!checkAuth(req)) {
    logger.warn("Voice tool unauthorized request", { tool: "getAvailableSlots" });
    return toolResult(res, toolCallId, JSON.stringify({ error: "Unauthorized" }));
  }
  const {
    concern,
    providerName,
    specialty,
    dayOfWeek,
    timeOfDay,
    month,
    limit = 5,
  } = args;

  if (!concern && !providerName && !specialty) {
    logger.warn("Voice tool missing lookup arguments", {
      tool: "getAvailableSlots",
    });
    return toolResult(
      res,
      toolCallId,
      JSON.stringify({
        error:
          "Provide at least one of concern, providerName, or specialty.",
      }),
    );
  }

  const allProviders = await prisma.provider.findMany();
  const matched =
    findProviderByNameOrSpecialty(allProviders, providerName, specialty) ??
    (concern ? matchProvider(concern, allProviders) : null);

  if (!matched) {
    logger.warn("Voice tool no provider match found", {
      tool: "getAvailableSlots",
      concern,
      providerName,
      specialty,
    });
    return toolResult(
      res,
      toolCallId,
      JSON.stringify({
        error:
          "No matching provider found for the supplied concern, provider name, or specialty.",
      }),
    );
  }

  const now = new Date();
  const windowStart = now;
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + 60);

  const slots = await prisma.slot.findMany({
    where: {
      providerId: matched.id,
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
    // month can be "2026-03" (YYYY-MM) or a plain month number string "3"
    const targetMonth = month.includes("-")
      ? parseInt(month.split("-")[1], 10)
      : parseInt(month, 10);
    filtered = filtered.filter((s) => getLATimeParts(s.startTime).month === targetMonth);
  }

  if (dayOfWeek) {
    const target = dayMap[dayOfWeek.toLowerCase()];
    if (target !== undefined) {
      filtered = filtered.filter((s) => {
        const weekday = getLATimeParts(s.startTime).weekday;
        return dayMap[weekday] === target;
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
    providerName: s.provider.name,
    specialty: s.provider.specialty,
    startTime: formatDateTime(s.startTime),
    startTimeISO: s.startTime.toISOString(),
  }));

  logger.info("Voice tool: getAvailableSlots", {
    concern,
    providerName,
    specialty,
    matchedProvider: matched.name,
    returned: results.length,
  });

  return toolResult(
    res,
    toolCallId,
    JSON.stringify({ matchedProvider: matched.name, specialty: matched.specialty, slots: results })
  );
};

// ─── Tool: cancelAppointment ─────────────────────────────────────────────────
// Cancels an upcoming booking and frees the slot. Refuses past appointments.

export const cancelAppointment = async (req: Request, res: Response) => {
  const { phone, toolCallId, args } = parsePayload(req);
  if (!checkAuth(req)) {
    logger.warn("Voice tool unauthorized request", { tool: "cancelAppointment" });
    return toolResult(res, toolCallId, JSON.stringify({ error: "Unauthorized" }));
  }
  const { bookingId } = args;

  if (!bookingId) {
    return toolResult(res, toolCallId, JSON.stringify({ error: "bookingId is required" }));
  }

  const patient = await findPatientByPhone(phone);
  if (!patient) {
    return toolResult(res, toolCallId, JSON.stringify({ error: "Patient not found." }));
  }
  const user = await prisma.user.findUnique({ where: { id: patient.userId } });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: true, provider: true },
  });

  if (!booking) return toolResult(res, toolCallId, JSON.stringify({ error: "Booking not found." }));
  if (booking.patientId !== patient.id) return toolResult(res, toolCallId, JSON.stringify({ error: "This booking does not belong to you." }));
  if (booking.status === "cancelled") return toolResult(res, toolCallId, JSON.stringify({ error: "This appointment is already cancelled." }));
  if (booking.slot.startTime <= new Date()) return toolResult(res, toolCallId, JSON.stringify({ error: "Cannot cancel a past appointment." }));

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
    }).catch((err) => logger.error("Voice cancellation email failed", { error: err.message }));
  }

  logger.info("Voice tool: cancelAppointment succeeded", { bookingId, patientId: patient.id });

  return toolResult(
    res,
    toolCallId,
    JSON.stringify({
      success: true,
      message: `Your appointment with ${booking.provider.name} on ${formatDateTime(booking.slot.startTime)} has been cancelled.`,
    })
  );
};

// ─── Tool: rescheduleAppointment ─────────────────────────────────────────────
// Swaps an existing booking to a new slot. Refuses past appointments.

export const rescheduleAppointment = async (req: Request, res: Response) => {
  const { phone, toolCallId, args } = parsePayload(req);
  if (!checkAuth(req)) {
    logger.warn("Voice tool unauthorized request", { tool: "rescheduleAppointment" });
    return toolResult(res, toolCallId, JSON.stringify({ error: "Unauthorized" }));
  }
  const { bookingId, newSlotId } = args;

  if (!bookingId || !newSlotId) {
    return toolResult(res, toolCallId, JSON.stringify({ error: "bookingId and newSlotId are required" }));
  }

  const patient = await findPatientByPhone(phone);
  if (!patient) {
    return toolResult(res, toolCallId, JSON.stringify({ error: "Patient not found." }));
  }
  const user = await prisma.user.findUnique({ where: { id: patient.userId } });

  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: true, provider: true },
  });

  if (!existing) return toolResult(res, toolCallId, JSON.stringify({ error: "Booking not found." }));
  if (existing.patientId !== patient.id) return toolResult(res, toolCallId, JSON.stringify({ error: "This booking does not belong to you." }));
  if (existing.status === "cancelled") return toolResult(res, toolCallId, JSON.stringify({ error: "Cannot reschedule a cancelled appointment." }));
  if (existing.slot.startTime <= new Date()) return toolResult(res, toolCallId, JSON.stringify({ error: "Cannot reschedule a past appointment." }));

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const newSlot = await tx.slot.findUnique({ where: { id: newSlotId }, include: { provider: true } });
      if (!newSlot) throw Object.assign(new Error("New slot not found"), { code: "NOT_FOUND" });
      if (!newSlot.available) throw Object.assign(new Error("New slot already booked"), { code: "CONFLICT" });

      await tx.slot.update({ where: { id: existing.slotId }, data: { available: true } });
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
      }).catch((err) => logger.error("Voice reschedule email failed", { error: err.message }));
    }

    logger.info("Voice tool: rescheduleAppointment succeeded", { bookingId, newSlotId, patientId: patient.id });

    return toolResult(
      res,
      toolCallId,
      JSON.stringify({
        success: true,
        providerName: updated.provider.name,
        specialty: updated.provider.specialty,
        dateTime: formatDateTime(updated.slot.startTime),
        address: PRACTICE_ADDRESS,
      })
    );
  } catch (err: any) {
    if (err.code === "NOT_FOUND") return toolResult(res, toolCallId, JSON.stringify({ error: "New slot not found." }));
    if (err.code === "CONFLICT") return toolResult(res, toolCallId, JSON.stringify({ error: "That slot is no longer available. Please choose another time." }));
    logger.error("Voice tool: rescheduleAppointment error", { error: err.message });
    return toolResult(res, toolCallId, JSON.stringify({ error: "Reschedule failed. Please try again." }));
  }
};

// ─── Tool: book_appointment ───────────────────────────────────────────────────
// Atomically books a slot, sends a confirmation email, and flags the VoiceCall.

export const bookAppointment = async (req: Request, res: Response) => {
  const { phone, vapiCallId, toolCallId, args } = parsePayload(req);
  try {
    if (!checkAuth(req)) {
      logger.warn("Voice tool unauthorized request", { tool: "bookAppointment" });
      return toolResult(res, toolCallId, JSON.stringify({ error: "Unauthorized" }));
    }

    const { slotId, firstName, lastName, dateOfBirth, phone: providedPhone } = args;

    if (!slotId) {
      return toolResult(res, toolCallId, JSON.stringify({ error: "slotId is required" }));
    }

    const callerPhone = typeof providedPhone === "string" && providedPhone.trim() ? providedPhone : phone;
    const patient = await findOrCreateVoicePatient(callerPhone, {
      firstName,
      lastName,
      dateOfBirth,
    });
    if (!patient) {
      return toolResult(
        res,
        toolCallId,
        JSON.stringify({
          error:
            "Patient profile not found. For new callers, provide firstName, lastName, dateOfBirth, and phone before booking.",
        })
      );
    }

    const user = await prisma.user.findUnique({ where: { id: patient.userId } });

    const booking = await prisma.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({
        where: { id: slotId },
        include: { provider: true },
      });
      if (!slot) throw Object.assign(new Error("Slot not found"), { code: "NOT_FOUND" });
      if (!slot.available) throw Object.assign(new Error("Already booked"), { code: "CONFLICT" });

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

    // Flag the VoiceCall record so the end-of-call-report knows a booking happened
    if (vapiCallId) {
      await prisma.voiceCall
        .updateMany({ where: { vapiCallId }, data: { bookingBooked: true } })
        .catch(() => {});
    }

    if (user?.email) {
      void sendBookingConfirmation({
        to: user.email,
        patientName: `${patient.firstName} ${patient.lastName}`,
        providerName: booking.provider.name,
        specialty: booking.provider.specialty,
        dateTime: booking.slot.startTime,
        address: PRACTICE_ADDRESS,
      }).catch((err) => logger.error("Voice booking email failed", { error: err.message }));
    }

    logger.info("Voice tool: book_appointment succeeded", {
      bookingId: booking.id,
      patientId: patient.id,
      slotId,
    });

    return toolResult(
      res,
      toolCallId,
      JSON.stringify({
        success: true,
        bookingId: booking.id,
        providerName: booking.provider.name,
        specialty: booking.provider.specialty,
        dateTime: formatDateTime(booking.slot.startTime),
        address: PRACTICE_ADDRESS,
      })
    );
  } catch (err: any) {
    if (err.code === "NOT_FOUND") {
      return toolResult(res, toolCallId, JSON.stringify({ error: "Slot not found." }));
    }
    if (err.code === "CONFLICT") {
      return toolResult(
        res,
        toolCallId,
        JSON.stringify({ error: "That slot is no longer available. Please choose another time." })
      );
    }
    logger.error("Voice tool: book_appointment error", { error: err.message, stack: err.stack, phone: phone ? "present" : "missing" });
    return toolResult(res, toolCallId, JSON.stringify({ error: "Booking failed. Please try again." }));
  }
};
