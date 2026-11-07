import prisma from "../config/prisma.js";
import { LoginHistory, RevocationReason, User, UserSession } from "@prisma/client";

export class SessionRepository{
    // or im ganna use the singleton instance
    constructor(private db = prisma){}

    async create(data:{
        userId : string,
        expiresAt : Date,
        ipAddress? : string,
        userAgent?:string,
        deviceType?:string,
        location? : string
    }):Promise<UserSession>{
        return this.db.userSession.create({
            data:{
                userId : data.userId,
                expiresAt : data.expiresAt,
                ipAddress : data.ipAddress?? null, // incase the ipaddres = undfine change it into null
                userAgent : data.userAgent?? null,
                deviceType : data.deviceType??null,
                location : data.location?? null
            }
        })
    }
    async findValidById(id:string){
        return this.db.userSession.findFirst({
            where:{id , isValid:true,expiresAt:{gt:new Date()}},
            include:{user:true}
        })
    }
    async revoke(
        sessionId : string,
        resonson : RevocationReason
    ):Promise<UserSession>{
        return this.db.userSession.update
        ({
            where:{
                id : sessionId
            },
            data:{
                isValid:false,
                revokedAt : new Date(),
                revokedReason : resonson
            }
        })
    }

    async findById(id : string):Promise<UserSession | null >{
        return this.db.userSession.findUnique({
            where : {id}
        })
    }
    async revokeAllForUser(userId : string):Promise<void>{
        await this.db.userSession.updateMany({
            where:{userId,isValid:true},
            data:{
                isValid : false,
                revokedAt : new Date(),
                revokedReason : RevocationReason.LOGOUT_ALL
            }
        })
    }
    async updateLastUsed(sessionId:string):Promise<UserSession>{
        return this.db.userSession.update({
            where:{
                id : sessionId
            },
            data:{
                lastUsedAt : new Date()
            }
        })
    }
    async createLoginHisotry(data:{
        userId : string,
        success : boolean,
        method : string,
        ipAddress : string,
        userAgent?:string,
        deviceType?:string,
        location?:string,
        failureReason?:string
    }):Promise<LoginHistory>{
        return this.db.loginHistory.create({data})
    }

    async findAtiveByuserId(userId:string){
        return this.db.userSession.findMany({
            where:{
                userId,
                isValid:true,
                revokedAt:null,
                expiresAt:{
                    gt:new Date() //to get the unended session
                }
                
            },
            select:{
                id:true,
                ipAddress:true,
                userAgent:true,
                deviceType:true,
                location:true,
                createdAt:true,
                lastUsedAt:true,
                expiresAt:true
            },
            orderBy:{
                lastUsedAt:"desc"
            }
        })
    }
    async findByIdAndUserId(sessionId:string , userId:string){
        return this.db.userSession.findFirst({
            where:{
                id:sessionId,
                userId,
                isValid:true,
                expiresAt:{
                    gt:new Date()
                }
            }
        })
    }
}