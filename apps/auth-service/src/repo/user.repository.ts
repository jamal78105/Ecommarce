import { UserStatus , User, Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";

export class UserRepository{
    constructor(private db = prisma){}

    async create(data:{
        email : string,
        passwordHash : string,
        name:string
    }):Promise<User>{
        return await this.db.user.create({
            data:{
                email:data.email.trim().toLowerCase(),
                passwordHash:data.passwordHash,
                name : data.name
            }
        })
    }
    async findById(id : string
):Promise<User | null>{
        return await this.db.user.findUnique({
            where:{
                id
            }
        })
    }

    async findByEmail(email : string ):Promise<User | null>{
        return await this.db.user.findUnique({
            where:{
                email:email.trim().toLocaleLowerCase()
            }
        })
    }
    // Ithink we are not ganna need this line so we will move
    // async findActiveByEmail(
    //     email : string
    // ):Promise<User | null>{
    //     return await this.db.user.findFirst({
    //         where:{
    //             email:email.trim().toLocaleLowerCase(),
    //             status:UserStatus.ACTIVE,
    //             deletedAt : null
    //         }
    //     })
//}
    async findDeletedByEmail(
        email : string
    ):Promise<User | null>{
        return await this.db.user.findFirst({
            where:{
                email:email.trim().toLocaleLowerCase(),
   
                status:UserStatus.DELETED,
                deletedAt : {not:null}
            }
        })
    }

    async updateLastLogin(
        userId : string,
        tx?:Prisma.TransactionClient
    ):Promise<User>{
        return await this.db.user.update({
            where:{
                id : userId
            },
            data:{
                lastLoginAt : new Date()
            }
        })
    }
    async incrementTokenVersion(
        userId : string 
    ):Promise<User>{
        return await this.db.user.update({
            where : {
                id : userId
            },
            data:{
                tokenVersion : {
                    increment :1 
                }
            }
        })
    }
    // for now ithink were not using this one 
    // async getTokenVersion(
    //     userId : string
    // ):Promise<number | null>{
    //     const user = await this.db.user.findUnique({
    //         where : {
    //             id : userId
    //         },
    //         select:{
    //             tokenVersion : true
    //         }

    //         })
    //     return user?.tokenVersion ??null
    // }
    async softDelete(userId : string , gracePeriodEnd:Date):Promise<User>{
        return await this.db.user.update({
            where:{id : userId},
            data:{
                deletedAt : new Date(),
                status : UserStatus.DELETED,
                gracePeriodEnd
            }
        })
    }
    async canRestore(userId : string):Promise<boolean>{
        const user = await this.db.user.findUnique({
            where:{
                id:userId
            },
            select:{
                status : true,
                deletedAt:true,
                gracePeriodEnd : true
            }
        })
        if(!user || user.status !==UserStatus.DELETED ||!user.gracePeriodEnd){
            return false
        }
        return new Date()<user.gracePeriodEnd
    }
    async restoreAccount(
        userId : string,
        passwordHash?:string
    ):Promise<User>{
        return this.db.user.update({
            where:{id : userId},
            data:{
                deletedAt : null,
                status:UserStatus.ACTIVE,
                gracePeriodEnd:null,
                restoreCodeHash : null,
                restoreCodeExpiresAt : null,
                restoreCodeUsed : true,
               ...(passwordHash!==undefined?{passwordHash} : {}) // if(passwordHash !== undefined){ return passwordHahs}else{return {}}
            }

        })
    }

    async findExpiredGracePeriod():Promise<User[]>{ // we ganna make this one for the background job
        return this.db.user.findMany({
            where:{
                status : UserStatus.DELETED,
                gracePeriodEnd:{
                    lte: new Date() // to search the name that period of restore account end
                }
            }
        })
    }
    async setRestoreCode(data:{
        userId : string,
        codeHash : string,
        expiresAt : Date
    }):Promise<User>{
        return this.db.user.update({
            where:{
                id: data.userId
            },
            data:{
                 restoreCodeHash:data.codeHash,
                restoreCodeExpiresAt:data.expiresAt,
                restoreCodeUsed : false
            }
        })
    }
    

}

/**
 * async updatePasswordAndIncrementTokenVersion(userId:string , passwordHash:string , tx:Prisam.TrnascationClient):Promise<User>{
 * const db = tx ?? this.db  
 * 
 * return this.db.user.update({
 * where:{id:userId},
 * data:{
 * passwordHash , tokenVersion:{increment:1}}
 * }) 
 * }
 * 
 */