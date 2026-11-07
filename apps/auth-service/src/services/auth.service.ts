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
    async logout(sessionId:string, userId:string){
        const session= await this.sessionrepo.findValidById(sessionId)
        if(!session || session.userId !==userId){
            logger.warn({ event: "auth.logout_rejected", reason: "session_invalid", userId, sessionId });
            throw new Error("Invalid session")
        }
      
        await this.sessionrepo.revoke(sessionId , RevocationReason.LOGOUT)
        const family = await this.tokenfamily.findBySessionId(sessionId)
        if(!family){
            return
        }
        await this.tokenfamily.revoke(family.id , RevocationReason.LOGOUT)
        await this.refreshtoken.revokeFamilyTokens(family.id) 
        logger.info({ event: "auth.logout_succeeded", userId, sessionId });
        
    }
       // ----AUTHENTICATED USER----//
    //  async getAuthenticataeduser(userId:string):Promise<User|null>{
    //     return this.userepo.findById(userId)
    //  }

     //-----refresh token rotation
    private hashToken(token:string):string{
        return createHash("sha256").update(token).digest("hex")
    }
    async rotate(refreshToken:string){
        const payload = this.Tokenservice.verifyRefreshToken(refreshToken)
        const tokenhash = this.hashToken(refreshToken)
        const storedToken = await this.refreshtoken.findByTokenHash(tokenhash)
        console.log("THIS IS WHAT INSIDE THE REFRESH TOKEN :->",storedToken)  // im facing problem in this line witch is null refresh token
        if(!storedToken){
            logger.warn({ event: "auth.refresh_rejected", reason: "token_not_found" });
            throw new Error("Invalid refresh token")
        }
       
        if(
            storedToken.userId !==payload.sub ||
            storedToken.sessionId!==payload.sessionId||
            storedToken.familyId !== payload.familyId
        ){
            logger.warn({ event: "auth.refresh_rejected", reason: "token_claim_mismatch" });
            throw new Error("Invalid refresh token")
        }
        if(storedToken.revokedAt){
            logger.warn({ event: "auth.refresh_rejected", reason: "token_reuse_detected", userId: payload.sub, sessionId: payload.sessionId });
            await this.tokenfamily.revoke(storedToken.familyId , RevocationReason.TOKEN_REUSE)
            await this.refreshtoken.revokeFamilyTokens(storedToken!.familyId)
        }
        if(storedToken.expiresAt <=new Date() ){
            logger.warn({ event: "auth.refresh_rejected", reason: "token_expired", userId: payload.sub, sessionId: payload.sessionId });
            throw new Error("Refresh token is expired or revoked")
             
        }
         const session =
      await this.sessionrepo.findValidById(
        payload.sessionId,
      );

    if (!session || session.userId !== payload.sub) {
            logger.warn({ event: "auth.refresh_rejected", reason: "session_invalid", userId: payload.sub, sessionId: payload.sessionId });
      throw new Error("Invalid session");
    }

    // this the new line iadd it
      //const updateUser = await this.userepo.incrementTokenVersion(payload.sub)

    const newRefreshToken =
      this.Tokenservice.generateRefreshToken(
        payload.sub,
        payload.sessionId,
        payload.familyId,
      );
   

    const newTokenHash = this.hashToken(newRefreshToken);

    const rotated =
      await this.refreshtoken.rotate(
        { // old data
          id: storedToken.id,
          familyId: payload.familyId,
        },
        { // new data
          userId: payload.sub,
          sessionId: payload.sessionId, 
          familyId: payload.familyId,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      );

    if (!rotated) {
            logger.warn({ event: "auth.refresh_rejected", reason: "token_already_used", userId: payload.sub, sessionId: payload.sessionId });
      throw new Error("Refresh token has already been used");
    }
     const newAcessToken =
      this.Tokenservice.generateAccessToken(
        payload.sub,
        payload.sessionId,
        session.user.role,
        session.user.tokenVersion
        
      );

        logger.info({ event: "auth.refresh_succeeded", userId: payload.sub, sessionId: payload.sessionId });
    return { refreshToken: newRefreshToken , accessToken:newAcessToken };
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
    return token // this only work in the develompmet phase when we ganna build the front end we will see
}
// resetPassword token part
async resetPassword(token:string , newPassword:string):Promise<void>{
   try {
     const tokenHash = createHash("sha256").update(token).digest("hex")
    const resetToken = await this.passwordReset.findValidByTokenHash(tokenHash)
    if(!resetToken || resetToken.expiresAt <= new Date()){
        throw new Error("Invalid or expired password reset token")
    }
    await this.db.$transaction(async(tx:Prisma.TransactionClient)=>{

        const consume = await this.passwordReset.consume(resetToken.id , tx)
        if(!consume){
            throw new Error("Invalid or expired password reset token")
        }
        const hasedpassword = await bcrypt.hash(newPassword , 10)
        await tx.user.update({
            where:{
                id:resetToken.userId
            },
            data:{
                passwordHash:hasedpassword,
                tokenVersion:{increment:1}
            }
        })
    })
    logger.info({ event: "auth.password_reset_succeeded", userId: resetToken.userId });
    
   } catch (error) {
    console.error("Error in resetPassword transaction:" , error)
    throw error
   }
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
        
    

     



