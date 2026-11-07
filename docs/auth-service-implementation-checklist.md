# Ecommerce Auth Service --- Implementation Checklist

> **Purpose:** Track what has actually been implemented, what has only
> been discussed, and what must be verified before production.
>
> **Legend:** `[x]` confirmed in the conversation or visibly attempted;
> `[ ]` not confirmed complete. A checked item is not automatically
> production-verified.

## 1. Project baseline

-   [x] Node.js + TypeScript project.
-   [x] Express 5.
-   [x] Prisma 6 with PostgreSQL.
-   [x] Repository Pattern using repository classes.
-   [x] Access Token payload includes `sub`, `sessionId`,
    `tokenVersion`, `role`, and `tokenType: "access"`.
-   [x] Refresh Token payload includes `sub`, `sessionId`, `familyId`,
    and `tokenType: "refresh"`.
-   [x] Access Token lifetime configured as 15 minutes in the discussed
    `TokenService`.
-   [x] Refresh Token lifetime configured as 7 days in the discussed
    `TokenService`.

## 2. Refresh Token Rotation --- progress

-   [x] Rotation flow has been designed and code discussed for
    `RefreshTokenRepository.rotate()`.
-   [x] Rotation checks the stored token hash.
-   [x] Rotation checks that stored `userId`, `sessionId`, and
    `familyId` match the verified JWT.
-   [x] Rotation checks token expiry and revocation.
-   [x] Rotation checks that the session is still valid.
-   [x] New Refresh Tokens are stored as a hash rather than storing the
    raw token.
-   [x] `familyId` is carried forward to the replacement Refresh Token.
-   [x] Reuse detection and family revocation have been discussed.
-   [ ] **Do not mark complete until verified:** Prisma `RefreshToken` ↔
    `UserSession` relation is one-to-many, not one-to-one.
-   [ ] **Do not mark complete until verified:** `sessionId` is not
    `@unique` on `RefreshToken`; `tokenHash` is unique.
-   [ ] Fix and verify the exact `P2002` error shown for `sessionId`.
-   [ ] Ensure rotation issues and returns **both** a new Access Token
    and a new Refresh Token.
-   [ ] Ensure the new Access Token uses the authoritative current
    `role` and `tokenVersion` from the correct database record.
-   [ ] Decide whether to use a database transaction or an atomic
    design. The currently discussed no-transaction implementation can
    revoke the old token and then fail to create the replacement.
-   [ ] Handle concurrent refresh requests safely.
-   [ ] Test reuse detection: a revoked token that is presented again
    should trigger family revocation according to the chosen policy.
-   [ ] Ensure refresh requests fail if the session is revoked, even if
    the JWT itself is valid.
-   [ ] Test all success and failure cases against the real Prisma
    schema and PostgreSQL database.

## 3. Error handling and logging --- progress

-   [x] Pino logger code was provided.
-   [x] `AppError` code was provided.
-   [x] Express error middleware code was provided.
-   [x] An optional async wrapper was discussed.
-   [ ] Add a request-ID middleware and TypeScript declaration for
    `req.requestId`.
-   [ ] Ensure middleware order is correct: request ID, parsers/routes,
    not-found handling, then error handler.
-   [ ] Map malformed JSON and request-size errors to appropriate client
    responses.
-   [ ] Confirm redaction covers credentials and tokens without relying
    on redaction as the only protection.
-   [ ] Add automated tests for 4xx, 500, malformed JSON, and request ID
    propagation.
-   [ ] Add production-safe graceful shutdown, including closing the
    HTTP server and disconnecting Prisma.
-   [ ] Run build, lint, and tests; review actual output before calling
    this production-ready.

## 4. Authentication and session lifecycle --- next items

-   [ ] Login: validate credentials and create the session plus initial
    Refresh Token record.
-   [ ] Refresh endpoint/controller: validate request, call the service,
    return both tokens safely.
-   [ ] Authentication middleware: verify Access Token and confirm
    session is still active.
-   [ ] Logout current session: revoke the session and its Refresh Token
    family/tokens according to the schema.
-   [ ] Logout-all / token-version invalidation policy.
-   [ ] Password change/reset invalidation policy.
-   [ ] Rate limiting for login and refresh endpoints.
-   [ ] Security tests for invalid signatures, expired tokens, revoked
    sessions, and token reuse.
-   [ ] Review token storage/transport policy for the frontend (prefer
    secure, HttpOnly cookies where the deployment and CSRF strategy
    support them; otherwise document the chosen storage risk).

## 5. Completion rule

Only check an item after verifying it in the actual repository and
running the relevant test. Code shown in chat or code that merely
compiles is not proof that the feature is production-ready.
