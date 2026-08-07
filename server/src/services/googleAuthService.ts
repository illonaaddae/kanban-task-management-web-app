import crypto from "node:crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import type { UserDocument } from "../models/User";
import { userRepository } from "../repositories/userRepository";
import { AppError } from "../utils/AppError";
import { generateTokens, type TokenPair } from "../utils/generateTokens";

/**
 * Hand-rolled Google authorization-code flow.
 *
 * No passport: the whole exchange is three HTTP calls and a database upsert, and
 * a strategy library would hide the one part worth being explicit about - that
 * we mint *our own* JWTs at the end rather than trusting Google's tokens for
 * anything beyond identifying the user once.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

/** Name of the httpOnly cookie holding the CSRF state. */
export const STATE_COOKIE = "oauth_state";

/** Ten minutes: long enough to finish a consent screen, short enough to matter. */
export const STATE_TTL_MS = 10 * 60 * 1000;

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleAuthResult {
  user: UserDocument;
  tokens: TokenPair;
  /** True when this call created the account rather than matching an existing one. */
  isNewUser: boolean;
}

/**
 * 503 rather than 404 when the Google keys are absent.
 *
 * The route exists and is part of the API; it is the deployment that is not
 * configured for it. 404 would suggest the client had the wrong URL.
 */
export function assertConfigured(): void {
  if (!env.googleOAuthEnabled) {
    throw new AppError("OAuth not configured", 503);
  }
}

export function createState(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Constant-time comparison of the state parameter against the cookie.
 *
 * `===` on secrets leaks length and position through timing. The lengths are
 * checked first because timingSafeEqual throws on a mismatch.
 */
export function statesMatch(fromQuery: string, fromCookie: string): boolean {
  const a = Buffer.from(fromQuery);
  const b = Buffer.from(fromCookie);

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** The consent-screen URL to redirect the browser to. */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID as string,
    redirect_uri: env.GOOGLE_REDIRECT_URI as string,
    response_type: "code",
    scope: "openid email profile",
    state,
    // Keeps the flow predictable: always show the account chooser rather than
    // silently reusing whichever Google session the browser happens to hold.
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** Exchanges the one-time code for Google's access token, server-side. */
async function exchangeCode(code: string): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID as string,
      // Only ever sent from here - the secret never reaches the browser.
      client_secret: env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: env.GOOGLE_REDIRECT_URI as string,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    // Google's body names the real cause (bad redirect_uri, reused code). Log it
    // for us; tell the client only that sign-in failed.
    const detail = await response.text().catch(() => "");
    logger.error(
      { status: response.status, detail: detail.slice(0, 500) },
      "Google token exchange failed",
    );
    throw AppError.unauthorized("Google sign-in failed. Please try again.");
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw AppError.unauthorized("Google sign-in failed. Please try again.");
  }

  return data.access_token;
}

async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    logger.error({ status: response.status }, "Google userinfo request failed");
    throw AppError.unauthorized("Could not read your Google profile.");
  }

  const profile = (await response.json()) as Partial<GoogleProfile>;

  if (!profile.sub || !profile.email) {
    throw AppError.unauthorized("Google did not return an email address.");
  }

  return profile as GoogleProfile;
}

/**
 * Finds or creates the account behind a Google profile.
 *
 * Order matters:
 *   1. `googleId` - the stable identifier. An email can change; `sub` cannot.
 *   2. verified email - links Google to an existing password account, so signing
 *      in with Google does not silently create a second account for the same
 *      person.
 *   3. otherwise create, `role: editor`, no password.
 *
 * An **unverified** Google email is never used to link. Without that check,
 * anyone who could get Google to issue a profile carrying someone else's
 * unverified address could take over that account.
 */
async function upsertUser(profile: GoogleProfile): Promise<{
  user: UserDocument;
  isNewUser: boolean;
}> {
  const existingByGoogleId = await userRepository.findByGoogleId(profile.sub);
  if (existingByGoogleId) return { user: existingByGoogleId, isNewUser: false };

  if (profile.email_verified) {
    const existingByEmail = await userRepository.findByEmail(profile.email);

    if (existingByEmail) {
      const linked = await userRepository.linkGoogleId(existingByEmail._id, profile.sub);
      logger.info({ userId: existingByEmail._id.toString() }, "Linked Google to an existing account");
      return { user: linked ?? existingByEmail, isNewUser: false };
    }
  }

  const created = await userRepository.create({
    name: profile.name?.trim() || profile.email.split("@")[0],
    email: profile.email,
    googleId: profile.sub,
    // No password: the User schema only requires one when googleId is absent.
    role: "editor",
    ...(profile.picture ? { avatar: profile.picture } : {}),
  });

  logger.info({ userId: created._id.toString() }, "Created an account from Google sign-in");
  return { user: created, isNewUser: true };
}

/** Runs the whole exchange and issues our own tokens. */
export async function completeGoogleSignIn(code: string): Promise<GoogleAuthResult> {
  const accessToken = await exchangeCode(code);
  const profile = await fetchProfile(accessToken);
  const { user, isNewUser } = await upsertUser(profile);

  return {
    user,
    isNewUser,
    tokens: generateTokens({
      id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    }),
  };
}

/**
 * Where to send the browser once we hold our own tokens.
 *
 * Tokens go in the **hash**, not the query string: a fragment is never sent to a
 * server, so the pair cannot end up in access logs, proxy logs or a Referer
 * header on the next navigation.
 */
export function buildFrontendRedirect(tokens: TokenPair): string {
  const fragment = new URLSearchParams({
    token: tokens.accessToken,
    refresh: tokens.refreshToken,
  });

  return `${env.FRONTEND_URL.replace(/\/+$/, "")}/login#${fragment.toString()}`;
}

/** A stable machine-readable code per failure, so the frontend can branch. */
function errorCodeFor(statusCode: number): string {
  switch (statusCode) {
    case 503:
      return "oauth_not_configured";
    case 403:
      return "invalid_state";
    case 400:
      return "missing_code";
    default:
      return "oauth_failed";
  }
}

/**
 * Where to send a *browser* when the flow fails.
 *
 * Without this a failed sign-in dumps a raw JSON error envelope in the address
 * bar, stranding the user outside the app with no way back. Redirecting to the
 * login page with the reason in the fragment keeps them inside the SPA, which
 * can then toast it.
 *
 * Only `AppError` messages are forwarded - they are the ones written to be read
 * by a user. Anything else is a bug, and its message could carry internals.
 */
export function buildFrontendErrorRedirect(error: unknown): string {
  const isOperational = error instanceof AppError;
  const statusCode = isOperational ? error.statusCode : 500;

  const fragment = new URLSearchParams({
    error: errorCodeFor(statusCode),
    error_description: isOperational
      ? error.message
      : "Google sign-in failed. Please try again.",
  });

  return `${env.FRONTEND_URL.replace(/\/+$/, "")}/login#${fragment.toString()}`;
}

export const googleAuthService = {
  assertConfigured,
  createState,
  statesMatch,
  buildAuthUrl,
  completeGoogleSignIn,
  buildFrontendRedirect,
  buildFrontendErrorRedirect,
};

export default googleAuthService;
