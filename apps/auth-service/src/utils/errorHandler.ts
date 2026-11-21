
import type {
  Request,
  Response,
  NextFunction,
} from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "./apperror.js";
import { logger } from "../config/logger.js";

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred";

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError
  ) {
    if (error.code === "P2002") {
      statusCode = 409;
      code = "UNIQUE_CONSTRAINT_VIOLATION";
      message = "Resource already exists";
    } else if (error.code === "P2025") {
      statusCode = 404;
      code = "RECORD_NOT_FOUND";
      message = "Requested resource was not found";
    }
  }

  if (statusCode >= 500) {
    logger.error({
      event: "http.request_failed",
      err: error,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn({
      event: "http.request_rejected",
      code,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: code,
    message,
  });
}

