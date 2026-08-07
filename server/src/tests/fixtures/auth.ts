import type { Express } from "express";
import request from "supertest";
import { User, type UserRole } from "../../models/User";

export const TEST_PASSWORD = "supersecret123";

export interface AuthedUser {
  token: string;
  refreshToken: string;
  password: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    themePreference: string;
  };
  /** Ready to spread into `.set(...)`. */
  authHeader: { Authorization: string };
}

export interface RegisterOverrides {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

let sequence = 0;

/**
 * Registers a user through the real endpoint and returns their tokens.
 *
 * `role` is applied straight to the document afterwards - there is no
 * self-promotion endpoint, by design. No re-login is needed because
 * `restrictTo` reads the role from the freshly loaded user, not from the JWT.
 */
export async function registerAndLogin(
  app: Express,
  overrides: RegisterOverrides = {},
): Promise<AuthedUser> {
  sequence += 1;

  const credentials = {
    name: overrides.name ?? `Test User ${sequence}`,
    email: overrides.email ?? `user-${sequence}-${Date.now()}@example.com`,
    password: overrides.password ?? TEST_PASSWORD,
  };

  const res = await request(app).post("/auth/register").send(credentials);

  if (res.status !== 201) {
    throw new Error(
      `registerAndLogin failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  const { user, accessToken, refreshToken } = res.body.data;

  if (overrides.role && overrides.role !== user.role) {
    await User.findByIdAndUpdate(user.id, { role: overrides.role });
    user.role = overrides.role;
  }

  return {
    token: accessToken,
    refreshToken,
    password: credentials.password,
    user,
    authHeader: { Authorization: `Bearer ${accessToken}` },
  };
}

export default registerAndLogin;
