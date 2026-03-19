import { Request, Response } from "express";
import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";
import { getSlotsQuerySchema } from "../validators/providerSchema";

const logger = getLogger("ProviderController");

const DAY_OF_WEEK_MAP: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
};

function getLATimeParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    hour: "numeric",
    hour12: false,
  });

  const lookup = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    weekday: lookup.weekday?.toLowerCase() ?? "",
    hour: Number(lookup.hour),
  };
}

export const getProviders = async (_req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { name: "asc" },
    });
    logger.info("Providers fetched", { count: providers.length });
    return res.status(200).json({ success: true, data: providers });
  } catch (err: any) {
    logger.error("Error fetching providers", { error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const getSlots = async (req: Request, res: Response) => {
  const { id: providerId } = req.params;

  const parsed = getSlotsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    logger.warn("getSlots validation failed", { providerId, details: parsed.error.flatten() });
    return res.status(400).json({ success: false, error: "Invalid query params", details: parsed.error.flatten() });
  }

  const { dayOfWeek, timeOfDay, limit } = parsed.data;
  const parsedLimit = limit ?? 10;

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() + 30);
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + 60);

  try {
    const slots = await prisma.slot.findMany({
      where: {
        providerId,
        available: true,
        startTime: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { startTime: "asc" },
    });

    let filtered = slots;

    if (dayOfWeek) {
      const targetDay = DAY_OF_WEEK_MAP[(dayOfWeek as string).toLowerCase()];
      if (targetDay !== undefined) {
        filtered = filtered.filter((s) => {
          const weekday = getLATimeParts(s.startTime).weekday;
          return DAY_OF_WEEK_MAP[weekday] === targetDay;
        });
      }
    }

    if (timeOfDay) {
      filtered = filtered.filter((s) => {
        const hour = getLATimeParts(s.startTime).hour;
        if ((timeOfDay as string).toLowerCase() === "morning") return hour >= 9 && hour < 12;
        if ((timeOfDay as string).toLowerCase() === "afternoon") return hour >= 12 && hour < 17;
        return true;
      });
    }

    const result = filtered.slice(0, parsedLimit);

    logger.info("Slots fetched", { providerId, count: result.length, dayOfWeek, timeOfDay });
    return res.status(200).json({ success: true, data: result, count: result.length });
  } catch (err: any) {
    logger.error("Error fetching slots", { providerId, error: err.message });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};
