import prisma from "../config/prisma.js";
import { TokenFamily , RevocationReason } from "@prisma/client";
export class TokenFamilRepository{
    constructor(private db = prisma){}

    async create(sessionId : string):Promise<TokenFamily>{
       return this.db.tokenFamily.create({
            data:{sessionId}
        })
    }
    async findBySessionId(sessionId:string):Promise<TokenFamily | null>{
        return this.db.tokenFamily.findUnique({
            where:{sessionId}
        })
    }
    async findById(id:string):Promise<TokenFamily | null>{
        return this.db.tokenFamily.findUnique({
            where:{id}
        })
    }
    async revoke(
        familyId : string,
        reason : RevocationReason
    ):Promise<TokenFamily>{
        return this.db.tokenFamily.update({
            where:{
                id:familyId
            },
            data:{
                revokedAt:new Date(),
                revokedReason : reason
            }
        })
    }
    async isRevoked(familyId:string):Promise<boolean>{
        const family = await this.db.tokenFamily.findUnique({
            where:{
                id:familyId
            },
            select:{
                revokedAt:true
            }
        })
        return !family || family.revokedAt!==null  // this make the family does't exisist
    }
    
}