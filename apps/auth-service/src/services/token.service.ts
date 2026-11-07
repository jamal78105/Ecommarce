
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserRole } from "@prisma/client";

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
  // ACCESS TOKEN
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
        tokenType: "access"
      },
      env.JWT_ACCESS_SECRET,
      {
        subject: userId,
        expiresIn: "15m"
      }
    );
  }

  // REFRESH TOKEN
  generateRefreshToken(
    userId: string,
    sessionId: string,
    familyId: string
  ): string {
    return jwt.sign(
      {
        sessionId,
        familyId,
        tokenType: "refresh"
      },
      env.JWT_REFRESH_SECRET,
      {
        subject: userId,
        expiresIn: "7d"
      }
    );
  }

  // VERIFY ACCESS TOKEN
  verifyAccessToken(token: string): AccessTokenPayload {
    const decode = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (
      typeof decode === "string" ||
      typeof decode.sub !== "string" ||
      typeof decode.sessionId !== "string" ||
      typeof decode.tokenVersion !== "number" ||
      typeof decode.role !== "string" ||
      !Object.values(UserRole).includes(decode.role as UserRole) ||
      decode.tokenType !== "access"
    ) {
      throw new Error("Invalid access token");
    }

    return decode as AccessTokenPayload;
  }

  // VERIFY REFRESH TOKEN
  verifyRefreshToken(token: string): RefreshTokenPayload {
    const decode = jwt.verify(token, env.JWT_REFRESH_SECRET);

    if (
      typeof decode === "string" ||
      typeof decode.sub !== "string" ||
      typeof decode.sessionId !== "string" ||
      typeof decode.familyId !== "string" ||
      decode.tokenType !== "refresh"
    ) {
      throw new Error("Invalid refresh token");
    }

    return decode as RefreshTokenPayload;
  }
}


