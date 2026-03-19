import { z } from "zod";

export const bookAppointmentSchema = z.object({
  slotId: z
    .string({ error: "slotId is required" })
    .min(1, "slotId cannot be empty"),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
