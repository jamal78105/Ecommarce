import express , {type Express} from "express"
import dotenv from "dotenv"
import { pinoHttp } from "pino-http";
import router from "./Router/auth.route.js";
import { logger } from "./config/logger.js";
import { errorHandler } from "./utils/errorHandler.js";
dotenv.config();

const app:Express  = express() // this one happen because of the typescript 7 

app.use(pinoHttp({ logger }));
app.use(express.json())
app.use(router)
app.use(errorHandler)
// this is the health check

app.get("/health" , async(_req , res)=>{
    res.status(200).json({
        status:"okay",
        service : "auth-service"
    })
})
// ERROR HANDLER FOR NOW THEN WE GANNA BUILD IT IN SPARETED FILE
// app.use((
//     error:unknown,
//     _req:express.Request,
//     res:express.Response,
//     _next:express.NextFunction
    
// )=>{
//     if(error instanceof Error && error.message === "EMAIL ALREADY EXSIST"){
//        return  res.status(409).json({
//             message:"Email already exists"
//         })
//         return;
//     }
//     if(error instanceof Error && error.message === "Account not active"){
//      return res.status(409).json({
//             message:" Account not active"
//         })
       
//     }
//     if(error instanceof Error && error.message === "INVALID_CREDENTIALS"){
//      return res.status(409).json({
//             message:"INVALID_CREDENTIALS"
//         })
       
//     }
// }
// )


const port = process.env.PORT || 3001
app.listen(port, () => {
logger.info(`server is running on this ${port}`)

});
