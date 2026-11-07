
import type { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { logger } from "../config/logger.js";
export const authorize = (...allowedRoles: UserRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn({ event: "authorization.rejected", reason: "user_missing", method: req.method, path: req.path });
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({ event: "authorization.rejected", reason: "role_not_allowed", method: req.method, path: req.path, role: req.user.role });
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }

    next();
  };
};
