import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "../../generated/prisma";
import { sendVerificationEmail } from "./emailVerification";
import { getLogger } from "../../config/logger";
import { env } from "../../config/env";

const logger = getLogger("AuthService");
const trustedOrigins = env.ALLOWED_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url, false);
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) =>
      sendVerificationEmail(user.email, url),
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,   // 7 days
    updateAge: 60 * 60 * 24,        // refresh expiry daily
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true, // enable even in dev if you want
    window: 60, // time window in seconds
    max: 10, // max requests per IP in that window
    storage: "database", // persist limits in Postgres
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-up/email": { window: 10, max: 3 },
    },
  },
  // if you’re behind Cloudflare / Nginx / Render etc.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "cf-connecting-ip"],
    },
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins,
  logger: {
    log: (level, message, ...args) => {
      if (level === "info") {
        logger.info(message, args);
      }
      if (level === "warn") {
        logger.warn(message, args);
      }
      if (level === "error") {
        logger.error(message, args);
      }
      if (level === "debug") {
        logger.debug(message, args);
      }
    },
  },
});
