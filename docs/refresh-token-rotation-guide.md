# Refresh Token Rotation --- Design and Implementation Notes

## 1. Purpose

Refresh Token Rotation replaces a Refresh Token after it is used
successfully. The old token is revoked and a new token is issued. The
server stores only a cryptographic hash of each raw Refresh Token.

The refresh endpoint should return both: - a new Access Token
(short-lived); - a new Refresh Token (longer-lived, rotated).

The frontend must replace the old Refresh Token with the new one after a
successful response.

## 2. Token claims

The discussed token payloads are:

### Access Token

-   `sub`: user ID
-   `sessionId`: session ID
-   `tokenVersion`: current user token version
-   `role`: current user role
-   `tokenType: "access"`

### Refresh Token

-   `sub`: user ID
-   `sessionId`: session ID
-   `familyId`: refresh-token family ID
-   `tokenType: "refresh"`

The server must verify the signature, expiry, and expected token type
using the correct secret. Never accept an Access Token where a Refresh
Token is required.

## 3. Correct database relationship

One session can have many Refresh Token records over time. Each rotation
creates a new row, while previous rows remain as revoked history.

A simplified Prisma shape is:

``` prisma
model UserSession {
  id            String         @id @default(cuid())
  refreshTokens RefreshToken[]
  // keep the rest of the existing fields
}

model RefreshToken {
  id        String      @id @default(cuid())
  sessionId String
  session   UserSession @relation(fields: [sessionId], references: [id])
  tokenHash String      @unique
  familyId  String
  expiresAt DateTime
  revokedAt DateTime?
  // keep the rest of the existing fields and relations
}
```

This is a **shape example**, not a replacement for the project's
complete schema. Preserve the actual model fields and relation names.
The key constraints are: - `RefreshToken.sessionId` is **not**
`@unique`; - the `UserSession` side uses a list (`RefreshToken[]`); -
`tokenHash` (or the actual field name, such as `refreshTokenHash`) is
unique; - the referenced session primary key is unique, as usual.

After updating the schema, format and validate it, inspect migration
status, then create/apply a migration. Do not delete migration history
or reset a database containing valuable data just to clear a schema
error.

## 4. Rotation sequence

1.  Receive the raw Refresh Token over the intended secure transport.
2.  Verify signature, expiry, issuer/audience if configured, and
    `tokenType`.
3.  Hash the exact raw token with the same hash algorithm used when
    saving it.
4.  Find the matching database record by hash.
5.  If no record exists, reject the request.
6.  Compare the record's `userId`, `sessionId`, and `familyId` with the
    verified claims.
7.  If the record is revoked, treat it as possible reuse and apply the
    family-revocation policy.
8.  Reject an expired record.
9.  Verify that the session exists, belongs to the user, and remains
    active.
10. Generate a replacement Refresh Token with the same `sessionId` and
    `familyId`; hash it for storage.
11. Revoke the old record and persist the new record safely.
12. Generate a new Access Token using the authoritative current user
    `role` and `tokenVersion`.
13. Return both new tokens. Never log raw tokens.

## 5. Important `sessionId` uniqueness error (P2002)

The screenshot showed Prisma error `P2002` on `sessionId` when creating
a replacement Refresh Token. This means a unique constraint exists on
that field. The rotation design requires multiple Refresh Token rows to
reference the same session, so the relationship must be one-to-many, not
one-to-one.

Do not work around this by replacing the old token row's primary key
(`storedToken.id`) with `sessionId`. These IDs have different
meanings: - `storedToken.id` identifies the **specific old Refresh Token
row** to revoke. - `sessionId` identifies the **session** shared by
multiple token rows.

Use the old token row's ID for revoking that row, and use the same
`sessionId` when creating the replacement row.

## 6. Reuse detection and family revocation

If a validly signed Refresh Token maps to a database row that is already
revoked, the server may interpret this as reuse and revoke all
still-active tokens in that `familyId`. First validate that the stored
record matches the verified claims. Do not revoke a family based on
untrusted, mismatched identifiers.

Family revocation should be scoped to the same family and normally
affect only non-revoked records. The application must also reject
refresh attempts from revoked sessions.

A family-revocation call cannot revoke Access Tokens that have already
been issued. Immediate Access Token invalidation requires an
active-session check in authentication middleware, or another deliberate
revocation mechanism.

## 7. Transaction and concurrency trade-off

The earlier implementation intentionally omitted `$transaction`, at the
user's request. That version has a failure window:

-   old token is marked revoked;
-   creating the new row fails;
-   the user is left without a usable Refresh Token.

It also needs careful concurrency handling. A conditional `updateMany`
that only revokes a row with `revokedAt: null` prevents two concurrent
requests from both successfully claiming the same old row, but the
create step can still fail after revocation.

For production reliability, prefer an appropriate database transaction
for revocation plus insertion, and test concurrent refresh requests. If
the project intentionally keeps the no-transaction approach, document
the availability trade-off and provide a recovery/re-authentication
path. Do not claim the no-transaction implementation is fully
production-safe.

## 8. Hashing

Use the same deterministic hash function at token creation and lookup,
for example SHA-256:

``` typescript
import { createHash } from "node:crypto";

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

A high-entropy JWT is suitable for a fast cryptographic hash for lookup;
never store or log the raw Refresh Token. Ensure `tokenHash` is unique
so collisions or accidental duplicate writes are rejected.

## 9. Access Token issuance

After validating the refresh request and successfully rotating the
Refresh Token, issue a fresh Access Token. Its `role` and `tokenVersion`
should come from the authoritative user record (or another verified
current source), not blindly from stale client data.

Example of the intended return shape:

``` typescript
return {
  accessToken: newAccessToken,
  refreshToken: newRefreshToken,
};
```

This return shape alone is not a complete implementation; the repository
update, session validation, current user lookup, error mapping, and
tests must all be correct.

## 10. Required tests before marking complete

-   valid token rotates successfully and returns both tokens;
-   old token row is revoked and new token hash is stored;
-   unknown token is rejected;
-   expired token is rejected;
-   revoked token reuse triggers the family policy;
-   mismatched `sub`, `sessionId`, or `familyId` is rejected;
-   revoked or wrong-owner session is rejected;
-   token hash mismatch is rejected;
-   simultaneous refresh attempts cannot both succeed with the same old
    token;
-   database failure does not silently leave the system in an
    undocumented state;
-   new Access Token has the expected user ID, role, session ID, token
    version, and expiry;
-   raw tokens and secrets never appear in logs.

## Current status

The rotation flow and repository code were discussed, and the
`sessionId` uniqueness failure was observed. Until the actual schema,
migration, service implementation, and tests have been verified in the
repository, Rotation should be marked **in progress**, not complete.
