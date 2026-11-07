import "dotenv/config"
import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
// this one from the docks 
const envSchema = z.object({
   NODE_ENV: z.enum(['development', 'production', 'test']).default("development"),
   PORT:z.coerce.number(),
   DATABASE_URL: z.string(),
   JWT_ACCESS_SECRET:z.string().min(32),
   JWT_REFRESH_SECRET: z.string().min(32),
})

export const env = envSchema.parse(process.env);// take the tow parameter for the .env file 