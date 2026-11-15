import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js"; // this to avoid the connection pool problem 
export class PassowrdResetRepo{
     constructor(private db = prisma){}
     async create(data:{
        userId:string,
        tokenHash : string,
        expiresAt:Date
     }){
        return this.db.passwordResetToken.create({
            data:{
                userId:data.userId,
                tokenHash:data.tokenHash,
                expiresAt:data.expiresAt

            }
        })

     }

     async findValidByTokenHash(tokenHash:string){
        return this.db.passwordResetToken.findFirst({
            where:{
                tokenHash,
                usedAt:null,
                expiresAt:{gt:new Date()}
            }
        })
     }
    async consume(
    tokenId: string,
    tx: Prisma.TransactionClient
): Promise<boolean> {
    const result = await tx.passwordResetToken.updateMany({
        where: {
            id: tokenId,
            usedAt: null,
            expiresAt: {
                gt: new Date(),
            },
        },
        data: {
            usedAt: new Date(),
        },
    });

    return result.count === 1;
}
}