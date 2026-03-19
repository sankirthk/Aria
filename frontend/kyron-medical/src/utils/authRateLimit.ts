import { showToast } from "./toastService";

const RATE_LIMIT_STATUS = 429;
const DEFAULT_RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";

export const notifyAuthRateLimit = (
  source: unknown,
  message = DEFAULT_RATE_LIMIT_MESSAGE
): boolean => {
  const status = extractStatusCode(source);

  if (status !== RATE_LIMIT_STATUS) {
    return false;
  }

  showToast(message, "error");
  return true;
};

const extractStatusCode = (
  source: unknown,
  visited = new WeakSet<object>()
): number | undefined => {
  if (typeof source === "number") {
    return source;
  }

  if (!source || typeof source !== "object") {
    return undefined;
  }

  const typedSource = source as Record<string, unknown>;

  if (visited.has(typedSource)) {
    return undefined;
  }

  visited.add(typedSource);

  const statusCandidate = typedSource["status"];
  if (typeof statusCandidate === "number") {
    return statusCandidate;
  }

  const statusCodeCandidate = typedSource["statusCode"];
  if (typeof statusCodeCandidate === "number") {
    return statusCodeCandidate;
  }

  const nestedKeys = ["response", "cause", "error", "originalError", "request"];

  for (const key of nestedKeys) {
    const nested = typedSource[key];
    const nestedStatus = extractStatusCode(nested, visited);
    if (typeof nestedStatus === "number") {
      return nestedStatus;
    }
  }

  return undefined;
};
