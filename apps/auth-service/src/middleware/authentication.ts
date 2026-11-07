
import type { RequestHandler } from "express";
import { TokenService } from "../services/token.service.js";
import { UserRepository } from "../repo/user.repository.js";

import { SessionRepository } from "../repo/session.repository.js";
import { logger } from "../config/logger.js";

const tokenService = new TokenService();
const userRepository = new UserRepository();
const sessionRepository = new SessionRepository();


export const authenticate: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization;
  // if you want to store in the cookie use this one 
  // const cok = req.cookies.authorization

  if (!authorization?.startsWith("Bearer")) {
    logger.warn({ event: "auth.rejected", reason: "authorization_header_missing", method: req.method, path: req.path });
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authorization.split(" ")[1]// extract the access token
  if (!token) {
    logger.warn({ event: "auth.rejected", reason: "access_token_missing", method: req.method, path: req.path });
    return res.status(401).json("ACCESS TOKEN IS MISSING ")
  }
  let payload

  try {
    payload = tokenService.verifyAccessToken(token);
    console.log(payload)
  } catch {
    logger.warn({ event: "auth.rejected", reason: "access_token_invalid", method: req.method, path: req.path });
    res.status(401).json({ message: "401 Unauthorized" });
    logger.warn("Unauthorized")
    return;
  }

  try {
    const [user, session] = await Promise.all([  // this for preformance porpeses
      userRepository.findById(payload.sub),
      sessionRepository.findById(payload.sessionId)
    ]);

    if (!user || user.status !== "ACTIVE" || user.deletedAt !== null) {
      logger.warn({ event: "auth.rejected", reason: "user_inactive_or_missing", method: req.method, path: req.path });
      res.status(401).json({ message: "Invalid or inactive account" });
      return;
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      logger.warn({ event: "auth.rejected", reason: "token_revoked", method: req.method, path: req.path });
      res.status(401).json({ message: "Access token revoked" });
      return;
    }



    if (!session || session.userId !== user.id) {
      logger.warn({ event: "auth.rejected", reason: "session_invalid_or_expired", method: req.method, path: req.path });
      res.status(401).json({ message: "Invalid or expired session" });
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      sessionId: session.id,
      tokenVersion: user.tokenVersion,
      role: user.role,
    };
    console.log("THIS IS WHAT INSIDE THE REQUST USER :", req.user)
    logger.info({ event: "auth.succeeded", method: req.method, path: req.path });
    //.user = payload

    next();
  } catch (error) {
    next(error);
  }
};