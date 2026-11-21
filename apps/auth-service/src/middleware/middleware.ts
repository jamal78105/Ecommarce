
import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { logger } from "../config/logger.js";

export function validation(
  schema: ZodType,
  target: "body" | "query" | "params" = "body"
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      logger.warn({
        event: "request.validation_failed",
        method: req.method,
        path: req.path,
        target,
        issueCount: result.error.issues.length,
      });

      res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Request validation failed",
        errors: result.error.flatten(),
      });
      return;
    }

    req[target] = result.data;
    next();
  };
}


