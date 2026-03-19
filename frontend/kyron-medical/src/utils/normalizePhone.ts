/** Strips formatting and prepends +1 for US numbers, mirroring backend util */
export const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  // Already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // 10-digit US number — prepend +1
  if (digits.length === 10) return `+1${digits}`;
  // International or other — just ensure leading +
  return raw.startsWith("+") ? raw : `+${digits}`;
};
