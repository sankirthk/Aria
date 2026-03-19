import { VapiClient } from "@vapi-ai/server-sdk";
import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";
import type { ChatMessage } from "../generated/prisma";

const logger = getLogger("VapiService");

const vapi = new VapiClient({ token: process.env.VAPI_API_KEY! });

// Serialize ChatMessage rows into a plain-text transcript for voice context injection.
// Skips tool messages — those are internal and not useful to the voice agent.
export function serializeTranscript(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const speaker = m.role === "user" ? "[User]" : "[Aria]";
      return `${speaker}: ${m.content}`;
    })
    .join("\n");
}

function formatVoiceDateTime(date: Date): string {
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

async function buildOutboundPatientContext(patientId: string, patientName: string, phone: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });

  const bookings = await prisma.booking.findMany({
    where: { patientId, slot: { startTime: { gte: new Date() } } },
    include: { provider: true, slot: true },
    orderBy: { slot: { startTime: "asc" } },
    take: 3,
  });

  const lines = [
    `Patient: ${patientName}`,
    `Phone: ${patient?.phone ?? phone}`,
    `Profile complete: ${patient?.profileComplete ? "Yes" : "No"}`,
  ];

  if (bookings.length > 0) {
    lines.push("Upcoming appointments:");
    lines.push(
      ...bookings.map(
        (booking) =>
          `- ${booking.provider.name} (${booking.provider.specialty}) on ${formatVoiceDateTime(booking.slot.startTime)} [bookingId: ${booking.id}]`
      )
    );
  } else {
    lines.push("Upcoming appointments: none");
  }

  return lines.join("\n");
}

export interface HandoffParams {
  phone: string; // E.164 patient phone number
  patientId: string; // Patient.id (internal)
  patientName: string; // Full name for greeting + context
  chatSessionId: string; // ChatSession.id this call is continuing from
  transcript: string; // Serialized chat transcript from serializeTranscript()
}

export interface HandoffResult {
  callId: string;
  phone: string;
  message: string;
}

export async function initiateHandoffCall(
  params: HandoffParams,
): Promise<HandoffResult> {
  const { phone, patientId, patientName, chatSessionId, transcript } = params;
  const patientContext = await buildOutboundPatientContext(patientId, patientName, phone);

  // Look up the active Vapi assistant from DB
  const assistant = await prisma.vapiAssistant.findFirst({
    where: { active: true },
  });
  if (!assistant) {
    throw new Error(
      "No active Vapi assistant configured. Please seed VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID.",
    );
  }

  // Initiate outbound call via Vapi
  const call = await vapi.calls.create({
    phoneNumberId: assistant.phoneNumberId,
    customer: { number: phone },
    assistantId: assistant.vapiAssistantId,
    assistantOverrides: {
      firstMessage: `Hi ${patientName}, it's Aria from Westside Medical Group. I can see we were just chatting — let's pick up right where we left off.`,
      variableValues: {
        patientName,
        patientContext,
        chatContext: transcript || "No prior chat context.",
      },
    },
  } as any);

  const vapiCallId: string = (call as any).id;

  // Persist the call record
  await prisma.voiceCall.create({
    data: {
      vapiCallId,
      patientId,
      chatSessionId,
      phone,
      direction: "outbound",
      status: "initiated",
    },
  });

  logger.info("Outbound handoff call initiated", {
    vapiCallId,
    patientId,
    phone,
  });

  return {
    callId: vapiCallId,
    phone,
    message: `Calling you now at ${phone}. Aria will pick up right where your chat left off.`,
  };
}
