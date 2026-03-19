import { z } from "zod";

export const getSlotsQuerySchema = z.object({
  dayOfWeek: z
    .enum(["monday", "tuesday", "wednesday", "thursday", "friday"])
    .optional(),

  timeOfDay: z
    .enum(["morning", "afternoon"])
    .optional(),

  limit: z
    .string()
    .regex(/^\d+$/, "limit must be a positive integer")
    .transform(Number)
    .optional(),
});

export type GetSlotsQuery = z.infer<typeof getSlotsQuerySchema>;
