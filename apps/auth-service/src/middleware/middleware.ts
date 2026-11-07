import { RequestHandler } from "express";
import type { ZodType } from "zod";
import { logger } from "../config/logger.js";

export function validation(schema: ZodType, target: "body" | "query" | "params" = "body"): RequestHandler {
    return (req, res, next) => {
        const result = schema.safeParse(req[target])
        console.log(`This what inside the result ${result}`)
        if (!result.success) {
            logger.warn({ event: "request.validation_failed", method: req.method, path: req.path, target, issueCount: result.error.issues.length });
            return res.status(400).json({
                message: "VALDIATION FAILED",
                errors: result.error.flatten()
            })
        }
        req[target] = result.data
        next()
    }
}