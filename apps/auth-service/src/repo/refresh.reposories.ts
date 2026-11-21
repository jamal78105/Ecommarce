import { DefaultArgs } from "@prisma/client/runtime/library";
import prisma from "../config/prisma.js";
import { Prisma, PrismaClient, RefreshToken, RevocationReason } from "@prisma/client";
export class RefreshTokenRepository{
    constructor(private db = prisma){}
    async create(data: {
    userId: string;
    sessionId: string;
    familyId: string;
    expiresAt: Date;
    tokenHash: string;
    tx?: Prisma.TransactionClient;
},):Promise<RefreshToken>{
        const db = data.tx??this.db
        return db.refreshToken.create({
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
    async revokeFamilyTokens(familyId:string , reason:RevocationReason):Promise<void>{
       await this.db.$transaction(async(tx)=>{
        const now = new Date()
        await tx.tokenFamily.updateMany({
            where:{
                id:familyId,
                revokedAt:null
            },
            data:{
                revokedAt:now,
                revokedReason:reason
            }
            
            
        })
        await tx.refreshToken.updateMany({
            where:{
                familyId,
                revokedAt:null
            },
            data:{
                revokedAt:now
            }
        })

       })
    }
  
    //---------------fixing
    async rotate(
    oldToken: {
        id: string;
        familyId: string;
    },
    newToken: {
        userId: string;
        sessionId: string;
        familyId: string;
        tokenHash: string;
        expiresAt: Date;
    },
): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
        const now = new Date();

        const family = await tx.tokenFamily.findFirst({
            where: {
                id: oldToken.familyId,
                revokedAt: null,
                session: {
                    isValid: true,
                    revokedAt: null,
                    expiresAt: { gt: now },
                    user: {
                        status: "ACTIVE",
                        deletedAt: null,
                    },
                },
            },
        });

        if (!family) {
            return false;
        }

        const consumed = await tx.refreshToken.updateMany({
            where: {
                id: oldToken.id,
                familyId: oldToken.familyId,
                revokedAt: null,
                expiresAt: { gt: now },
            },
            data: {
                revokedAt: now,
            },
        });

        if (consumed.count !== 1) {
            return false;
        }

        await tx.refreshToken.create({
            data: {
                userId: newToken.userId,
                sessionId: newToken.sessionId,
                familyId: newToken.familyId,
                tokenHash: newToken.tokenHash,
                expiresAt: newToken.expiresAt,
            },
        });

        return true;
    });
}


     
      
    

}