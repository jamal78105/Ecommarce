import { createClient } from "redis";
import { env } from "../config/env.js";
import { Logger } from "pino";
import { en } from "zod/locales";
import { logger } from "../config/logger.js";
import { looseObject } from "zod";

export const redisClient = createClient({
    url:env.REDIS_URL
})
redisClient.on("connect" , ()=>{
    logger.info("Redis connecting ...")
})
redisClient.on("ready" , ()=>{
    logger.info("Redis connecting is ready")
})
redisClient.on("reconnecting" , ()=>{
    logger.warn("Redis reconnecting...")
})
redisClient.on("error" , (error)=>{
    logger.error({err:error} , "Redis connecting Error")
})
redisClient.on("end" , (error)=>{
    logger.warn({err:error} , "Redis connecting close")
})
export async function connectinoRedis():Promise<boolean> {
    if(redisClient.isReady){
        return true
    }
    try {
        if(!redisClient.isOpen){
            await redisClient.connect()
        }
        return redisClient.isReady
    } catch (error) {
        logger.warn({err:error},"Redis is unavalible Application will contuniou without cache")
        return false
    }


}
export async function disconnecting():Promise<void>{
if(redisClient.isOpen){
    await redisClient.quit()
    logger.info("Redis is disconnectiong gracefully")
}
}