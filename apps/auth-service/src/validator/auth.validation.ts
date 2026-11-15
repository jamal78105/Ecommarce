import z, { email } from "zod";

export const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    
    email: z
        .string()
        .trim()
        .email()
        .transform((email) => email.toLowerCase()),

    password: z
        .string()
        .min(8, "Password must  be at least 8 characters")
        .max(128 , "Password must not exceed 128 characters"),
});

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .email()
        .transform((email) => email.toLowerCase()),

    password: z
        .string()
        .min(1)
        .max(128),
});