import z, { email } from "zod";

export const registerSchema = z.object({
    name:z.string().min(2).max(100),
    email:z.string().trim().email().transform((email)=>email.toLowerCase()),
    password:z.string("password must be at least 8 charecter").min(8).max(8)
})

export const loginSchema = z.object({
    email:z.string().trim().email().transform((email)=>email.toLowerCase()),
    password:z.string().min(1).max(128)
})