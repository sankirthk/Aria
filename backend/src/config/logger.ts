import pino from "pino";
import { join } from "path";
import { env } from "./env";

const systemLogPath = join(env.LOG_DIR, "system.dev.log");

const transport = pino.transport({
  target: "pino-pretty",
  options: {
    colorize: false, // set to true only if writing to terminal
    translateTime: "SYS:standard",
    singleLine: false,
    ignore: "pid,hostname",
    destination: systemLogPath,
    mkdir: true,
  },
});

const logger = pino(
  {
    level: env.LOG_LEVEL || "info",
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ["cookie", "authorization", "token"],
    formatters: {
      level: (label) => ({ level: label }),
      bindings: () => ({}),
      log: (obj) => obj,
    },
  },
  transport
);

type LogLevel = "info" | "warn" | "error" | "debug" | "trace" | "fatal";
type LogFunction = (msg: string, meta?: Record<string, any>) => void;

export const getLogger = (component: string): Record<LogLevel, LogFunction> => {
  const scopedLogger: Partial<Record<LogLevel, LogFunction>> = {};

  for (const level of [
    "info",
    "warn",
    "error",
    "debug",
    "trace",
    "fatal",
  ] as LogLevel[]) {
    scopedLogger[level] = (msg, meta) => {
      if (meta) {
        logger[level]({ component, ...meta }, msg);
      } else {
        logger[level]({ component }, msg);
      }
    };
  }

  return scopedLogger as Record<LogLevel, LogFunction>;
};
