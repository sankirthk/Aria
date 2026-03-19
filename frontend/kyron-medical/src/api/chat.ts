import { axiosClient } from "../clients/axiosClient";
import type { SseDoneEvent } from "./appointments";

// ── Types ────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName: string | null;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface HandoffResponse {
  callId: string;
  phone: string;
  message: string;
}

export type SseChunkEvent   = { event: "chunk";     data: { text: string } };
export type SseToolEvent    = { event: "tool_call"; data: { tool: string; status: string } };
export type SseDonePayload  = { event: "done";      data: SseDoneEvent };
export type SseErrorEvent   = { event: "error";     data: { message: string } };
export type SseStreamEvent  = SseChunkEvent | SseToolEvent | SseDonePayload | SseErrorEvent;

export interface SessionPreview {
  id: string;
  userId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];   // first message only (preview)
  _count: { messages: number };
}

// ── API calls ────────────────────────────────────────────────────

/** POST /chat/session — deactivates existing active session and creates a new one */
export const createSession = async (): Promise<{
  success: boolean;
  data?: ChatSession;
  error?: string;
}> => {
  try {
    const { data } = await axiosClient.post("/chat/session");
    return data;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    return { success: false, error: e.response?.data?.error ?? "Failed to create session." };
  }
};

/** GET /chat/session/active — returns or creates the user's active session */
export const getActiveSession = async (): Promise<{
  success: boolean;
  data?: ChatSession;
  error?: string;
}> => {
  try {
    const { data } = await axiosClient.get("/chat/session/active");
    return data;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    return { success: false, error: e.response?.data?.error ?? "Failed to load chat session." };
  }
};

/** GET /chat/sessions — list all sessions (newest first) */
export const getSessions = async (): Promise<{
  success: boolean;
  data?: SessionPreview[];
  error?: string;
}> => {
  try {
    const { data } = await axiosClient.get("/chat/sessions");
    return data;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    return { success: false, error: e.response?.data?.error ?? "Failed to load sessions." };
  }
};

/** GET /chat/session/:id — load a specific session with all messages */
export const getSessionById = async (sessionId: string): Promise<{
  success: boolean;
  data?: ChatSession;
  error?: string;
}> => {
  try {
    const { data } = await axiosClient.get(`/chat/session/${sessionId}`);
    return data;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    return { success: false, error: e.response?.data?.error ?? "Failed to load session." };
  }
};

/**
 * POST /chat/session/:sessionId/message — SSE stream
 *
 * Yields typed SseStreamEvent objects as they arrive.
 * Uses fetch + ReadableStream because EventSource only supports GET.
 */
export async function* sendMessage(
  sessionId: string,
  content: string
): AsyncGenerator<SseStreamEvent> {
  const baseURL =
    (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:8000/kyron/api/v1";

  const response = await fetch(`${baseURL}/chat/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    credentials: "include",
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // SSE events are separated by blank lines (\n\n).
  // Each event is a series of field:value lines.
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Split on double newline — each segment is one SSE event block
    const blocks = buffer.split("\n\n");
    // Keep the last incomplete block in the buffer
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const lines = block.split("\n");
      let eventType = "message";
      let dataLine = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLine = line.slice(5).trim();
        }
      }

      if (!dataLine) continue;

      try {
        const parsed = JSON.parse(dataLine);
        if (eventType === "chunk") {
          yield { event: "chunk", data: parsed } as SseChunkEvent;
        } else if (eventType === "tool_call") {
          yield { event: "tool_call", data: parsed } as SseToolEvent;
        } else if (eventType === "error") {
          yield { event: "error", data: parsed } as SseErrorEvent;
        } else if (eventType === "done") {
          yield { event: "done", data: parsed } as SseDonePayload;
        }
      } catch {
        // malformed JSON — skip
      }
    }
  }
}

/** DELETE /chat/session/:id — permanently delete a session and all its messages */
export const deleteSession = async (sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { data } = await axiosClient.delete(`/chat/session/${sessionId}`);
    return data;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    return { success: false, error: e.response?.data?.error ?? "Failed to delete session." };
  }
};

/** POST /voice/handoff — initiate outbound Vapi call with chat context */
export const initiateHandoff = async (
  sessionId: string,
  quickCall?: { phone: string; name: string }
): Promise<{ success: boolean; data?: HandoffResponse; error?: string }> => {
  try {
    const { data } = await axiosClient.post("/voice/handoff", { sessionId, quickCall });
    return data;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    return { success: false, error: e.response?.data?.error ?? "Failed to initiate call." };
  }
};
