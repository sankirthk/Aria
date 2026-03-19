import { createHmac } from "crypto";
import { FIELD_ENCRYPTION_KEY } from "../config/env";

/**
 * Deterministic HMAC-SHA256 hash of a phone number.
 * Used to store a searchable token alongside the encrypted phone field
 * so inbound call lookups work without decrypting every row.
 *
 * Always hash the normalized (E.164) form so webhook lookups match
 * values written by the agent / patient controller.
 */
export function hashPhone(normalizedPhone: string): string {
  return createHmac("sha256", FIELD_ENCRYPTION_KEY).update(normalizedPhone).digest("hex");
}
