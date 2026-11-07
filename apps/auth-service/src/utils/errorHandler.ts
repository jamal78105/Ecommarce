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
