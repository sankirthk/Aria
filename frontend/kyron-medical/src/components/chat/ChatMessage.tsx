import { useEffect, useRef, type FC, type ReactNode } from "react";
import gsap from "gsap";
import type { ChatMessage as ApiChatMessage } from "../../api/chat";

export interface RenderChatMessage extends ApiChatMessage {
  pending?: boolean;
}

interface ChatMessageProps {
  message: RenderChatMessage;
}

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

/** Convert markdown text to JSX — handles bold, italic, code, lists, line breaks */
function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Numbered list: "1. item"
    if (/^\d+\.\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^\d+\.\s/, ""))}</li>);
        i++;
      }
      nodes.push(<ol key={`ol-${i}`}>{items}</ol>);
      continue;
    }

    // Bullet list: "- item" or "* item"
    if (/^[-*]\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^[-*]\s/, ""))}</li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`}>{items}</ul>);
      continue;
    }

    // Empty line → spacing
    if (line.trim() === "") {
      nodes.push(<br key={i} />);
      i++;
      continue;
    }

    // Normal paragraph line
    nodes.push(<p key={i}>{renderInline(line)}</p>);
    i++;
  }

  return <>{nodes}</>;
}

const ChatMessage: FC<ChatMessageProps> = ({ message }) => {
  const label = message.role === "assistant" ? "Aria" : "System";
  const messageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!messageRef.current) return;
    gsap.fromTo(
      messageRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" }
    );
  }, []);

  return (
    <article
      ref={messageRef}
      className={`chat-panel__message chat-panel__message--${message.role}`}
    >
      {message.role !== "user" && (
        <span className="chat-panel__message-label">{label}</span>
      )}
      <div
        className={`chat-panel__bubble ${
          message.pending ? "chat-panel__bubble--pending" : ""
        }`}
      >
        {message.role === "assistant"
          ? renderMarkdown(message.content)
          : message.content}
      </div>
    </article>
  );
};

export default ChatMessage;
