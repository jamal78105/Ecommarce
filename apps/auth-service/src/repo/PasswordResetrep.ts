import { Prisma } from "@prisma/client/extension";
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
        tokenId:string,
        tx:Prisma.TransactionClient=this.db // its like an atomic opration either the opration work togerhter or it fall all the opration
     ){
       const reuslt = await tx.passwordResetToken.updateMany({
            where:{
                id:tokenId,
               usedAt:null,
                expiresAt:{gt:new Date()}
            },
            data:{
                usedAt: new Date()
            }
        })
        return reuslt.count === 1 // that mean its used and incase the user press tow time chose the first one and to avoid the racecondation

     }
}