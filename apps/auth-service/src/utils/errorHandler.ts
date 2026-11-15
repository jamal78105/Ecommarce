import { Request, Response, NextFunction } from 'express'
import { AppError } from "./apperror.js";
import { logger } from "../config/logger.js";

export function errorHandler(
    err: Error | AppError, // except the tow type
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    const isAppError = err instanceof AppError
    const StatusCode = isAppError ? err.statusCode : 500
    const errrCode = isAppError ? err.code : "INTERNAL_SERVER_ERROR"
    if (StatusCode! >= 500) {
        logger.error({
            message: err.message,
            code: errrCode,
            stack: err.stack,
            path: req.path,
            method: req.method
        })
    }
    else {
    //  (400, 401, 409) The Running Mistake Go As Warning
    logger.warn({
      message: err.message,
      code: errrCode
    });
}
// The Same respone to the user
res.status(StatusCode!).json({
    error: errrCode,
    message: isAppError ? err.message : 'An unexpected error occurred'
})
}
/**
 * 
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

 * 
 * 
 */
