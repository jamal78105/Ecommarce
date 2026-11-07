import { UserStatus , User } from "@prisma/client";
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

    async findActiveByEmail(
        email : string
    ):Promise<User | null>{
        return await this.db.user.findFirst({
            where:{
                email:email.trim().toLocaleLowerCase(),
                status:UserStatus.ACTIVE,
                deletedAt : null
            }
        })
    }
    async findDeleteEmail(
        email : string
    ):Promise<User | null>{
        return await this.db.user.findFirst({
            where:{
                email:email.trim().toLocaleLowerCase(),
   
                status:UserStatus.ACTIVE,
                deletedAt : {not:null}
            }
        })
    }

    async updateLastLogin(
        userId : string
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
    async getTokenVersion(
        userId : string
    ):Promise<number | null>{
        const user = await this.db.user.findUnique({
            where : {
                id : userId
            },
            select:{
                tokenVersion : true
            }

            })
        return user?.tokenVersion ??null
    }
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
                gracePeriodEnd : true
            }
        })
        if(!user || user.status !==UserStatus.DELETED ||!user.gracePeriodEnd){
            return false
        }
        return new Date<user.gracePeriodEnd
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
               ...(passwordHash!==undefined?{passwordHash} : {})
            }

        })
    }

    async findExpiredGracePeriod():Promise<User[]>{
        return this.db.user.findMany({
            where:{
                status : UserStatus.DELETED,
                gracePeriodEnd:{
                    lt: new Date()
                }
            }
        })
    }
    async setResotreCode(data:{
        userId : string,
        codeHash : string,
        expireAt : Date
    }):Promise<User>{
        return this.db.user.update({
            where:{
                id: data.userId
            },
            data:{
                 restoreCodeHash:data.codeHash,
                restoreCodeExpiresAt:data.expireAt,
                restoreCodeUsed : false
            }
        })
    }
    

}