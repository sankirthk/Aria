import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";

const logger = getLogger("SeedSlots");

const SLOT_DURATION_MINUTES = 30;
const CLINIC_OPEN_HOUR = 9;
const CLINIC_CLOSE_HOUR = 17;
const SLOT_TIMES: { hour: number; minute: number }[] = [];

for (let hour = CLINIC_OPEN_HOUR; hour < CLINIC_CLOSE_HOUR; hour += 1) {
  SLOT_TIMES.push({ hour, minute: 0 }, { hour, minute: 30 });
}

/**
 * Create a Date representing a specific clock time in America/Los_Angeles,
 * correctly handling the PST/PDT switch, and return the UTC equivalent.
 * e.g. makeLADateTime(2026, 3 /*April*\/, 17, 9, 0) → 2026-04-17T16:00:00Z (PDT, UTC-7)
 */
function makeLADateTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Use noon UTC as a reference to determine the LA offset for this calendar day
  // (avoids DST edge cases that occur at 2 AM)
  const noonUTC = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const laHourAtNoon = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).formatToParts(noonUTC).find((p) => p.type === "hour")?.value ?? "5"
  );
  // laHourAtNoon - 12 = LA offset (e.g. 5 - 12 = -7 for PDT)
  const laOffsetHours = laHourAtNoon - 12;
  const utcHour = hour - laOffsetHours;
  return new Date(Date.UTC(year, month, day, utcHour, minute, 0));
}

function getWeekdaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const dow = cursor.getDay(); // 0=Sun, 6=Sat
    if (dow >= 1 && dow <= 5) {
      days.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export async function seedSlots() {
  const now = new Date();
  logger.info("Slot seed check started", { now: now.toISOString() });
  const futureAvailable = await prisma.slot.count({
    where: { available: true, startTime: { gt: now } },
  });
  if (futureAvailable > 0) {
    logger.info("Future available slots already exist, skipping", { futureAvailable });
    return;
  }

  logger.info("No future available slots found, seeding new slots");

  const providers = await prisma.provider.findMany({ orderBy: { createdAt: "asc" } });
  if (providers.length === 0) {
    logger.warn("No providers found, skipping slot seeding");
    return;
  }

  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);

  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + 60);
  windowEnd.setHours(23, 59, 59, 999);

  const allWeekdays = getWeekdaysInRange(windowStart, windowEnd);

  const slots: { providerId: string; startTime: Date; endTime: Date; available: boolean }[] = [];

  providers.forEach((provider) => {
    allWeekdays.forEach((day) => {
      SLOT_TIMES.forEach(({ hour, minute }) => {
        const startTime = makeLADateTime(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute);
        const endTime = new Date(startTime.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        slots.push({ providerId: provider.id, startTime, endTime, available: true });
      });
    });
  });

  await prisma.slot.createMany({ data: slots });
  logger.info("Slots seeded", { slotCount: slots.length, providerCount: providers.length });
}
