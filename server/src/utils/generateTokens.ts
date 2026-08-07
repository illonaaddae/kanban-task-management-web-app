import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { UserRole } from "../models/User";

/**
 * Everything we put in a JWT. Deliberately minimal - no email, no name.
 *
 * A JWT is signed, not encrypted: anything here is readable by whoever holds
 * the token. `tokenVersion` is what makes logout and password changes able to
 * invalidate tokens that have not expired yet.
 */
export interface TokenPayload {
  id: string;
  role: UserRole;
  tokenVersion: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// @types/jsonwebtoken types `expiresIn` as `number | ms.StringValue`, which a
// plain `string` from the environment does not satisfy. The value is validated
// as a non-empty string by config/env.ts.
const accessExpiry = env.JWT_EXPIRES_IN as SignOptions["expiresIn"];
const refreshExpiry = env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"];

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: accessExpiry });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: refreshExpiry });
}

/** Issues a fresh access + refresh pair for a user. */
export function generateTokens(payload: TokenPayload): TokenPair {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/**
 * A token can be correctly signed and still carry the wrong shape (an old
 * token format, or a payload that was a bare string). Verify the structure
 * before anything downstream trusts `payload.id`.
 */
function assertTokenPayload(decoded: unknown): TokenPayload {
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof (decoded as TokenPayload).id !== "string" ||
    typeof (decoded as TokenPayload).role !== "string" ||
    typeof (decoded as TokenPayload).tokenVersion !== "number"
  ) {
    throw new jwt.JsonWebTokenError("Malformed token payload");
  }

  const { id, role, tokenVersion } = decoded as TokenPayload;
  return { id, role, tokenVersion };
}

/**
 * Throws jsonwebtoken's own errors (TokenExpiredError, JsonWebTokenError) so
 * callers can distinguish "expired" from "invalid" and map them to precise
 * 401 messages.
 */
export function verifyAccessToken(token: string): TokenPayload {
  return assertTokenPayload(jwt.verify(token, env.JWT_SECRET));
}

export function verifyRefreshToken(token: string): TokenPayload {
  return assertTokenPayload(jwt.verify(token, env.JWT_REFRESH_SECRET));
}

export default generateTokens;
