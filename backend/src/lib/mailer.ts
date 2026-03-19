import nodemailer from "nodemailer";
import { getLogger } from "../config/logger";

const logger = getLogger("Mailer");

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT ?? "465", 10),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP connection at startup so misconfiguration is caught immediately
transporter.verify((err) => {
  if (err) {
    logger.error("SMTP connection failed", {
      error: err.message,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER,
    });
  } else {
    logger.info("SMTP connection verified", {
      smtpHost: process.env.SMTP_HOST,
      smtpUser: process.env.SMTP_USER,
    });
  }
});
