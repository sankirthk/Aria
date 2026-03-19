import type { ApiResponse } from "../types/agentTypes";

const appendUniqueMessage = (messages: Set<string>, value?: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) {
    messages.add(value.trim());
  }
};

export const resolveApiErrorMessage = (
  response?: ApiResponse<unknown> | null
): string | undefined => {
  if (!response) return undefined;

  const messages = new Set<string>();

  appendUniqueMessage(messages, response.message);
  appendUniqueMessage(messages, response.error);

  const { details } = response;
  if (Array.isArray(details)) {
    details.forEach((item) => appendUniqueMessage(messages, item));
  } else if (details && typeof details === "object") {
    Object.entries(details).forEach(([field, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item === null || item === undefined) return;
          appendUniqueMessage(messages, `${field}: ${String(item)}`);
        });
      } else if (value !== null && value !== undefined) {
        appendUniqueMessage(messages, `${field}: ${String(value)}`);
      }
    });
  } else {
    appendUniqueMessage(messages, details);
  }

  if (messages.size === 0) return undefined;
  return Array.from(messages).join(" ");
};
