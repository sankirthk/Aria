import { transporter } from "../lib/mailer";
import { getLogger } from "../config/logger";

const logger = getLogger("EmailService");

export interface BookingEmailParams {
  to: string;
  patientName: string;
  providerName: string;
  specialty: string;
  dateTime: Date;
  address: string;
}

export interface AppointmentStatusEmailParams extends BookingEmailParams {}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  });
}

function bookingEmailTemplate(params: BookingEmailParams): string {
  const { patientName, providerName, specialty, dateTime, address } = params;
  const formatted = formatDateTime(dateTime);

  return `
    <div style="font-family:sans-serif;line-height:1.6;max-width:560px;margin:0 auto;color:#1a1a2e">
      <div style="background:#0A1628;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#ffffff;margin:0;font-size:20px">Westside Medical Group</h1>
        <p style="color:#93c5fd;margin:4px 0 0">Westside Medical Group</p>
      </div>

      <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none">
        <h2 style="color:#0A1628;margin-top:0">Your appointment is confirmed!</h2>
        <p>Hi <strong>${patientName}</strong>,</p>
        <p>We've successfully booked your appointment. Here are the details:</p>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:8px 0;color:#64748b;width:120px">Provider</td>
              <td style="padding:8px 0;font-weight:600">${providerName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b">Specialty</td>
              <td style="padding:8px 0">${specialty}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b">Date &amp; Time</td>
              <td style="padding:8px 0;font-weight:600">${formatted}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b">Location</td>
              <td style="padding:8px 0">${address}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b">Phone</td>
              <td style="padding:8px 0">(310) 555-0100</td>
            </tr>
          </table>
        </div>

        <p style="color:#64748b;font-size:14px">
          Please arrive 10 minutes early. If you need to reschedule, call us at (310) 555-0100
          during office hours: Monday–Friday, 8:00 AM – 6:00 PM.
        </p>
      </div>

      <div style="background:#e2e8f0;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center">
        <p style="color:#64748b;font-size:12px;margin:0">
          © Westside Medical Group · 123 Westside Blvd, Suite 400, Los Angeles, CA 90025
        </p>
      </div>
    </div>
  `;
}

function cancellationEmailTemplate(params: AppointmentStatusEmailParams): string {
  const { patientName, providerName, specialty, dateTime, address } = params;
  const formatted = formatDateTime(dateTime);

  return `
    <div style="font-family:sans-serif;line-height:1.6;max-width:560px;margin:0 auto;color:#1a1a2e">
      <div style="background:#0A1628;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#ffffff;margin:0;font-size:20px">Westside Medical Group</h1>
        <p style="color:#93c5fd;margin:4px 0 0">Westside Medical Group</p>
      </div>
      <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none">
        <h2 style="color:#0A1628;margin-top:0">Your appointment has been cancelled</h2>
        <p>Hi <strong>${patientName}</strong>,</p>
        <p>Your appointment has been cancelled. Here are the cancelled appointment details for your records:</p>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748b;width:120px">Provider</td><td style="padding:8px 0;font-weight:600">${providerName}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Specialty</td><td style="padding:8px 0">${specialty}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Date &amp; Time</td><td style="padding:8px 0;font-weight:600">${formatted}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Location</td><td style="padding:8px 0">${address}</td></tr>
          </table>
        </div>
      </div>
      <div style="background:#e2e8f0;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center">
        <p style="color:#64748b;font-size:12px;margin:0">
          © Westside Medical Group · 123 Westside Blvd, Suite 400, Los Angeles, CA 90025
        </p>
      </div>
    </div>
  `;
}

function rescheduleEmailTemplate(params: AppointmentStatusEmailParams): string {
  const { patientName, providerName, specialty, dateTime, address } = params;
  const formatted = formatDateTime(dateTime);

  return `
    <div style="font-family:sans-serif;line-height:1.6;max-width:560px;margin:0 auto;color:#1a1a2e">
      <div style="background:#0A1628;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#ffffff;margin:0;font-size:20px">Westside Medical Group</h1>
        <p style="color:#93c5fd;margin:4px 0 0">Westside Medical Group</p>
      </div>
      <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none">
        <h2 style="color:#0A1628;margin-top:0">Your appointment has been rescheduled</h2>
        <p>Hi <strong>${patientName}</strong>,</p>
        <p>Your appointment has been successfully rescheduled. Here are the updated details:</p>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748b;width:120px">Provider</td><td style="padding:8px 0;font-weight:600">${providerName}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Specialty</td><td style="padding:8px 0">${specialty}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Date &amp; Time</td><td style="padding:8px 0;font-weight:600">${formatted}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Location</td><td style="padding:8px 0">${address}</td></tr>
          </table>
        </div>
      </div>
      <div style="background:#e2e8f0;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center">
        <p style="color:#64748b;font-size:12px;margin:0">
          © Westside Medical Group · 123 Westside Blvd, Suite 400, Los Angeles, CA 90025
        </p>
      </div>
    </div>
  `;
}

export async function sendBookingConfirmation(params: BookingEmailParams): Promise<void> {
  logger.info("Sending booking confirmation email", { to: params.to, patientName: params.patientName, providerName: params.providerName });
  try {
    const info = await transporter.sendMail({
      from: `"Westside Medical Group" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: "Your appointment is confirmed — Westside Medical Group",
      html: bookingEmailTemplate(params),
    });
    logger.info("Booking confirmation email sent", { to: params.to, messageId: info.messageId });
  } catch (err: any) {
    logger.error("Failed to send booking confirmation email", {
      to: params.to,
      error: err.message,
      smtpHost: process.env.SMTP_HOST,
      smtpUser: process.env.SMTP_USER,
    });
    throw err;
  }
}

export async function sendCancellationConfirmation(params: AppointmentStatusEmailParams): Promise<void> {
  logger.info("Sending cancellation confirmation email", { to: params.to, patientName: params.patientName, providerName: params.providerName });
  try {
    const info = await transporter.sendMail({
      from: `"Westside Medical Group" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: "Your appointment has been cancelled — Westside Medical Group",
      html: cancellationEmailTemplate(params),
    });
    logger.info("Cancellation confirmation email sent", { to: params.to, messageId: info.messageId });
  } catch (err: any) {
    logger.error("Failed to send cancellation confirmation email", {
      to: params.to,
      error: err.message,
      smtpHost: process.env.SMTP_HOST,
      smtpUser: process.env.SMTP_USER,
    });
    throw err;
  }
}

export async function sendRescheduleConfirmation(params: AppointmentStatusEmailParams): Promise<void> {
  logger.info("Sending reschedule confirmation email", { to: params.to, patientName: params.patientName, providerName: params.providerName });
  try {
    const info = await transporter.sendMail({
      from: `"Westside Medical Group" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: "Your appointment has been rescheduled — Westside Medical Group",
      html: rescheduleEmailTemplate(params),
    });
    logger.info("Reschedule confirmation email sent", { to: params.to, messageId: info.messageId });
  } catch (err: any) {
    logger.error("Failed to send reschedule confirmation email", {
      to: params.to,
      error: err.message,
      smtpHost: process.env.SMTP_HOST,
      smtpUser: process.env.SMTP_USER,
    });
    throw err;
  }
}
