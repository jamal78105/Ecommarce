# Auth Service --- Current Status and the Relationship Between User, Session, RefreshToken, and TokenFamily

## 1. Where We Are

We are working inside `E:\Ecommerce\apps\auth-service` within an E-commerce project using Node.js, TypeScript, Express, Prisma 6, and PostgreSQL. We use Zod for environment configuration, bcrypt for passwords, and jsonwebtoken for creating and verifying JWTs.

Current core files:

``` text
apps/auth-service/src/
├── config/
│   ├── env.ts
│   └── prisma.ts
├── repository/
│   ├── user.repository.ts
│   ├── session.repository.ts
│   ├── token-family.repository.ts
│   ├── refresh-token.repository.ts
│   └── password-reset.repository.ts
└── services/
    ├── auth.service.ts
    ├── user.service.ts
    ├── session.service.ts
    └── token.service.ts
```

We created `TokenService` to generate Access Tokens, Refresh Tokens, and Reset Tokens. We encountered a TypeScript error with `expiresIn`; a static value like `"15m"` succeeded in building. If we use `.env` values later, we will type them correctly instead of hiding the issue using `any`.

**Current Stage:** Understanding relationships and preparing the Login, Logout, and Refresh flows before completing and testing them.

---

## 2. What Is the Function of Each Entity?

### User --- The User
Represents the account itself, not a device or a login process.
* `id`: User identifier.
* `email`: Email address.
* `passwordHash`: Hashed password.
* `status`: Account status.
* `tokenVersion`: A number that can be incremented to invalidate old Access Tokens when checked during requests.

A single user can log in from multiple devices, and therefore may have multiple sessions.

### UserSession --- The Session
Represents a specific login session, such as a session on a laptop or a phone.
* `id`: Session identifier, referred to as `sessionId`.
* `userId`: The owner of the session.
* `expiresAt`: Session expiration time.
* `isValid`: Is the session valid?
* `revokedAt` and `revokedReason`: Revocation information.
* Optional data such as `ipAddress` and `userAgent`.

The session answers the question: **Is this login session still valid?**

### TokenFamily --- Token Family
Represents the group of Refresh Tokens associated with a single session. In the current schema, `TokenFamily.sessionId` is unique, so every session has a single family.
* `id`: Family identifier, referred to as `familyId`.
* `sessionId`: The session followed by the family.
* `revokedAt` and `revokedReason`: Family revocation information.

The family allows invalidating the entire chain of refresh tokens belonging to a full session.

### RefreshToken --- Refresh Token Record
Represents a database record for a Refresh Token belonging to a specific family.
* `id`: Database record identifier.
* `familyId`: The family it belongs to.
* `expiresAt`: Expiration time.
* `revokedAt`: Revocation time, if it occurred.

**Important Design Note in the Current Setup:** The `RefreshToken` record does not yet contain a `jti` or a hash to distinguish a specific JWT. Therefore, we currently cannot precisely link each specific JWT to its record or reliably implement old token reuse detection. When implementing Refresh Token Rotation, we need to add `jti` to the JWT and store it in the record, or store a hash of the token. We will maintain `TokenFamily`.

### Access Token
It is a short-lived JWT sent with protected requests. It currently contains `sessionId` and `tokenVersion`, and `userId` is placed in the `sub` claim. We typically do not need a separate table for each Access Token, but we must verify its signature and validity, then ensure that the session is active and that `tokenVersion` matches the user's current value.

---

## 3. Entity Relationships

``` text
User
 │
 ├──< UserSession
 │       │
 │       └── 1 : 1 TokenFamily
 │                  │
 │                  └──< RefreshToken
 │
 ├──< LoginHistory
 └──< UserAuditLog
```

* `User` to `UserSession`: One-to-many; a user can have many sessions.
* `UserSession` to `TokenFamily`: One-to-one in the current schema; `sessionId` is unique in `TokenFamily`.
* `TokenFamily` to `RefreshToken`: One-to-many; a family can include multiple records with token rotation.

---

## 4. Login Flow

1. `AuthService` receives the email and password.
2. Searches for the user via `UserRepository`.
3. Verifies the password using `bcrypt.compare()`.
4. Ensures the account status allows logging in.
5. Creates a `UserSession`.
6. Creates a `TokenFamily` linked to the session.
7. Creates an Access Token containing `sessionId` and `tokenVersion`.
8. Creates a Refresh Token containing `sessionId` and `familyId`.
9. Creates a `RefreshToken` record in the database.
10. Updates the last login and logs a successful login event.
11. Returns the tokens and safe data to the client, without `passwordHash`.

In a production implementation, it is best to wrap session, family, and record creation operations inside a proper database transaction so that a failed operation does not leave behind partial records.

---

## 5. Logout Flow

When logging out from a single session:
1. Verify the session.
2. Revoke the `UserSession`.
3. Revoke the `TokenFamily` belonging to it.
4. Revoke the `RefreshToken` records belonging to the family.

After that, protected requests must reject Access Tokens associated with this session. The validity of a JWT signature alone does not mean the session is still active.

Logging out from all devices requires invalidating all of the user's sessions. You can also increment `tokenVersion` to invalidate old Access Tokens if checking this field is implemented in the middleware.

---

## 6. Targeted Refresh Flow

1. The server receives the Refresh JWT.
2. Verifies the signature and expiration time using `verifyRefreshToken()`.
3. Reads `sub`, `sessionId`, and `familyId` after verifying claim types.
4. Ensures the session is active and not expired.
5. Ensures the family exists and is not revoked.
6. Verifies the current token record using `jti` or a hash after adding it to the design.
7. Revokes the previous token and issues a new Refresh Token and Access Token.
8. If an attempt to reuse an already rotated token is detected, it applies the family revocation policy and logs the security event.

`jwt.verify()` verifies the signature and temporal validity; however, it does not prove by itself that the session or family is still active.

---

## 7. File Responsibilities

| File | Responsibility |
| :--- | :--- |
| `UserRepository` | Creates, searches for, and updates user data |
| `SessionRepository` | Creates, verifies, and revokes sessions, and logs login history |
| `TokenFamilyRepository` | Creates, searches for, and revokes token families |
| `RefreshTokenRepository` | Creates, searches for, and revokes Refresh Token records |
| `PasswordResetRepository` | Saves password reset records and verifies their validity |
| `TokenService` | Creates JWTs and verifies their signatures |
| `AuthService` | Coordinates registration, login, logout, reset logic, and repository handling |

Repositories deal with the database, `TokenService` deals with JWTs, and `AuthService` coordinates the process. We do not add extra layers without practical necessity.

---

## 8. What Remains Incomplete?

* Completing and testing Login and Logout via Controller and Routes.
* Adding Middleware to verify the Access Token, session, and `tokenVersion`.
* Implementing Refresh Token Rotation and linking each JWT to a distinct record via `jti` or a hash.
* Completing Forgot Password and Reset Password, and linking the reset token to a record allowing it to be revoked and used only once.
* Adding tests for successful and failing flows.

---

## 9. Conclusion

Memorize the core relationship:

* **User:** The account owner.
* **UserSession:** A specific login session.
* **TokenFamily:** The group of refresh tokens belonging to the session.
* **RefreshToken:** A record for a refresh token within the family.
* **Access Token:** A short-lived JWT for protected requests.

**Relationship:** `User → Sessions → TokenFamily → RefreshToken records`

This document accurately describes the current design, including the need to link each Refresh JWT to its individual record when implementing rotation.