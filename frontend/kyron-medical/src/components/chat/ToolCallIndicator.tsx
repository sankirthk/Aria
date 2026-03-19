import type { FC } from "react";

interface ToolCallIndicatorProps {
  label?: string;
}

const ToolCallIndicator: FC<ToolCallIndicatorProps> = ({
  label = "Checking availability...",
}) => {
  return (
    <div className="chat-panel__tool-status" role="status">
      <span className="chat-panel__tool-pulse" />
      <span>{label}</span>
    </div>
  );
};

export default ToolCallIndicator;
