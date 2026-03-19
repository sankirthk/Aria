export const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const NODE_ENV = process.env.NODE_ENV ?? "development";
const LOG_LEVEL = process.env.LOG_LEVEL ?? (NODE_ENV === "production" ? "info" : "debug");
const LOG_TO_FILE = (process.env.LOG_TO_FILE ?? "false").toLowerCase() === "true";
const LOG_DIR = process.env.LOG_DIR ?? "./logs";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

export const env = {
  NODE_ENV,
  LOG_LEVEL,
  LOG_TO_FILE,
  LOG_DIR,
  ALLOWED_ORIGIN,
} as const;

export const optionalEnv = {
  VAPI_API_KEY: process.env.VAPI_API_KEY,
  VAPI_PHONE_NUMBER_ID: process.env.VAPI_PHONE_NUMBER_ID,
  VAPI_ASSISTANT_ID: process.env.VAPI_ASSISTANT_ID,
  VAPI_WEBHOOK_SECRET: process.env.VAPI_WEBHOOK_SECRET,
  VAPI_CREDENTIALS_ID: process.env.VAPI_CREDENTIALS_ID,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
} as const;

// Encryption key — required at startup so the server fails fast if missing
export const FIELD_ENCRYPTION_KEY = required("FIELD_ENCRYPTION_KEY");
