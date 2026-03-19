import type { FC } from "react";

const TypingIndicator: FC = () => {
  return (
    <article className="chat-panel__message chat-panel__message--assistant">
      <span className="chat-panel__message-label">Aria</span>
      <div className="chat-panel__bubble chat-panel__bubble--typing" aria-label="Aria is typing">
        <span className="chat-panel__typing-dot" />
        <span className="chat-panel__typing-dot" />
        <span className="chat-panel__typing-dot" />
      </div>
    </article>
  );
};

export default TypingIndicator;
