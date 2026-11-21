
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../utils/apperror.js";

interface AccessTokenPayload {
  sub: string;
  sessionId: string;
  tokenVersion: number;
  role: UserRole;
  tokenType: "access";
}

interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  familyId: string;
  tokenType: "refresh";
}

export class TokenService {
  generateAccessToken(
    userId: string,
    sessionId: string,
    role: UserRole,
    tokenVersion: number
  ): string {
    return jwt.sign(
      {
        sessionId,
        tokenVersion,
        role,
        tokenType: "access",
      },
      env.JWT_ACCESS_SECRET,
      {
        subject: userId,
        expiresIn: "15m",
      }
    );
  }

  generateRefreshToken(
    userId: string,
    sessionId: string,
    familyId: string
  ): string {
    return jwt.sign(
      {
        sessionId,
        familyId,
        tokenType: "refresh",
      },
      env.JWT_REFRESH_SECRET,
      {
        subject: userId,
        expiresIn: "7d",
      }
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET
    );

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.sessionId !== "string" ||
      typeof decoded.tokenVersion !== "number" ||
      typeof decoded.role !== "string" ||
      !Object.values(UserRole).includes(
        decoded.role as UserRole
      ) ||
      decoded.tokenType !== "access"
    ) {
      throw new AppError("Invalid access token", {
        statusCode: 401,
        code: "INVALID_ACCESS_TOKEN",
      });
    }

    return decoded as AccessTokenPayload;
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    const decoded = jwt.verify(
      token,
      env.JWT_REFRESH_SECRET
    );

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.sessionId !== "string" ||
      typeof decoded.familyId !== "string" ||
      decoded.tokenType !== "refresh"
    ) {
      throw new AppError("Invalid refresh token", {
        statusCode: 401,
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    return decoded as RefreshTokenPayload;
  }
}


