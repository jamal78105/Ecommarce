
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),

    PORT: z.coerce
        .number()
        .int()
        .min(1)
        .max(65535)
        .default(3001),

    DATABASE_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(32),

    JWT_REFRESH_SECRET: z.string().min(32),

    REDIS_URL : z.string().url()
});

export const env = envSchema.parse(process.env);




