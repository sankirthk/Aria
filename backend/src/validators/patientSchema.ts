import { z } from "zod";

export const updatePatientSchema = z.object({
  firstName: z
    .string({ error: "First name is required" })
    .trim()
    .min(1, "First name cannot be empty")
    .max(100, "First name is too long"),

  lastName: z
    .string({ error: "Last name is required" })
    .trim()
    .min(1, "Last name cannot be empty")
    .max(100, "Last name is too long"),

  dateOfBirth: z
    .string({ error: "Date of birth is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),

  phone: z
    .string({ error: "Phone number is required" })
    .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format (e.g. +14155550123)"),
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
