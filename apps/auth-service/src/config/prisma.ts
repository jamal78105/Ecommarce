import { PrismaClient } from "@prisma/client"
// const prisma = new PrismaClient()
// export default prisma
const prismaClientSingleton = ()=>{
    return new PrismaClient({ 
        log: process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"],
    })
    // why we create the prismaclinent instance in a function? because we want to create a new instance of prisma client every time we call this function, so that we can avoid the problem of having multiple instances of prisma client in the same application, which can cause problems like connection pool exhaustion and memory leaks.
    
}
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton> 
const globalForPrisma = globalThis as unknown as { prisma: PrismaClientSingleton }
export const prisma = globalForPrisma.prisma || prismaClientSingleton()
export default prisma