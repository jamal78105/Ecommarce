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
    async register(data:{
        email:string ,
         password:string , 
         name:string
    }):Promise<User>{
        const email = data.email.trim().toLocaleLowerCase()
        const exsitinguser = await this.userepo.findByEmail(email) // if we forget the await it will say to you this function will always return ture so lets not forget the await key word 
        if(exsitinguser){
            logger.warn({ event: "auth.registration_rejected", reason: "email_already_registered" });
            throw new AppError("User Already exsist with this name " ,{statusCode:404})
        }
        const passwordHash = await bcrypt.hash(data.password,12) 
        const user = await this.userepo.create({
            email,
            passwordHash,
             name:data.name
        })
        logger.info({ event: "auth.registered", userId: user.id });
        return user
       
    }
    //----------login-------//
    async login(data:{
        email:string,
        password:string,
        ipAddress?:string,
        userAgent?:string,
        deviceType?:string,
        location?:string
    }){
        const email = data.email.trim().toLowerCase()
        const user = await this.userepo.findByEmail(email)
        if(!user){
            logger.warn({ event: "auth.login_failed", reason: "user_not_found" });
            throw new Error("INVALID_CREDENTIALS")
        }
        const passwordValid = await bcrypt.compare(data.password,user.passwordHash)
        if(!passwordValid){
            logger.warn({ event: "auth.login_failed", reason: "invalid_credentials", userId: user.id });
            await this.sessionrepo.createLoginHisotry({
                userId:user.id,
                success:false,
                method:"password",
                ipAddress:data.ipAddress??"unknown",
                userAgent:data.userAgent??"unknown",
                deviceType:data.deviceType??"unknown",
                location:data.location??"unknown",
                failureReason:"INVALID CREDENTIALS"

            })
            throw new AppError("INVALID_CREDENTIALS")
        }
        if(user.status !== "ACTIVE"){
            logger.warn({ event: "auth.login_failed", reason: "account_inactive", userId: user.id });
            throw new Error("Account not active")
        }
        // ---CREATE SESSION---//
        const sessionExpire = new Date(Date.now()+7*24*60*60*1000)
        const sessoin = await this.sessionrepo.create({
            userId:user.id,
            expiresAt:sessionExpire,
            ipAddress:data.ipAddress??"unknown",
            userAgent:data.userAgent??"unknown",
            deviceType:data.deviceType??"unknown",
            location:data.location??"unknown",
        })
        //------ CREATE TOKEN FAMILY------//
        const family = await this.tokenfamily.create(sessoin.id)

        //----------CRATE ACCESS TOKEN-------//
        const accesstoken =  this.Tokenservice.generateAccessToken(
            user.id,
            sessoin.id,
            user.role,
            user.tokenVersion,
        )
          
        //----------CREATE REFRESH TOKEN-------------//
        const refreshtoken =  this.Tokenservice.generateRefreshToken(
            user.id,
            sessoin.id,
            family.id
        )
        //--- Hash the refreshtoken
        // const refreshTokenHash = await bcrypt.hash(refreshtoken , 10)
          const refreshTokenHash = createHash("sha256").update(refreshtoken).digest("hex")
        //--------store refreshtoken--------//
        const refreshTokenExpiresAt = new Date(
            Date.now() + 7*24*60*60*1000
        )
        await this.refreshtoken.create({
            userId:user.id,
            familyId:family.id,
            expiresAt:refreshTokenExpiresAt,
            tokenHash : refreshTokenHash,
            sessionId:sessoin.id
        })
        //-----UPDATE LAST LOGIN-----//
        await this.userepo.updateLastLogin(user.id)
        // ---LOGIN HISTORY----
          await this.sessionrepo.createLoginHisotry({
                userId:user.id,
                success:true,
                method:"password",
                ipAddress:data.ipAddress??"unknown",
                userAgent:data.userAgent??"unknown",
                deviceType:data.deviceType??"unknown",
                location:data.location??"unknown",

            })
        logger.info({ event: "auth.login_succeeded", userId: user.id, sessionId: sessoin.id });
        return {
            user, // iwant to stop this to see what will happen {user}
            accesstoken,
            refreshtoken,
            sessionId:sessoin.id
        }
    }
    //----LOGOUT--------//
    
async logout(sessionId: string, userId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
        const session = await tx.userSession.findFirst({
            where: {
                id: sessionId,
                userId,
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
        await this.db.user.update({
            where:{id:userId},
            data:{
             passwordHash:hashPassword,
             tokenVersion:{
                increment:1
             }
            }
        })
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
        
    

     



