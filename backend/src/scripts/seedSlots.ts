import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";

const logger = getLogger("SeedSlots");

// Each provider gets a distinct set of slot times to vary across the week
const PROVIDER_SLOT_TIMES: Record<number, { hour: number; minute: number }[]> = {
  0: [{ hour: 9, minute: 0 }, { hour: 11, minute: 30 }, { hour: 14, minute: 0 }, { hour: 15, minute: 30 }],
  1: [{ hour: 9, minute: 30 }, { hour: 11, minute: 0 }, { hour: 13, minute: 30 }, { hour: 16, minute: 0 }],
  2: [{ hour: 10, minute: 0 }, { hour: 12, minute: 0 }, { hour: 14, minute: 30 }],
  3: [{ hour: 9, minute: 0 }, { hour: 10, minute: 30 }, { hour: 13, minute: 0 }, { hour: 15, minute: 0 }],
  4: [{ hour: 9, minute: 30 }, { hour: 11, minute: 0 }, { hour: 13, minute: 30 }, { hour: 15, minute: 30 }],
};

// Days per week each provider is available (Mon=1 ... Fri=5), varied per provider
const PROVIDER_DAYS: Record<number, number[]> = {
  0: [1, 3, 5],       // Mon, Wed, Fri
  1: [1, 2, 4],       // Mon, Tue, Thu
  2: [2, 3, 5],       // Tue, Wed, Fri
  3: [1, 3, 4],       // Mon, Wed, Thu
  4: [2, 4, 5],       // Tue, Thu, Fri
};

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
  windowStart.setDate(now.getDate() + 30);

  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + 60);

  const allWeekdays = getWeekdaysInRange(windowStart, windowEnd);

  const slots: { providerId: string; startTime: Date; endTime: Date; available: boolean }[] = [];

  providers.forEach((provider, providerIndex) => {
    const allowedDays = PROVIDER_DAYS[providerIndex] ?? [1, 3, 5];
    const times = PROVIDER_SLOT_TIMES[providerIndex] ?? [{ hour: 9, minute: 0 }];

    const providerDays = allWeekdays.filter((d) => allowedDays.includes(d.getDay()));

    providerDays.forEach((day) => {
      times.forEach(({ hour, minute }) => {
        const startTime = makeLADateTime(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
        slots.push({ providerId: provider.id, startTime, endTime, available: true });
      });
    });
  });

  await prisma.slot.createMany({ data: slots });
  logger.info("Slots seeded", { slotCount: slots.length, providerCount: providers.length });
}
