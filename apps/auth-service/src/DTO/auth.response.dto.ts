import { UserRole, UserStatus } from "@prisma/client"
import { boolean, email, string } from "zod"
import { AppError } from "../utils/apperror.js"

export type AuthUserResponseDto = {
    id : string
    email : string
    name : string | null
    role:UserRole
    status : UserStatus
    emailVerified:boolean
    
}
export type LoginResponseDto = {
    user : AuthUserResponseDto
    accessToken : string
    refreshToken:string
    sessionId:string
}
export type RegisterResponseDto = {
    user:AuthUserResponseDto
}
export function toAuthUserRespone(user:{
    
        id: string
        email : string
        name : string | null
        role:UserRole
        status : UserStatus
        emailVerified:boolean,
        
    }):AuthUserResponseDto{
        
        return{
            id:user.id,
            email:user.email,
            name:user.name,
            role:user.role,
            status:user.status,
            emailVerified:user.emailVerified
        }
    }
    
