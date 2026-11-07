import { Request , Response , NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import prisma from "../config/prisma.js";
import { success } from "zod";
import { logger } from "../config/logger.js";
export class Authercontroller{
    constructor(
       private Autherserviceobject: AuthService
    ){}
    
        
    register = async(req:Request , res:Response , next:NextFunction)=>{
        try {
        const user =  await this.Autherserviceobject.register(req.body)
        //console.log(user)
            return res.status(201).json({
            message:"User registered successfully",
            data:user // this might show the user unnessary data we ganna use DTO
        })
        } catch (error) {
            next(error)
            console.log("SOMETING WENT WRONG WITH THE SERVER : ", error)
        }
       
    }
    login = async(req:Request , res:Response , next:NextFunction)=>{
        try {
        const login = await this.Autherserviceobject.login(req.body)
         return res.status(200).json({
            message:"Login successsful",
            data:login
        })
        } catch (error) {
            next(error)
            console.log("SOMETING WENT WRONG WITH THE SERVER : ", error)
            
        }

    }
      logout = async(req:Request , res:Response , next:NextFunction)=>{
        const {sessionId , userId} = req.user
        if(!sessionId){
            return res.status(400).json({message:"session ID is required"})
        }
            await this.Autherserviceobject.logout(sessionId , userId)
            return res.status(200).json({
                message:"Logout scuccessful"
            })
        }
    getalluser = async(_req:Request , res:Response)=>{
       try {
         const user= await prisma.user.findFirst({
            where:{
                status:"ACTIVE"
            }
        })
        if(!user){
            return res.status(401).json({
                message:"User not active"
            })
        }
        return res.status(200).json({
            message:"ALL THE UERS",
            data:user
        })
       } catch (error) {
          logger.error({ event: "admin.user_lookup_failed", err: error });
            return res.status(401).json({
                message:"401 Unauthorized"
            })
            
       }
    }

    token = async(req:Request , res:Response)=>{
      try {
          const {refresToken} = req.body

        if(typeof refresToken !== "string" || !refresToken.trim()){
            return res.status(400).json({
                message:"Refresh token is required"
            })
        }
        const result = await this.Autherserviceobject.rotate(refresToken)
        return res.status(200).json({
            message:"Token refreshed successfully",
            data:{
                refresToken:result.refreshToken,
                accessToken:result.accessToken
            }
        })
      } catch (error:any) {
                logger.warn({ event: "auth.refresh_failed", method: req.method, path: req.path });
        return res.status(401).json({
            message:error.message || "INVALID OR EXPIRD REFRESH TOKEN"
        })
      }
    }

    forgetPassowrd = async(req:Request , res:Response , next:NextFunction):Promise<void>=>{
        try {
           const result = await this.Autherserviceobject.forgetPassword(req.body.email) 
           console.log(`THIS WHAT INSIDE THE RESETOKEN ${result}`)
           res.status(201).json({
            resetToken:result
           })
        } catch (error) {
            next(error)
        }
    }
    resetPassowrd = async(req:Request , res:Response , next:NextFunction):Promise<void>=>{
        const {resetToken,newPassword}=req.body        
        try {
            await this.Autherserviceobject.resetPassword(resetToken , newPassword)
           res.status(201).json({message:`Passowrd has been reset successfully`})
        } catch (error) {
            next(error)
        }
    }
    changePassword = async(req:Request , res:Response , next:NextFunction):Promise<void>=>{
        const {id:userId}=req.params
        if(!userId || typeof userId !=="string"){
            res.status(401).json({message:"USER ID MUST BE STRING "})
            return
        }
        const {currentPassword , newPassword}=req.body        
        try {
            await this.Autherserviceobject.changePassword(userId,currentPassword , newPassword)
           res.status(201).json({message:`Passowrd has been change successfully`})
        } catch (error) {
          
            next(error)
        }
    }

    getActiveSession = async(req:Request , res:Response)=>{
        const userId = req.user.id
        const sessions = await this.Autherserviceobject.getActiveSessions(userId)
        return res.status(200).json({
            success:true,
            message:"Active sessions retrieved successfully",
            data:sessions
        })
    }
    revokeSession = async(req:Request , res:Response)=>{
        const userId = req.user.id
        const {sessionId} = req.params
        if(!sessionId || typeof sessionId !=="string"){
            res.status(401).json({message:"USER ID MUST BE STRING "})
            return
        }
        const result = await this.Autherserviceobject.revokeSession(sessionId,userId)
        return res.status(200).json({
            succcess:true,
            data:result
        })
    }

   
}