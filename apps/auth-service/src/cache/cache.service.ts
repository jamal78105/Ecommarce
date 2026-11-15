import { nullable } from "zod";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/apperror.js";
import { redisClient } from "./redis-client.js";
export class CacheService{
    async get<T>(key:string):Promise<T | null>{  // for example async get <User>{} , async<T>{ like the value}
        if(!redisClient.isReady){
            return null
        }
        try {
            const CachedData = await redisClient.get(key)
            console.log("THIS IS THE CACHEDATA BEFORE USING THE PARSING" , CachedData)
            if(CachedData === null){
                return null
            }
            return JSON.parse(CachedData) as T
        } catch (error) {
            logger.warn({error  , key} , "Cache GET operation failed")
            return null
        }
    }
      async set<T>(
        key : string , 
        value : T,
        ttlSeconds:number
      ):Promise<boolean>{
        if(!redisClient.isReady){
            return false
        }
        if(Number.isInteger(ttlSeconds) || ttlSeconds<=0){
            throw new AppError("Cache TTl must be a postive integer")
        }
        try {
           await redisClient.set(
            key,
            JSON.stringify(value),
            {EX:ttlSeconds}
           ) 
           return true
        } catch (error) {
            logger.warn({error , key} , "Cache SET oepration failed")
            return false
        }
      }
      async del(key :string):Promise<boolean>{
        if(!redisClient.isReady){
            return false
        }
         try {
            await redisClient.del(key)
            return true
         } catch (error) {
            logger.warn({error , key} , "Cache DELETE opration failed")
            return false
         }
      }
}