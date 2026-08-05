import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import {
  STATE_COOKIE,
  STATE_TTL_MS,
  googleAuthService,
} from "../services/googleAuthService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

/**
 * Reads one cookie off the raw header.
 *
 * Hand-rolled rather than pulling in cookie-parser: this is the only cookie the
 * API reads, and `res.cookie` (which writes it) is already built into Express.
 */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
}

/**
 * True when the caller is a browser following a link, rather than a script.
 *
 * Browsers send `Accept: text/html` on a top-level navigation; fetch, curl,
 * Postman and Supertest do not. The distinction decides how a failure is
 * reported: a person gets bounced back into the app with the reason, while an
 * API client keeps the documented JSON envelope and status code — so the 503
 * and 403 contracts stay intact and testable.
 */
function wantsHtml(req: Request): boolean {
  return (req.headers.accept ?? "").includes("text/html");
}

/**
 * Reports a failure the way this caller can use.
 *
 * Returns true when it handled the response; false means the caller should
 * rethrow and let the central error handler produce the JSON envelope.
 */
function reportFailure(req: Request, res: Response, error: unknown): boolean {
  if (!wantsHtml(req)) return false;

  req.log?.warn(
    { err: error instanceof Error ? error.message : error },
    "Google OAuth failed — redirecting to the frontend",
  );
  res.redirect(302, googleAuthService.buildFrontendErrorRedirect(error));
  return true;
}

function stateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // `lax`, not `strict`: the callback arrives as a top-level navigation from
    // accounts.google.com, and a strict cookie would not be sent with it — the
    // flow would fail every time with a state mismatch.
    sameSite: "lax",
    secure: env.isProduction,
    maxAge: STATE_TTL_MS,
    path: "/auth",
  };
}

/**
 * `GET /auth/google` — start the flow.
 *
 * Mints a random state, parks it in a short-lived httpOnly cookie, and redirects
 * to Google with the same value in the query. Only a browser that holds the
 * cookie can complete the callback, which is what makes a forged callback URL
 * useless.
 */
export const googleRedirect = catchAsync(async (req: Request, res: Response) => {
  try {
    googleAuthService.assertConfigured();
  } catch (error) {
    // A user who clicks "Continue with Google" on a deployment without the keys
    // gets sent back to the login page, not left staring at a JSON error.
    if (reportFailure(req, res, error)) return;
    throw error;
  }

  const state = googleAuthService.createState();
  res.cookie(STATE_COOKIE, state, stateCookieOptions());

  req.log?.info("Starting Google OAuth flow");
  res.redirect(302, googleAuthService.buildAuthUrl(state));
});

/**
 * `GET /auth/google/callback` — finish the flow.
 *
 * Verifies state, exchanges the code server-side, upserts the account, then
 * hands our own tokens to the frontend in the URL fragment.
 */
export const googleCallback = catchAsync(async (req: Request, res: Response) => {
  // Everything here is wrapped so that *every* failure mode — unconfigured,
  // cancelled consent, bad state, a rejected code exchange, even a duplicate-key
  // collision on upsert — lands the person back on the login page rather than on
  // a JSON error document. API clients still get the envelope (see wantsHtml).
  try {
    googleAuthService.assertConfigured();

    const { code, state, error: providerError } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const cookieState = readCookie(req, STATE_COOKIE);
    // One-shot: clear it before doing anything else so a replay of this URL
    // cannot reuse the same state, even if the exchange below fails.
    res.clearCookie(STATE_COOKIE, { ...stateCookieOptions(), maxAge: undefined });

    // The user pressed "cancel" on the consent screen, or Google refused.
    if (providerError) {
      throw AppError.unauthorized(
        `Google sign-in was cancelled or refused (${providerError})`,
      );
    }

    if (!state || !cookieState || !googleAuthService.statesMatch(state, cookieState)) {
      // 403, not 401: the request carried no credential to be wrong about.
      // Either the cookie expired or this callback did not originate from our
      // redirect.
      throw AppError.forbidden(
        "Invalid OAuth state. Start again from the sign-in page.",
      );
    }

    if (!code) {
      throw AppError.badRequest("Google did not return an authorization code");
    }

    const { user, tokens, isNewUser } =
      await googleAuthService.completeGoogleSignIn(code);

    req.log?.info(
      { userId: user._id.toString(), isNewUser },
      "Google sign-in complete",
    );

    res.redirect(302, googleAuthService.buildFrontendRedirect(tokens));
  } catch (error) {
    if (reportFailure(req, res, error)) return;
    throw error;
  }
});
