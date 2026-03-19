import { z } from "zod";

export const signUpSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .regex(/^[A-Za-z\s]+$/, "Name can only contain letters and spaces"),

  email: z
    .string({ error: "Email is required" })
    .email("Invalid email address"),

  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters long"),

  inviteCode: z
    .string({ error: "Invite code is required" })
    .min(1, "Invite code cannot be empty"),

  callbackURL: z
    .string({ error: "Invalid callback URL" })
    .min(1)
    .includes("/")
    .optional(),
});

// Type inference for convenience
export type SignUpInput = z.infer<typeof signUpSchema>;
