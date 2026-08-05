import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { UserDocument } from "../models/User";
import { userRepository } from "../repositories/userRepository";
import { AppError } from "../utils/AppError";
import {
  generateTokens,
  verifyRefreshToken,
  type TokenPair,
  type TokenPayload,
} from "../utils/generateTokens";

/**
 * A real bcrypt hash (cost 12) that no password matches.
 *
 * When the email is unknown we still run a compare against this, so a missing
 * account costs the same ~250ms as a wrong password. Returning early instead
 * would let an attacker enumerate registered emails by response time alone.
 */
const DUMMY_HASH = "$2b$12$mnGeMfllYmJLA2e.kJ/SoudEYerqxj9BwU8a2mR6ATAW1YH9SfHl.";

/** One message for every login failure — never reveal which half was wrong. */
const INVALID_CREDENTIALS = "Invalid credentials";

export interface AuthResult {
  user: UserDocument;
  tokens: TokenPair;
}

export interface RegisterParams {
  name: string;
  email: string;
  password: string;
}

function payloadFor(user: UserDocument): TokenPayload {
  return {
    id: user._id.toString(),
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/** Maps jsonwebtoken's errors to precise 401s so nothing reaches the 500 path. */
function toAuthError(error: unknown, context: "access" | "refresh"): AppError {
  const label = context === "refresh" ? "Refresh token" : "Token";

  if (error instanceof jwt.TokenExpiredError) {
    return AppError.unauthorized(
      context === "refresh"
        ? "Refresh token has expired. Please log in again."
        : "Your session has expired. Please log in again.",
    );
  }
  if (error instanceof jwt.NotBeforeError) {
    return AppError.unauthorized(`${label} is not active yet`);
  }
  if (error instanceof jwt.JsonWebTokenError) {
    return AppError.unauthorized(`${label} is invalid`);
  }

  return AppError.unauthorized(`${label} could not be verified`);
}

export const authService = {
  /** 409 when the email is taken; the unique index covers the race. */
  async register({ name, email, password }: RegisterParams): Promise<AuthResult> {
    if (await userRepository.existsByEmail(email)) {
      throw AppError.conflict("An account with this email already exists");
    }

    const user = await userRepository.create({ name, email, password });

    return { user, tokens: generateTokens(payloadFor(user)) };
  },

  /**
   * Generic 401 on every failure path: unknown email, wrong password, or an
   * account that only has Google sign-in.
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await userRepository.findByEmailWithPassword(email);

    if (!user || !user.password) {
      // Keep the timing indistinguishable from a wrong-password attempt.
      await bcrypt.compare(password, DUMMY_HASH);
      throw AppError.unauthorized(INVALID_CREDENTIALS);
    }

    if (!(await user.comparePassword(password))) {
      throw AppError.unauthorized(INVALID_CREDENTIALS);
    }

    return { user, tokens: generateTokens(payloadFor(user)) };
  },

  /**
   * Verifies the refresh token, re-checks it against the user's current
   * tokenVersion, and issues a brand new pair.
   *
   * tokenVersion is not bumped here: doing so would invalidate every other
   * device's session on each refresh. It is bumped on logout, which is what
   * makes a stolen refresh token revocable.
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw toAuthError(error, "refresh");
    }

    const user = await userRepository.findById(payload.id);
    if (!user) {
      throw AppError.unauthorized("The user belonging to this token no longer exists");
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw AppError.unauthorized("Session is no longer valid. Please log in again.");
    }

    return { user, tokens: generateTokens(payloadFor(user)) };
  },

  /**
   * Bumps tokenVersion, which invalidates every access and refresh token
   * already issued to this user — including ones that have not expired.
   */
  async logout(userId: string): Promise<void> {
    await userRepository.incrementTokenVersion(userId);
  },

  toAuthError,
};

export default authService;
