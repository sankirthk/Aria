import { NextFunction, Request, Response } from "express";
import { getLogger } from "../config/logger";

const logger = getLogger("SignupRateLimit");
const WINDOW_MS = 10_000;
const MAX_REQUESTS = 3;

type SignupWindow = {
  count: number;
  resetAt: number;
};

const windows = new Map<string, SignupWindow>();

const getClientIp = (req: Request) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  const cloudflareIp = req.headers["cf-connecting-ip"];
  if (typeof cloudflareIp === "string" && cloudflareIp.trim()) {
    return cloudflareIp.trim();
  }

  return req.ip || "unknown";
};

export const signupRateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const now = Date.now();
  const clientIp = getClientIp(req);
  const currentWindow = windows.get(clientIp);

  if (!currentWindow || currentWindow.resetAt <= now) {
    windows.set(clientIp, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (currentWindow.count >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((currentWindow.resetAt - now) / 1000),
    );

    logger.warn("Signup rate limit exceeded", {
      clientIp,
      retryAfterSeconds,
      path: req.originalUrl,
    });

    res.setHeader("Retry-After", retryAfterSeconds.toString());
    return res.status(429).json({
      error: "Too many signup attempts. Please try again shortly.",
    });
  }

  currentWindow.count += 1;
  windows.set(clientIp, currentWindow);
  return next();
};
