/**
 * Express Request Type Extension
 * Adds the authenticated user payload to the Express Request interface.
 * This is populated by the authenticate middleware after JWT verification.
 */
declare global {
  namespace Express {
    interface Request {
      /** Populated by authenticate middleware after successful JWT verification */
      user?: JwtPayload;
    }
  }
}

export {};
