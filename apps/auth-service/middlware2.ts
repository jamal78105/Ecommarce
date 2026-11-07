// import { NextFunction } from "express";
// import { SessionRepository } from "./src/repo/session.repository.js";
// import { UserRepository } from "./src/repo/user.repository.js";
// import { TokenService } from "./src/services/token.service.js";

// export function authmiddleware(
//     tokenservice: TokenService,
//     userrepo: UserRepository,
//     sessionrepo: SessionRepository
// ) {
//     return async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const authHeader = req.headers.auther
//             if (!authHeader || !authHeader.startsWith('Bearer ')) {
//                 return res.status(401).json({ message: "UNAUTHORIZED" });
//             }

//             const token = authHeader.split(' ')[1];
//             if (!token) {
//                 return res.status(401).json({ message: "UNAUTHORIZED" });
//             }

//             const payload = tokenservice.verifyAcessToken(token) as CustomeJwtPayload;
//             const [user, session] = await Promise.all([
//                 userrepo.findById(payload.sub),
//                 sessionrepo.findById(payload.sessionId)
//             ]);

// 
//             if (!user || user.status !== "ACTIVE") {
//                 return res.status(401).json({ message: "INVALID OR INACTIVE ACCOUNT" });
//             }

//             if (user.tokenVersion !== payload.tokenVersion) {
//                 return res.status(401).json({ message: "ACCESS TOKEN REVOKED" });
//             }

//             if (!session || session.id !== user.id) {
//                 return res.status(401).json({ message: "INVALID OR EXPIRED SESSION" });
//             }

//             res.locals.auth = {
//                 userId: user.id,
//                 sessionId: session.id,
//             };

//             return next();
//         } catch (error) {
//             return res.status(401).json({ message: "INVALID OR EXPIRED ACCESS TOKEN" });
//         }
//     };
// }


