
import { z } from "zod";

const emailSchema = z
    .string()
    .trim()
    .email()
    .transform((email) => email.toLowerCase());

const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters");

export const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
});

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
});

export const resetPasswordSchema = z.object({
    resetToken: z.string().min(1),
    newPassword: passwordSchema,
});

export const forgetPasswordSchema = z.object({
    email: emailSchema,
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});


