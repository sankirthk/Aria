import { useEffect, useRef, useState, type FC, type FormEvent, type KeyboardEvent } from "react";
import { MessageSquareText, PhoneCall, SendHorizontal, History, X, MessageSquare, SquarePen, Trash2 } from "lucide-react";
import gsap from "gsap";
import {
  createSession,
  getActiveSession,
  getSessions,
  getSessionById,
  deleteSession,
  initiateHandoff,
  sendMessage,
  type ChatMessage,
  type SessionPreview,
} from "../../api/chat";
import type { Booking } from "../../api/appointments";
import { showToast } from "../../utils/toastService";
import ChatMessageBubble, { type RenderChatMessage } from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ToolCallIndicator from "./ToolCallIndicator";
import QuickCallModal from "../dashboard/QuickCallModal";

interface ChatPanelProps {
  onNewBooking?: (booking: Booking) => void;
  profileComplete?: boolean;
}

const createLocalMessage = (
  role: ChatMessage["role"],
  content: string,
  pending = false
): RenderChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sessionId: "local",
  role,
  content,
  toolName: null,
  createdAt: new Date().toISOString(),
  pending,
});

const isBooking = (value: unknown): value is Booking => {
  if (!value || typeof value !== "object") return false;
  const booking = value as Partial<Booking>;
  return Boolean(
    booking.id &&
      booking.providerId &&
      booking.slotId &&
      booking.provider?.name &&
      booking.provider?.specialty &&
      booking.slot?.startTime &&
      booking.slot?.endTime
  );
};

const ChatPanel: FC<ChatPanelProps> = ({ onNewBooking, profileComplete = true }) => {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<RenderChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [showQuickCall, setShowQuickCall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [waitingForFirstChunk, setWaitingForFirstChunk] = useState(false);

  // History drawer
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<SessionPreview[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const callButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      setLoading(true);
      setError(null);

      // Resume existing active session (or create one if none exists)
      const response = await getActiveSession();
      if (cancelled) return;

      if (response.success && response.data) {
        setSessionId(response.data.id);
        setMessages(response.data.messages);
      } else if (!response.success) {
        setError(response.error ?? "Failed to load chat.");
      }
      // response.success && !response.data = no prior session, fresh start (sessionId stays "")

      setLoading(false);
    };

    void initSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, streaming, toolStatus]);

  useEffect(() => {
    if (!callButtonRef.current) return;

    const tween = gsap.to(callButtonRef.current, {
      scale: 1.05,
      duration: 1.2,
      ease: "power1.inOut",
      repeat: -1,
      yoyo: true,
    });

    return () => {
      tween.kill();
      if (callButtonRef.current) {
        gsap.set(callButtonRef.current, { clearProps: "transform" });
      }
    };
  }, []);

  const finalizePendingAssistant = (assistantId: string, fallbackText?: string) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== assistantId) return message;

        return {
          ...message,
          content: message.content || fallbackText || message.content,
          pending: false,
        };
      })
    );
  };

  const appendAssistantChunk = (assistantId: string, text: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              content: `${message.content}${text}`,
              pending: false,
            }
          : message
      )
    );
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const content = draft.trim();
    if (!content || streaming) return;

    // Lazy creation: only create a session when the first message is sent
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const created = await createSession();
      if (!created.success || !created.data) {
        showToast(created.error ?? "Failed to start chat.", "error");
        return;
      }
      activeSessionId = created.data.id;
      setSessionId(activeSessionId);
    }

    const userMessage = createLocalMessage("user", content);
    const assistantMessage = createLocalMessage("assistant", "", true);

    setDraft("");
    setError(null);
    setToolStatus(null);
    setWaitingForFirstChunk(true);
    setStreaming(true);
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      for await (const event of sendMessage(activeSessionId, content)) {
        if (event.event === "chunk") {
          setWaitingForFirstChunk(false);
          appendAssistantChunk(assistantMessage.id, event.data.text);
          continue;
        }

        if (event.event === "tool_call") {
          setToolStatus("Checking availability and updating your request…");
          continue;
        }

        if (event.event === "error") {
          throw new Error(event.data.message);
        }

        if (event.event === "done") {
          setWaitingForFirstChunk(false);
          setToolStatus(null);
          finalizePendingAssistant(assistantMessage.id);

          if (event.data.messageId) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, id: event.data.messageId, pending: false }
                  : message
              )
            );
          }

          if (event.data.bookingCreated && isBooking(event.data.booking)) {
            onNewBooking?.(event.data.booking);
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send message.";
      setError(message);
      setWaitingForFirstChunk(false);
      setToolStatus(null);
      finalizePendingAssistant(
        assistantMessage.id,
        "I ran into an issue finishing that request. Please try again."
      );
      showToast(message, "error");
    } finally {
      setStreaming(false);
    }
  };

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const handleHandoff = async () => {
    if (!sessionId || handoffLoading) return;

    // If profile is incomplete, collect name + phone via quick-call modal
    if (!profileComplete) {
      setShowQuickCall(true);
      return;
    }

    setHandoffLoading(true);
    const response = await initiateHandoff(sessionId);
    setHandoffLoading(false);

    if (response.success && response.data) {
      showToast(`Calling ${response.data.phone} now.`, "success");
      return;
    }

    showToast(response.error ?? "Failed to initiate call.", "error");
  };

  const handleQuickCall = async (phone: string, name: string) => {
    setHandoffLoading(true);
    const response = await initiateHandoff(sessionId, { phone, name });
    setHandoffLoading(false);
    setShowQuickCall(false);

    if (response.success && response.data) {
      showToast(`Calling ${response.data.phone} now.`, "success");
      return;
    }

    showToast(response.error ?? "Failed to initiate call.", "error");
  };

  const handleNewChat = () => {
    setShowHistory(false);
    setSessionId("");
    setMessages([]);
    setDraft("");
    setError(null);
    setToolStatus(null);
  };

  const openHistory = async () => {
    setShowHistory(true);
    setSessionsLoading(true);
    const result = await getSessions();
    if (result.success && result.data) {
      // Ensure newest-first regardless of server ordering
      const sorted = [...result.data].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setSessions(sorted);
    }
    setSessionsLoading(false);
  };

  const handleDeleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await deleteSession(sid);
    if (!result.success) {
      showToast(result.error ?? "Failed to delete chat.", "error");
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== sid));
    if (sid === sessionId) {
      setSessionId("");
      setMessages([]);
      setError(null);
    }
  };

  const loadPastSession = async (sid: string) => {
    setLoading(true);
    setShowHistory(false);
    const result = await getSessionById(sid);
    if (result.success && result.data) {
      setSessionId(result.data.id);
      setMessages(result.data.messages);
    }
    setLoading(false);
  };

  const formatSessionDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <>
    <section className="chat-panel glass">
      <div className="chat-panel__header">
        <div className="chat-panel__header-copy">
          <div className="chat-panel__title-row">
            <MessageSquareText size={18} />
            <h2 className="chat-panel__title">Chat With Aria</h2>
          </div>
          <p className="chat-panel__subtitle">Scheduling, refills, and practice questions.</p>
        </div>

        <div className="chat-panel__header-actions">
          <div className="chat-panel__history-wrapper">
            <button
              type="button"
              className="chat-panel__icon-button"
              onClick={() => void handleNewChat()}
              aria-label="New chat"
              disabled={streaming}
            >
              <SquarePen size={16} />
            </button>
            <span className="chat-panel__icon-tooltip">New Chat</span>
          </div>

          <div className="chat-panel__history-wrapper">
            <button
              type="button"
              className="chat-panel__icon-button"
              onClick={openHistory}
              aria-label="Chat history"
            >
              <History size={16} />
            </button>
            <span className="chat-panel__icon-tooltip">History</span>
          </div>

          <button
            ref={callButtonRef}
            type="button"
            className="chat-panel__call-button"
            onClick={handleHandoff}
            disabled={handoffLoading || !sessionId}
          >
            <PhoneCall size={16} />
            <span>{handoffLoading ? "Calling…" : "Call Me"}</span>
          </button>
        </div>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="chat-panel__history-drawer">
          <div className="chat-panel__history-header">
            <span className="chat-panel__history-title">Past Chats</span>
            <button
              type="button"
              className="chat-panel__icon-button"
              onClick={() => setShowHistory(false)}
              aria-label="Close history"
            >
              <X size={16} />
            </button>
          </div>
          <div className="chat-panel__history-list">
            {sessionsLoading && (
              <div className="chat-panel__history-state">Loading…</div>
            )}
            {!sessionsLoading && sessions.length === 0 && (
              <div className="chat-panel__history-state">No past chats.</div>
            )}
            {!sessionsLoading && sessions.map((s) => {
              const preview = s.messages[0]?.content ?? "No messages yet";
              const isActive = s.id === sessionId;
              return (
                <div
                  key={s.id}
                  className={`chat-panel__history-item${isActive ? " chat-panel__history-item--active" : ""}`}
                  onClick={() => !isActive && void loadPastSession(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && !isActive && void loadPastSession(s.id)}
                >
                  <div className="chat-panel__history-item-header">
                    <MessageSquare size={13} />
                    <span className="chat-panel__history-item-date">{formatSessionDate(s.createdAt)}</span>
                    {isActive && <span className="chat-panel__history-item-badge">Current</span>}
                    <button
                      type="button"
                      className="chat-panel__history-item-delete"
                      onClick={(e) => void handleDeleteSession(s.id, e)}
                      aria-label="Delete chat"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="chat-panel__history-item-preview">{preview}</p>
                  <span className="chat-panel__history-item-count">{s._count.messages} messages</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="chat-panel__messages" ref={messagesRef} aria-live="polite">
        {loading && <div className="chat-panel__state">Loading conversation…</div>}

        {!loading && error && messages.length === 0 && (
          <div className="chat-panel__state chat-panel__state--error">{error}</div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="chat-panel__empty">
            Start the conversation and Aria will help with appointments or practice logistics.
          </div>
        )}

        {!loading &&
          messages
            .filter((message) => !(message.role === "assistant" && message.pending && !message.content))
            .map((message) => <ChatMessageBubble key={message.id} message={message} />)}

        {waitingForFirstChunk && <TypingIndicator />}
        {toolStatus && <ToolCallIndicator label={toolStatus} />}
      </div>

      <form className="chat-panel__composer" onSubmit={(event) => void handleSubmit(event)}>
        <textarea
          className="chat-panel__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Tell Aria what you need help with…"
          rows={3}
          disabled={streaming || loading}
        />
        <div className="chat-panel__send-wrapper">
          <button
            type="submit"
            className="chat-panel__send-button"
            disabled={streaming || loading || !draft.trim()}
            aria-label="Send"
          >
            <SendHorizontal size={16} />
          </button>
          <span className="chat-panel__send-tooltip">{streaming ? "Sending…" : "Send"}</span>
        </div>
      </form>
    </section>

    {showQuickCall && (
      <QuickCallModal
        onCall={handleQuickCall}
        onCancel={() => setShowQuickCall(false)}
        loading={handoffLoading}
      />
    )}
    </>
  );
};

export default ChatPanel;
