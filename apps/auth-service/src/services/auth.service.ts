import { PasswordResetToken, Prisma, RevocationReason, User } from "@prisma/client";
import { UserRepository } from "../repo/user.repository.js";
import bcrypt from "bcrypt"
import { SessionRepository } from "../repo/session.repository.js";
import { TokenFamilRepository } from "../repo/TokenFamily.repostory.js";
import { TokenService } from "./token.service.js";
import { RefreshTokenRepository } from "../repo/refresh.reposories.js";
import {createHash, randomBytes} from "node:crypto"
import { PassowrdResetRepo } from "../repo/PasswordResetrep.js";
import prisma from "../config/prisma.js";
import { AppError } from "../utils/apperror.js";
import { logger } from "../config/logger.js";
import { LoginResponseDto, RegisterResponseDto, toAuthUserRespone } from "../DTO/auth.response.dto.js";

export class AuthService{
    
    constructor(
        private userepo:UserRepository,
        private sessionrepo:SessionRepository,
        private tokenfamily:TokenFamilRepository,
        private Tokenservice:TokenService,
        private refreshtoken:RefreshTokenRepository,
        private passwordReset:PassowrdResetRepo,
        private db = prisma



        //--------some roration function
    ){}
    
    //------------register----------------//
    
async register(data: {
  email: string;
  password: string;
  name: string;
}): Promise<RegisterResponseDto> {
  const email = data.email.trim().toLowerCase();

  const existingUser = await this.userepo.findByEmail(email);

  if (existingUser) {
    throw new AppError("Email already registered", {
      statusCode: 409,
      code: "EMAIL_ALREADY_EXISTS",
    });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await this.userepo.create({
    email,
    passwordHash,
    name: data.name,
  });
  
  logger.info({
    event: "auth.registered",
    userId: user.id,
  });
  const userDTO = toAuthUserRespone(user)
  

  return {
    user: userDTO
  };
}



    //----------login-------//
    
async login(data: {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  location?: string;
}): Promise<LoginResponseDto> {
  const email = data.email.trim().toLowerCase();
  const user = await this.userepo.findByEmail(email);

  if (!user) {
    throw new AppError("Invalid credentials", {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  }

  const passwordValid = await bcrypt.compare(
    data.password,
    user.passwordHash
  );

  if (!passwordValid) {
    await this.sessionrepo.createLoginHisotry({
      userId: user.id,
      success: false,
      method: "password",
      ipAddress: data.ipAddress ?? "unknown",
      userAgent: data.userAgent ?? "unknown",
      deviceType: data.deviceType ?? "unknown",
      location: data.location ?? "unknown",
      failureReason: "INVALID_CREDENTIALS",
    });

    throw new AppError("Invalid credentials", {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  }

  if (
    user.status !== "ACTIVE" ||
    user.deletedAt !== null
  ) {
    throw new AppError("Account is not active", {
      statusCode: 403,
      code: "ACCOUNT_NOT_ACTIVE",
    });
  }

  const sessionExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  // We generate the actual tokens after the session is created.
  const result = await this.db.$transaction(async (tx) => {
    const session = await this.sessionrepo.create(
      {
        userId: user.id,
        expiresAt: sessionExpiresAt,
        ipAddress: data.ipAddress ?? "unknown",
        userAgent: data.userAgent ?? "unknown",
        deviceType: data.deviceType ?? "unknown",
        location: data.location ?? "unknown",
      },
      tx
    );

    const family = await this.tokenfamily.create(
      session.id,
      tx
    );

    const accessToken = this.Tokenservice.generateAccessToken(
      user.id,
      session.id,
      user.role,
      user.tokenVersion
    );

    const refreshToken = this.Tokenservice.generateRefreshToken(
      user.id,
      session.id,
      family.id
    );

    const refreshTokenHash = this.hashToken(refreshToken);

    await this.refreshtoken.create(
      {
        userId: user.id,
        sessionId: session.id,
        familyId: family.id,
        tokenHash: refreshTokenHash,
        expiresAt: sessionExpiresAt,
         tx
      },
     
    );

    await this.userepo.updateLastLogin(user.id, tx);

    await this.sessionrepo.createLoginHisotry(
      {
        userId: user.id,
        success: true,
        method: "password",
        ipAddress: data.ipAddress ?? "unknown",
        userAgent: data.userAgent ?? "unknown",
        deviceType: data.deviceType ?? "unknown",
        location: data.location ?? "unknown",
      },
      tx
    );

    return {
      sessionId: session.id,
      accessToken,
      refreshToken,
    };
  });

  logger.info({
    event: "auth.login_succeeded",
    userId: user.id,
    sessionId: result.sessionId,
  });

  return {
    user: toAuthUserRespone(user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    sessionId: result.sessionId,
  };
}



    //----LOGOUT--------//
    
async logout(sessionId: string, userId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
        const session = await tx.userSession.findFirst({
            where: {
                id: sessionId,
                userId,
                revokedAt:null,
                isValid: true,
                expiresAt: { gt: new Date() },
            },
        });

        if (!session) {
            throw new AppError("Invalid session", {
                statusCode: 401,
                code: "INVALID_SESSION",
            });
        }

        const family = await tx.tokenFamily.findUnique({
            where: { sessionId },
        });

        const now = new Date();

        await tx.userSession.update({
            where: { id: sessionId },
            data: {
                isValid: false,
                revokedAt: now,
                revokedReason: RevocationReason.LOGOUT,
            },
        });

        if (family) {
            await tx.tokenFamily.updateMany({
                where: {
                    id: family.id,
                    revokedAt: null,
                },
                data: {
                    revokedAt: now,
                    revokedReason: RevocationReason.LOGOUT,
                },
            });

            await tx.refreshToken.updateMany({
                where: {
                    familyId: family.id,
                    revokedAt: null,
                },
                data: {
                    revokedAt: now,
                },
            });
        }
    });

    logger.info({
        event: "auth.logout_succeeded",
        userId,
        sessionId,
    });
}



       // ----AUTHENTICATED USER----//
    //  async getAuthenticataeduser(userId:string):Promise<User|null>{
    //     return this.userepo.findById(userId)
    //  }

     //-----refresh token rotation
    private hashToken(token:string):string{
        return createHash("sha256").update(token).digest("hex")
    }
    
async rotate(refreshToken: string) {
    const payload = this.Tokenservice.verifyRefreshToken(refreshToken);

    const tokenHash = this.hashToken(refreshToken);

    const storedToken =
        await this.refreshtoken.findByTokenHash(tokenHash);

    if (!storedToken) {
        throw new AppError("Invalid refresh token", {
            statusCode: 401,
            code: "INVALID_REFRESH_TOKEN",
        });
    }

    if (
        storedToken.userId !== payload.sub ||
        storedToken.sessionId !== payload.sessionId ||
        storedToken.familyId !== payload.familyId
    ) {
        throw new AppError("Invalid refresh token", {
            statusCode: 401,
            code: "INVALID_REFRESH_TOKEN",
        });
    }

    if (storedToken.revokedAt) {
        await this.tokenfamily.revoke(
            storedToken.familyId,
            RevocationReason.TOKEN_REUSE,
        );

        await this.refreshtoken.revokeFamilyTokens(
            storedToken.familyId,
            RevocationReason.TOKEN_REUSE
        );

        throw new AppError("Refresh token reuse detected", {
            statusCode: 401,
            code: "REFRESH_TOKEN_REUSE",
        });
    }

    if (storedToken.expiresAt <= new Date()) {
        throw new AppError("Refresh token expired", {
            statusCode: 401,
            code: "REFRESH_TOKEN_EXPIRED",
        });
    }

    const familyRevoked = await this.tokenfamily.isRevoked(
        storedToken.familyId,
    );

    if (familyRevoked) {
        throw new AppError("Token family revoked", {
            statusCode: 401,
            code: "TOKEN_FAMILY_REVOKED",
        });
    }

    const session = await this.sessionrepo.findValidById(
        payload.sessionId,
    );

    if (
        !session ||
        session.userId !== payload.sub ||
        !session.user ||
        session.user.status !== "ACTIVE" ||
        session.user.deletedAt !== null
    ) {
        throw new AppError("Invalid session", {
            statusCode: 401,
            code: "INVALID_SESSION",
        });
    }

    const newRefreshToken =
        this.Tokenservice.generateRefreshToken(
            payload.sub,
            payload.sessionId,
            payload.familyId,
        );

    const newTokenHash = this.hashToken(newRefreshToken);

    const rotated = await this.refreshtoken.rotate(
        {
            id: storedToken.id,
            familyId: payload.familyId,
        },
        {
            userId: payload.sub,
            sessionId: payload.sessionId,
            familyId: payload.familyId,
            tokenHash: newTokenHash,
            expiresAt: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
            ),
        },
    );

    if (!rotated) {
        // A concurrent request may have consumed the same token.
        await this.tokenfamily.revoke(
            payload.familyId,
            RevocationReason.TOKEN_REUSE,
        );

        await this.refreshtoken.revokeFamilyTokens(
            payload.familyId,
            RevocationReason.TOKEN_REUSE
        );

        throw new AppError("Refresh token already used", {
            statusCode: 401,
            code: "REFRESH_TOKEN_REUSE",
        });
    }

    const newAccessToken =
        this.Tokenservice.generateAccessToken(
            payload.sub,
            payload.sessionId,
            session.user.role,
            session.user.tokenVersion,
        );

    logger.info({
        event: "auth.refresh_succeeded",
        userId: payload.sub,
        sessionId: payload.sessionId,
    });

    return {
        refreshToken: newRefreshToken,
        accessToken: newAccessToken,
    };
}




// forget and reset password part 

async forgetPassword(email:string):Promise<String>{
    const user = await this.userepo.findByEmail(email)
    if(!user){
        logger.warn({ event: "auth.password_reset_rejected", reason: "user_not_found" });
        throw new Error("User Not Found With This Email")
    }
    const token = randomBytes(32).toString("hex")
    console.log(token)
    const tokenHash = createHash("sha256").update(token).digest("hex")
    
    
    await this.passwordReset.create({
        userId:user.id,
        tokenHash,
        expiresAt:new Date(Date.now() + 15 *60*1000)
    })
    logger.info({ event: "auth.password_reset_requested", userId: user.id });
    console.log("This is the reset token " , token)
    return "Reset token will send to your email"// this only work in the develompmet phase when we ganna build the front end we will see
}
// resetPassword token part

async resetPassword(
    token: string,
    newPassword: string,
): Promise<void> {
    const tokenHash = this.hashToken(token);
    const resetToken =
        await this.passwordReset.findValidByTokenHash(tokenHash);

    if (!resetToken) {
        throw new AppError("Invalid or expired reset token", {
            statusCode: 400,
            code: "INVALID_RESET_TOKEN",
        });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.db.$transaction(async (tx) => {
        const consumed = await this.passwordReset.consume(
            resetToken.id,
            tx,
        );

        if (!consumed) {
            throw new AppError("Invalid or expired reset token", {
                statusCode: 400,
                code: "INVALID_RESET_TOKEN",
            });
        }

        await tx.user.update({
            where: { id: resetToken.userId },
            data: {
                passwordHash,
                tokenVersion: { increment: 1 },
            },
        });

        await tx.userSession.updateMany({
            where: {
                userId: resetToken.userId,
                isValid: true,
            },
            data: {
                isValid: false,
                revokedAt: new Date(),
                revokedReason: RevocationReason.PASSWORD_CHANGED,
            },
        });

        const families = await tx.tokenFamily.findMany({
            where: {
                session: {
                    userId: resetToken.userId,
                },
                revokedAt: null,
            },
            select: { id: true },
        });

        const familyIds = families.map((family) => family.id);

        if (familyIds.length > 0) {
            await tx.tokenFamily.updateMany({
                where: {
                    id: { in: familyIds },
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                    revokedReason: RevocationReason.PASSWORD_CHANGED,
                },
            });

            await tx.refreshToken.updateMany({
                where: {
                    familyId: { in: familyIds },
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                },
            });
        }
    });

    logger.info({
        event: "auth.password_reset_succeeded",
        userId: resetToken.userId,
    });
}

async changePassword(userId:string , currentPassword:string , newPassword:string):Promise<void>{
    const user = await this.userepo.findById(userId)
    if(!user){
        logger.warn({ event: "auth.password_change_rejected", reason: "user_not_found", userId });
        throw new Error("User Not Found")
    }
    const isPasswordValid = await bcrypt.compare(currentPassword , user.passwordHash)
    if(!isPasswordValid){
        logger.warn({ event: "auth.password_change_rejected", reason: "current_password_invalid", userId });
        throw new Error("current Password isn't correct")
    }
    const isSamePassowrd = await bcrypt.compare(newPassword , user.passwordHash)
    if(isSamePassowrd){
        throw new AppError("New Password must be diffrent")
    }

    const hashPassword = await bcrypt.hash(newPassword , 10)
       await this.db.$transaction(async (tx) => {
    const now = new Date();

    await tx.user.update({
        where: { id: userId },
        data: {
            passwordHash: hashPassword,
            tokenVersion: { increment: 1 },
        },
    });

    const sessions = await tx.userSession.findMany({
        where: { userId },
        select: { id: true },
    });

    const sessionIds = sessions.map((session) => session.id);

    if (sessionIds.length === 0) {
        return;
    }

    await tx.userSession.updateMany({
        where: {
            id: { in: sessionIds },
            isValid: true,
        },
        data: {
            isValid: false,
            revokedAt: now,
            revokedReason: RevocationReason.PASSWORD_CHANGED,
        },
    });

    await tx.tokenFamily.updateMany({
        where: {
            sessionId: { in: sessionIds },
            revokedAt: null,
        },
        data: {
            revokedAt: now,
            revokedReason: RevocationReason.PASSWORD_CHANGED,
        },
    });

    await tx.refreshToken.updateMany({
        where: {
            sessionId: { in: sessionIds },
            revokedAt: null,
        },
        data: {
            revokedAt: now,
        },
    });
});


    logger.info({ event: "auth.password_changed", userId });
}
async getActiveSessions(userId:string){
    return this.sessionrepo.findAtiveByuserId(userId)
}
async revokeSession(sessionId:string , userId:string){
    const session = await this.sessionrepo.findByIdAndUserId(sessionId , userId)
    if(!session){
        throw new AppError("Session not found")
    }
    const family = await this.tokenfamily.findBySessionId(session.id)
    if(!family){
        throw new AppError("Family Not Found")
    }
    await this.db.$transaction(async(tx)=>{
        await tx.userSession.update({
                where:{
                id:sessionId,
            },
            data:{
                isValid:false,
                revokedAt:new Date(),
                revokedReason:RevocationReason.LOGOUT
            }
        })
        await tx.tokenFamily.update({
            where:{id:family.id},
            data:{
                revokedAt:new Date(),
                revokedReason:RevocationReason.LOGOUT
            }
        })
        await tx.refreshToken.updateMany({
            where:{familyId:family.id , revokedAt:null},
            
            data:{
                revokedAt:new Date()
            }
        })
    })
    logger.info({ event: "auth.session_revoked", userId, sessionId });
    return {message:"Session revoked successfully"}
}


}
        
    

     



