import { transporter } from "../mailer";
import { getLogger } from "../../config/logger";

const logger = getLogger("EmailVerification");

export async function sendVerificationEmail(
  to: string,
  url: string,
  verification: boolean = true
) {
  const type = verification ? "verification" : "password-reset";
  logger.info(`Sending ${type} email`, { to, smtpUser: process.env.SMTP_USER });

  const header = `
    <div style="background:#0A1628;padding:24px 32px;border-radius:12px 12px 0 0">
      <h1 style="color:#ffffff;margin:0;font-size:20px">Westside Medical Group</h1>
    </div>
  `;

  const footer = `
    <div style="background:#e2e8f0;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center">
      <p style="color:#64748b;font-size:12px;margin:0">
        © Westside Medical Group · 123 Westside Blvd, Suite 400, Los Angeles, CA 90025
      </p>
    </div>
  `;

  let mailOptions;
  if (verification) {
    mailOptions = {
      from: `"Westside Medical Group" <${process.env.SMTP_USER}>`,
      to,
      subject: "Verify your email address — Westside Medical Group",
      html: `
        <div style="font-family:sans-serif;line-height:1.6;max-width:560px;margin:0 auto;color:#1a1a2e">
          ${header}
          <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none">
            <h2 style="color:#0A1628;margin-top:0">Verify your email address</h2>
            <p>Welcome to Westside Medical Group! Click the button below to verify your email address and activate your account.</p>
            <div style="margin:28px 0">
              <a href="${url}"
                 style="background:#2563EB;color:#ffffff;padding:12px 28px;border-radius:8px;
                        text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
                Verify Email
              </a>
            </div>
            <p style="color:#64748b;font-size:14px">
              This link will expire shortly. If you didn’t create an account with Westside Medical Group, you can safely ignore this email.
            </p>
          </div>
          ${footer}
        </div>
      `,
    };
  } else {
    mailOptions = {
      from: `"Westside Medical Group" <${process.env.SMTP_USER}>`,
      to,
      subject: "Reset your password — Westside Medical Group",
      html: `
        <div style="font-family:sans-serif;line-height:1.6;max-width:560px;margin:0 auto;color:#1a1a2e">
          ${header}
          <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none">
            <h2 style="color:#0A1628;margin-top:0">Reset your password</h2>
            <p>We received a request to reset your Westside Medical Group account password. Click the button below to choose a new one.</p>
            <div style="margin:28px 0">
              <a href="${url}"
                 style="background:#2563EB;color:#ffffff;padding:12px 28px;border-radius:8px;
                        text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
                Reset Password
              </a>
            </div>
            <p style="color:#64748b;font-size:14px">
              This link will expire shortly. If you didn’t request a password reset, you can safely ignore this email.
            </p>
          </div>
          ${footer}
        </div>
      `,
    };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`${type} email sent`, { to, messageId: info.messageId });
  } catch (err) {
    logger.error(`Failed to send ${type} email`, {
      to,
      error: err instanceof Error ? err.message : String(err),
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER,
    });
    throw err;
  }
}
