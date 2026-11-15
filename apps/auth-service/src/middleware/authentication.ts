
import type { RequestHandler } from "express";
import { TokenService } from "../services/token.service.js";
import { SessionRepository } from "../repo/session.repository.js";
import { logger } from "../config/logger.js";

const tokenService = new TokenService();
const sessionRepository = new SessionRepository();

export const authenticate: RequestHandler = async (req, res, next) => {
    const authorization = req.headers.authorization;
if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Authentication required",
    });
    return;
  }

   const token = authorization.slice(7).trim()


    try {
        const payload = tokenService.verifyAccessToken(token);
        const session = await sessionRepository.findValidById(
            payload.sessionId,
        );

        if (
            !session ||
            session.userId !== payload.sub ||
            !session.user
        ) {
            res.status(401).json({
                message: "Invalid or expired session",
            });
            return;
        }

        const user = session.user;

        if (
            user.status !== "ACTIVE" ||
            user.deletedAt !== null
        ) {
            res.status(401).json({
                message: "Invalid or inactive account",
            });
            return;
        }

        if (user.tokenVersion !== payload.tokenVersion) {
            res.status(401).json({
                message: "Access token revoked",
            });
            return;
        }

        req.user = {
            userId: user.id,
            email: user.email,
            sessionId: session.id,
            tokenVersion: user.tokenVersion,
            role: user.role,
        };

        logger.info({
            event: "auth.succeeded",
            method: req.method,
            path: req.path,
        });

        next();
    } catch (error) {
        if (
            error instanceof Error &&
            (
                error.name === "JsonWebTokenError" ||
                error.name === "TokenExpiredError"

            )
        ) {
            res.status(401).json({
                message: "Invalid or expired access token",
            });
            return;
        }

        logger.error({
            event: "auth.middleware_failed",
            err: error,
            method: req.method,
            path: req.path,
        });

        next(error);
    }
};

