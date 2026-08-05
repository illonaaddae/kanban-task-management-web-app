import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string("Name is required")
    .trim()
    .min(1, "Name is required")
    .max(80, "Name cannot exceed 80 characters"),
  email: z.email("Must be a valid email address"),
  password: z
    .string("Password is required")
    .min(8, "Password must be at least 8 characters"),
});

/**
 * Login checks presence only — no email format check.
 *
 * Format-validating here would answer a malformed email with 400 and an
 * unknown-but-valid one with 401, which hands an attacker a cheap way to tell
 * the two apart. Every failure past this point is a generic 401.
 */
export const loginSchema = z.object({
  email: z.string("Email is required").trim().min(1, "Email is required"),
  password: z.string("Password is required").min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string("Refresh token is required").min(1, "Refresh token is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
