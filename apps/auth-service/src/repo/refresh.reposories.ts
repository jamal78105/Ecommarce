import { gt, string } from "zod";
import prisma from "../config/prisma.js";
import { RefreshToken } from "@prisma/client";
export class RefreshTokenRepository{
    constructor(private db = prisma){}
    async create(data:{
        userId:string,
        sessionId:string,
        familyId : string,
        expiresAt : Date,
        tokenHash:string
    }):Promise<RefreshToken>{
        return this.db.refreshToken.create({
            data:{
                familyId:data.familyId,
                userId:data.userId,
                sessionId:data.sessionId,
                expiresAt : data.expiresAt,
                tokenHash:data.tokenHash
            }
        })
    }

    // async findById(
    //     id: string
    // ):Promise<RefreshToken | null >{
    //     return this.db.refreshToken.findUnique({
    //         where:{
    //             id
    //         }
    //     })
    // }

    async findByTokenHash(tokenHash:string):Promise<RefreshToken | null>{
        return this.db.refreshToken.findUnique({
            where:{
                tokenHash 
            }
        })
    }
    async findValidByfamilyId(familyId:string):Promise<RefreshToken| null>{
        return this.db.refreshToken.findFirst({
            where:{familyId , revokedAt:null, expiresAt:{gt:new Date()}},
            orderBy : {createdAt:"desc"}
        })
    } 
    async revoke(tokenId:string):Promise<RefreshToken>{
        return this.db.refreshToken.update({
            where:{
                id:tokenId
            },
            data:{
                revokedAt:new Date()
            }
            
        })
    }
    async revokeFamilyTokens(familyId:string):Promise<void>{
        await this.db.refreshToken.updateMany({
            where:{
                familyId,
                revokedAt:null
            },
            data:{
                revokedAt:new Date()
            }
        })
    }
    // async rotate(
    //      oldToken:{ // storedToken in the Database
    //     id:string,
    //     familyId:string
    //    },
    //    newToken:{
    //     userId:string,
    //     sessionId:string,
    //     familyId:string,
    //     tokenHash:string,
    //     expiresAt:Date
    //    }
    // ):Promise<boolean>{
    //     const result = await this.db.refreshToken.updateMany({
    //         where:{
    //             id:oldToken.id,
    //             familyId:oldToken.familyId,
    //             revokedAt:null,  // while the revokedAt = null
    //             expiresAt:{gt:new Date()}
    //         },
    //         data:{
    //             revokedAt:new Date()
    //         }
            
    //     })
    //     if(result.count !==1){ // that mean is't revoked
    //         return false
    //     }
    //     await this.db.refreshToken.update({
    //         where:{
    //             id:oldToken.id
    //         },
    //         data:{
    //             familyId:newToken.familyId,
    //             tokenHash:newToken.tokenHash,
    //             expiresAt:newToken.expiresAt,
    //             revokedAt:null
    //         }
    //     })
    //     return true
    // }

    //---------------fixing
     async rotate(
         oldToken:{ // storedToken in the Database
        id:string,
        familyId:string
       },
       newToken:{
        userId:string,
        sessionId:string,
        familyId:string,
        tokenHash:string,
        expiresAt:Date
       }
    ):Promise<boolean>{
        return this.db.$transaction(async(tx)=>{
            const result = await tx.refreshToken.updateMany({
                where:{
                    id:oldToken.id,
                    familyId:oldToken.familyId,
                    revokedAt:null,
                    expiresAt:{
                        gt:new Date()
                    }
                },
                data:{
                    revokedAt:new Date()
                }
            })
            if(result.count!==1){
                return false
            }
            await tx.refreshToken.create({
                data:{
                    userId:newToken.userId,
                    sessionId:newToken.sessionId,
                    familyId:newToken.familyId,
                    tokenHash:newToken.tokenHash,
                    expiresAt:newToken.expiresAt
                }
            })
            return true
        })
    }

     
      
    

}