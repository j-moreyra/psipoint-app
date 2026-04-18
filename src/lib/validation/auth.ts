import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email");

const strongPassword = z.string().min(8, "At least 8 characters");

// Login accepts any non-empty password — don't block legacy users whose
// passwords predate a stricter rule.
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email,
  password: strongPassword,
});

export const resetRequestSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  password: strongPassword,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
