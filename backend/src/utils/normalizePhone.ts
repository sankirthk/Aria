export const normalizePhone = (raw: string) => {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  // Preserve valid E.164-style inputs that already include a country code.
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  // Common US formats: 4155550123 -> +14155550123, 14155550123 -> +14155550123
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Fallback: treat remaining digits as including country code already.
  return `+${digits}`;
};
