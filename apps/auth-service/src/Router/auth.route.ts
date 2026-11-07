import { Router } from "express";
import { Authercontroller } from "../controller/auth.controller.js";
import { UserRepository } from "../repo/user.repository.js";
import { SessionRepository } from "../repo/session.repository.js";
import { TokenFamilRepository } from "../repo/TokenFamily.repostory.js";
import { RefreshTokenRepository } from "../repo/refresh.reposories.js";
import { TokenService } from "../services/token.service.js";
import { AuthService } from "../services/auth.service.js";
import { authenticate } from "../middleware/authentication.js";
import { validation } from "../middleware/middleware.js";
import { loginSchema, registerSchema } from "../validator/auth.validation.js";
import { PassowrdResetRepo } from "../repo/PasswordResetrep.js";
import { authorize } from "../middleware/authroizeation.js";
const router: Router = Router();
const authService = new AuthService(
    new UserRepository(),
    new SessionRepository(),
    new TokenFamilRepository(),
    new TokenService(),
     new RefreshTokenRepository(),
     new PassowrdResetRepo
    
)
const authcontroller = new Authercontroller(authService)
router.post("/api/v1/auth/register" ,validation(registerSchema), authcontroller.register)
router.post("/api/v1/auth/login" ,validation(loginSchema), authcontroller.login)
router.post("/api/v1/auth/logout",authenticate,authcontroller.logout)
router.get("/api/v1/auth/get" , authenticate,authorize("ADMIN"),authcontroller.getalluser )
router.post("/api/v1/auth/refresh" , authcontroller.token)
router.post("/api/v1/auth/forgetPassowrd" , authcontroller.forgetPassowrd)
router.post("/api/v1/auth/resetPassowrd" , authcontroller.resetPassowrd)
router.patch("/api/v1/auth/changepassword/:id" ,authenticate, authcontroller.changePassword)
router.get("/sessions" , authenticate ,authcontroller.getActiveSession.bind(authcontroller))
router.delete("/sessions/:sessionId" , authenticate ,authcontroller.revokeSession.bind(authcontroller))

export default router;