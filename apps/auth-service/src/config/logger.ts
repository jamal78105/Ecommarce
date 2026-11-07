import pino from "pino";
import { env } from "./env.js";

const isProduction = env.NODE_ENV === "production"
export const logger = pino({
    level:isProduction?"info":"debug",
    redact:{
        paths:[
            "password",
            "*.password",
            "accessToken",
            "refreshToken",
            "*.accessToken",
            "*.refreshToken",
            "token",
            "*.token",
            "authorization",
            "headers.cookie",
            "req.headers.authorization",
            "req.headers.cookie",
            "cookie",
            "secret"
        ],
        censor:"[REDACTED]"
    },
    ...(isProduction
        ?{}
        :{
            transport:{
                target:"pino-pretty",
                options:{
                    colorize:true,
                    translateTime:"SYS:standard",
                ignore:"pid,hostname"
                }
            }
        }
    )
})