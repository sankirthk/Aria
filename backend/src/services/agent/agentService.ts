import { createAgent, dynamicSystemPromptMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import prisma from "../../clients/prismaClient";
import { getLogger } from "../../config/logger";
import { checkpointer } from "./checkpointer";
import { agentTools } from "./tools";
import { buildSystemPrompt, PatientContext } from "./systemPrompt";

const logger = getLogger("AgentService");

// Log LangSmith tracing status at startup
const tracingEnabled = !!(
  process.env.LANGSMITH_TRACING_V2 === "true" ||
  process.env.LANGCHAIN_TRACING_V2 === "true" ||
  process.env.LANGSMITH_TRACING === "true" ||
  process.env.LANGCHAIN_TRACING === "true"
);
logger.info("LangSmith tracing status", {
  enabled: tracingEnabled,
  project: process.env.LANGCHAIN_PROJECT ?? process.env.LANGSMITH_PROJECT ?? "(not set)",
  endpoint: process.env.LANGCHAIN_ENDPOINT ?? process.env.LANGSMITH_ENDPOINT ?? "(not set)",
  apiKeyPresent: !!(process.env.LANGCHAIN_API_KEY ?? process.env.LANGSMITH_API_KEY),
});

const contextSchema = z.object({
  patientName: z.string().nullable(),
  profileComplete: z.boolean(),
  upcomingBookings: z.array(
    z.object({
      providerName: z.string(),
      specialty: z.string(),
      startTime: z.union([z.date(), z.string()]),
    })
  ),
});

const model = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.3,
});

const agent = createAgent({
  model,
  tools: agentTools,
  checkpointer,
  contextSchema,
  middleware: [
    dynamicSystemPromptMiddleware<z.infer<typeof contextSchema>>((_, runtime) => {
      return buildSystemPrompt(runtime.context as PatientContext);
    }),
  ],
});

export interface StreamAgentParams {
  sessionId: string;
  userMessage: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    profileComplete: boolean;
  } | null;
  writeSSE: (event: string, data: object) => void;
}

export async function streamAgentResponse({
  sessionId,
  userMessage,
  patient,
  writeSSE,
}: StreamAgentParams): Promise<void> {
  // Fetch upcoming bookings for context
  let upcomingBookings: PatientContext["upcomingBookings"] = [];
  if (patient) {
    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: { patientId: patient.id, slot: { startTime: { gte: now } } },
      include: { provider: true, slot: true },
      orderBy: { slot: { startTime: "asc" } },
      take: 5,
    });
    upcomingBookings = bookings.map((b) => ({
      bookingId: b.id,
      providerName: b.provider.name,
      specialty: b.provider.specialty,
      startTime: b.slot.startTime,
    }));
  }

  const patientContext: PatientContext = {
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : null,
    profileComplete: patient?.profileComplete ?? false,
    upcomingBookings,
  };

  logger.info("Agent stream started", { sessionId, patientName: patientContext.patientName, profileComplete: patientContext.profileComplete });

  // Persist user message to ChatMessage table (for frontend display)
  await prisma.chatMessage.create({
    data: { sessionId, role: "user", content: userMessage },
  });

  let fullResponse = "";
  let bookingCreated = false;
  let bookingId: string | null = null;

  try {
    const stream = await agent.stream(
      { messages: [{ role: "user", content: userMessage }] },
      {
        configurable: {
          thread_id: sessionId,
          userId: (await prisma.chatSession.findUnique({ where: { id: sessionId } }))?.userId,
        },
        context: patientContext,
        streamMode: ["messages", "updates"] as const,
      }
    );

    for await (const [mode, chunk] of stream) {
      if (mode === "messages") {
        const [token, metadata] = chunk as [any, any];
        if (metadata?.langgraph_node === "model_request") {
          // Extract text content from the token
          const text =
            typeof token.content === "string"
              ? token.content
              : token.contentBlocks
              ? (token.contentBlocks as any[])
                  .filter((b: any) => b.type === "text")
                  .map((b: any) => b.text ?? "")
                  .join("")
              : "";

          if (text) {
            fullResponse += text;
            writeSSE("chunk", { text });
          }
        }
      }

      if (mode === "updates") {
        const entries = Object.entries(chunk as object);
        if (entries.length > 0) {
          const [step] = entries[0] as [string, any];
          if (step === "tools") {
            writeSSE("tool_call", { status: "running" });

            // Check if a booking was created in this tool step
            const toolMessages = (entries[0][1] as any)?.messages ?? [];
            for (const msg of toolMessages) {
              const content =
                typeof msg.content === "string" ? msg.content : msg.kwargs?.content;
              if (typeof content === "string" && content.includes("bookingId")) {
                try {
                  const parsed = JSON.parse(content);
                  if (parsed.bookingId) {
                    bookingCreated = true;
                    bookingId = parsed.bookingId;
                  }
                } catch {
                  // not a booking result
                }
              }
            }
          }
        }
      }
    }

    // Persist assistant response to ChatMessage table (for frontend display + voice handoff)
    let assistantMessageId: string | null = null;
    if (fullResponse) {
      const assistantMessage = await prisma.chatMessage.create({
        data: { sessionId, role: "assistant", content: fullResponse },
      });
      assistantMessageId = assistantMessage.id;
    }

    let bookingData: object | null = null;
    if (bookingCreated && bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { provider: true, slot: true },
      });
      if (booking) {
        bookingData = booking;
      }
    }

    logger.info("Agent stream finished", { sessionId, responseLength: fullResponse.length, bookingCreated, assistantMessageId });

    writeSSE("done", {
      messageId: assistantMessageId,
      bookingCreated,
      booking: bookingData,
    });
  } catch (err: any) {
    logger.error("Agent stream error", { sessionId, error: err.message, stack: err.stack });
    writeSSE("error", { message: "Something went wrong. Please try again." });
  }
}
