import request from "supertest";
import app from "../../app";
import { env } from "../../config/env";
import { User } from "../../models/User";
import { STATE_COOKIE } from "../../services/googleAuthService";
import { registerAndLogin } from "../fixtures/auth";

/**
 * The GOOGLE_* keys are deliberately unset in the test environment, so the
 * "not configured" path is the default and needs no setup. Everything else
 * switches them on per-block with `jest.replaceProperty`, which restores
 * automatically between tests.
 */
function configureOAuth() {
  jest.replaceProperty(env, "GOOGLE_CLIENT_ID", "test-client-id");
  jest.replaceProperty(env, "GOOGLE_CLIENT_SECRET", "test-client-secret");
  jest.replaceProperty(
    env,
    "GOOGLE_REDIRECT_URI",
    "http://localhost:5050/auth/google/callback",
  );
  jest.replaceProperty(env, "googleOAuthEnabled", true);
}

/** Pulls the state value out of the Set-Cookie header. */
function stateFromResponse(res: request.Response): string {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith(`${STATE_COOKIE}=`));
  if (!cookie) throw new Error("no state cookie was set");

  return decodeURIComponent(cookie.split(";")[0].split("=")[1]);
}

/** Stands in for Google's token + userinfo endpoints. */
function mockGoogle(profile: Record<string, unknown>, options: {
  tokenStatus?: number;
  userinfoStatus?: number;
  accessToken?: string | null;
} = {}) {
  const fetchMock = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void init;
    const target = String(url);

    if (target.includes("oauth2.googleapis.com/token")) {
      const status = options.tokenStatus ?? 200;
      if (status !== 200) {
        return new Response("invalid_grant", { status });
      }
      const accessToken =
        options.accessToken === undefined ? "google-access-token" : options.accessToken;
      return new Response(
        JSON.stringify(accessToken === null ? {} : { access_token: accessToken }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (target.includes("userinfo")) {
      const status = options.userinfoStatus ?? 200;
      if (status !== 200) return new Response("nope", { status });

      return new Response(JSON.stringify(profile), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`unexpected fetch to ${target}`);
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const REAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = REAL_FETCH;
});

describe("GET /auth/google - not configured", () => {
  it("returns 503 with the documented message", async () => {
    const res = await request(app).get("/auth/google").expect(503);

    expect(res.body).toEqual({ status: "error", message: "OAuth not configured" });
  });

  it("does not set a state cookie", async () => {
    const res = await request(app).get("/auth/google").expect(503);

    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("returns 503 on the callback too", async () => {
    const res = await request(app)
      .get("/auth/google/callback?code=x&state=y")
      .expect(503);

    expect(res.body.message).toBe("OAuth not configured");
  });

  it("leaves email/password auth working", async () => {
    // The whole point of the optional keys: the app is fully usable without them.
    const { token } = await registerAndLogin(app);

    await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });
});

describe("GET /auth/google - redirect", () => {
  beforeEach(configureOAuth);

  it("302s to Google's consent screen with the expected parameters", async () => {
    const res = await request(app).get("/auth/google").expect(302);

    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5050/auth/google/callback",
    );
    expect(location.searchParams.get("state")).toBeTruthy();
  });

  it("never puts the client secret in the redirect", async () => {
    const res = await request(app).get("/auth/google").expect(302);

    expect(res.headers.location).not.toContain("test-client-secret");
  });

  it("sets the state as a short-lived httpOnly cookie", async () => {
    const res = await request(app).get("/auth/google").expect(302);

    const raw = res.headers["set-cookie"] as unknown as string[];
    const cookie = raw.find((entry) => entry.startsWith(`${STATE_COOKIE}=`))!;

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=600");
    // Not Secure outside production, or it would never be sent over plain http.
    expect(cookie).not.toContain("Secure");
  });

  it("puts the same state in the cookie and the query", async () => {
    const res = await request(app).get("/auth/google").expect(302);

    const queryState = new URL(res.headers.location).searchParams.get("state");
    expect(queryState).toBe(stateFromResponse(res));
  });

  it("mints a fresh state on every request", async () => {
    const first = await request(app).get("/auth/google").expect(302);
    const second = await request(app).get("/auth/google").expect(302);

    expect(stateFromResponse(first)).not.toBe(stateFromResponse(second));
  });
});

describe("GET /auth/google/callback - state verification", () => {
  beforeEach(configureOAuth);

  it("403s when the state does not match the cookie", async () => {
    const start = await request(app).get("/auth/google").expect(302);
    const state = stateFromResponse(start);

    const res = await request(app)
      .get(`/auth/google/callback?code=abc&state=${state}-tampered`)
      .set("Cookie", `${STATE_COOKIE}=${state}`)
      .expect(403);

    expect(res.body.status).toBe("error");
    expect(res.body.message).toMatch(/Invalid OAuth state/);
  });

  it("403s when the cookie is missing entirely", async () => {
    // The cookie expired, or this callback URL was replayed from somewhere else.
    const res = await request(app)
      .get("/auth/google/callback?code=abc&state=some-state")
      .expect(403);

    expect(res.body.message).toMatch(/Invalid OAuth state/);
  });

  it("403s when the state parameter is absent", async () => {
    const res = await request(app)
      .get("/auth/google/callback?code=abc")
      .set("Cookie", `${STATE_COOKIE}=whatever`)
      .expect(403);

    expect(res.body.message).toMatch(/Invalid OAuth state/);
  });

  it("never reaches Google when the state is wrong", async () => {
    const fetchMock = mockGoogle({ sub: "g-1", email: "a@b.com" });

    await request(app)
      .get("/auth/google/callback?code=abc&state=mismatch")
      .set("Cookie", `${STATE_COOKIE}=different`)
      .expect(403);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the state cookie even on a rejected callback", async () => {
    // One-shot: a replay of the same URL must not be able to reuse the state.
    const res = await request(app)
      .get("/auth/google/callback?code=abc&state=mismatch")
      .set("Cookie", `${STATE_COOKIE}=different`)
      .expect(403);

    const raw = res.headers["set-cookie"] as unknown as string[];
    expect(raw.some((entry) => entry.startsWith(`${STATE_COOKIE}=;`))).toBe(true);
  });

  it("400s when the state is valid but no code came back", async () => {
    const start = await request(app).get("/auth/google").expect(302);
    const state = stateFromResponse(start);

    const res = await request(app)
      .get(`/auth/google/callback?state=${state}`)
      .set("Cookie", `${STATE_COOKIE}=${state}`)
      .expect(400);

    expect(res.body.message).toMatch(/did not return an authorization code/);
  });

  it("401s when the user cancelled the consent screen", async () => {
    const res = await request(app)
      .get("/auth/google/callback?error=access_denied&state=x")
      .set("Cookie", `${STATE_COOKIE}=x`)
      .expect(401);

    expect(res.body.message).toMatch(/cancelled or refused/);
  });
});

describe("GET /auth/google/callback - successful sign-in", () => {
  beforeEach(configureOAuth);

  /** Drives a full callback with a valid state. */
  async function completeFlow() {
    const start = await request(app).get("/auth/google").expect(302);
    const state = stateFromResponse(start);

    return request(app)
      .get(`/auth/google/callback?code=valid-code&state=${state}`)
      .set("Cookie", `${STATE_COOKIE}=${state}`);
  }

  it("creates the account, then 302s to the frontend with tokens in the hash", async () => {
    mockGoogle({
      sub: "google-sub-1",
      email: "newcomer@example.com",
      email_verified: true,
      name: "New Comer",
    });

    const res = await completeFlow();
    expect(res.status).toBe(302);

    const location = res.headers.location as string;
    expect(location.startsWith(`${env.FRONTEND_URL}/login#`)).toBe(true);

    // A fragment, not a query string - tokens must never reach a server log.
    expect(location).not.toContain("?token=");

    const fragment = new URLSearchParams(location.split("#")[1]);
    expect(fragment.get("token")).toMatch(/^eyJ/);
    expect(fragment.get("refresh")).toMatch(/^eyJ/);
  });

  it("issues our own JWTs, usable on /auth/me", async () => {
    mockGoogle({
      sub: "google-sub-2",
      email: "usable@example.com",
      email_verified: true,
      name: "Usable Token",
    });

    const res = await completeFlow();
    const token = new URLSearchParams(res.headers.location.split("#")[1]).get("token")!;

    const me = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(me.body.data.user.email).toBe("usable@example.com");
  });

  it("creates the user as an editor with no password", async () => {
    mockGoogle({
      sub: "google-sub-3",
      email: "editor-role@example.com",
      email_verified: true,
      name: "Editor Role",
    });

    await completeFlow();

    const user = await User.findOne({ email: "editor-role@example.com" }).select("+password");
    expect(user?.role).toBe("editor");
    expect(user?.googleId).toBe("google-sub-3");
    expect(user?.password).toBeUndefined();
  });

  it("sends the code and the client secret to Google's token endpoint", async () => {
    const fetchMock = mockGoogle({
      sub: "google-sub-4",
      email: "exchange@example.com",
      email_verified: true,
    });

    await completeFlow();

    const tokenCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("oauth2.googleapis.com/token"),
    )!;
    const body = tokenCall[1]?.body as URLSearchParams;

    expect(body.get("code")).toBe("valid-code");
    expect(body.get("client_secret")).toBe("test-client-secret");
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("falls back to the email local-part when Google sends no name", async () => {
    mockGoogle({
      sub: "google-sub-5",
      email: "nameless@example.com",
      email_verified: true,
    });

    await completeFlow();

    const user = await User.findOne({ email: "nameless@example.com" });
    expect(user?.name).toBe("nameless");
  });

  it("stores the Google picture as the avatar", async () => {
    mockGoogle({
      sub: "google-sub-6",
      email: "pictured@example.com",
      email_verified: true,
      name: "Pictured",
      picture: "https://lh3.googleusercontent.com/a/abc123",
    });

    await completeFlow();

    const user = await User.findOne({ email: "pictured@example.com" });
    expect(user?.avatar).toBe("https://lh3.googleusercontent.com/a/abc123");
  });
});

describe("GET /auth/google/callback - account upsert", () => {
  beforeEach(configureOAuth);

  async function completeFlow() {
    const start = await request(app).get("/auth/google").expect(302);
    const state = stateFromResponse(start);

    return request(app)
      .get(`/auth/google/callback?code=valid-code&state=${state}`)
      .set("Cookie", `${STATE_COOKIE}=${state}`);
  }

  it("matches an existing account by googleId, without creating a second", async () => {
    const profile = {
      sub: "returning-sub",
      email: "returning@example.com",
      email_verified: true,
      name: "Returning User",
    };

    mockGoogle(profile);
    await completeFlow();

    // Second sign-in, same googleId but a changed email - sub is what matters.
    mockGoogle({ ...profile, email: "changed@example.com" });
    await completeFlow();

    expect(await User.countDocuments({ googleId: "returning-sub" })).toBe(1);
    const user = await User.findOne({ googleId: "returning-sub" });
    // The original record is reused, so the email is not silently rewritten.
    expect(user?.email).toBe("returning@example.com");
  });

  it("links Google to an existing password account on a verified email", async () => {
    const existing = await registerAndLogin(app, { email: "linkme@example.com" });

    mockGoogle({
      sub: "link-sub",
      email: "linkme@example.com",
      email_verified: true,
      name: "Link Me",
    });

    await completeFlow();

    // Still one account - signing in with Google did not create a duplicate.
    expect(await User.countDocuments({ email: "linkme@example.com" })).toBe(1);
    const user = await User.findById(existing.user.id).select("+password");
    expect(user?.googleId).toBe("link-sub");
    // The password still works: linking adds a sign-in method, it does not
    // replace the existing one.
    expect(user?.password).toBeDefined();
  });

  it("lets the linked account still sign in with its password", async () => {
    const existing = await registerAndLogin(app, { email: "bothways@example.com" });

    mockGoogle({
      sub: "bothways-sub",
      email: "bothways@example.com",
      email_verified: true,
    });
    await completeFlow();

    await request(app)
      .post("/auth/login")
      .send({ email: "bothways@example.com", password: existing.password })
      .expect(200);
  });

  it("does NOT link on an unverified email - it creates a separate account", async () => {
    // Linking on an unverified address would let anyone who can get Google to
    // emit someone else's email take over that account.
    await registerAndLogin(app, { email: "victim@example.com" });

    mockGoogle({
      sub: "attacker-sub",
      email: "victim@example.com",
      email_verified: false,
      name: "Not The Victim",
    });

    const res = await completeFlow();

    // The unique email index refuses the second account, so the flow fails
    // rather than taking anything over.
    expect(res.status).toBe(409);

    const victim = await User.findOne({ email: "victim@example.com" });
    expect(victim?.googleId).toBeUndefined();
  });
});

describe("browser failures redirect instead of showing JSON", () => {
  /** What a browser sends on a top-level navigation. */
  const BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

  /** Parses the `#error=…` fragment off a redirect Location. */
  function fragmentOf(location: string): URLSearchParams {
    return new URLSearchParams(location.split("#")[1] ?? "");
  }

  describe("with OAuth unconfigured", () => {
    it("sends a browser back to the login page with a reason", async () => {
      const res = await request(app)
        .get("/auth/google")
        .set("Accept", BROWSER_ACCEPT)
        .expect(302);

      const location = res.headers.location as string;
      expect(location.startsWith(`${env.FRONTEND_URL}/login#`)).toBe(true);

      const fragment = fragmentOf(location);
      expect(fragment.get("error")).toBe("oauth_not_configured");
      expect(fragment.get("error_description")).toBe("OAuth not configured");
    });

    it("still returns the JSON envelope to an API client", async () => {
      // The documented 503 contract is unchanged for Postman, curl and tests.
      const res = await request(app)
        .get("/auth/google")
        .set("Accept", "application/json")
        .expect(503);

      expect(res.body.message).toBe("OAuth not configured");
    });

    it("redirects the callback for a browser too", async () => {
      const res = await request(app)
        .get("/auth/google/callback?code=x&state=y")
        .set("Accept", BROWSER_ACCEPT)
        .expect(302);

      expect(fragmentOf(res.headers.location).get("error")).toBe(
        "oauth_not_configured",
      );
    });
  });

  describe("with OAuth configured", () => {
    beforeEach(configureOAuth);

    it("redirects a browser on a state mismatch, tagged invalid_state", async () => {
      const res = await request(app)
        .get("/auth/google/callback?code=abc&state=forged")
        .set("Cookie", `${STATE_COOKIE}=real`)
        .set("Accept", BROWSER_ACCEPT)
        .expect(302);

      const fragment = fragmentOf(res.headers.location);
      expect(fragment.get("error")).toBe("invalid_state");
      expect(fragment.get("error_description")).toMatch(/Invalid OAuth state/);
    });

    it("keeps the 403 JSON envelope for an API client", async () => {
      const res = await request(app)
        .get("/auth/google/callback?code=abc&state=forged")
        .set("Cookie", `${STATE_COOKIE}=real`)
        .set("Accept", "application/json")
        .expect(403);

      expect(res.body.message).toMatch(/Invalid OAuth state/);
    });

    it("redirects a browser when the user cancels consent", async () => {
      const res = await request(app)
        .get("/auth/google/callback?error=access_denied&state=x")
        .set("Cookie", `${STATE_COOKIE}=x`)
        .set("Accept", BROWSER_ACCEPT)
        .expect(302);

      expect(fragmentOf(res.headers.location).get("error_description")).toMatch(
        /cancelled or refused/,
      );
    });

    it("redirects a browser when Google rejects the code exchange", async () => {
      mockGoogle({}, { tokenStatus: 400 });

      const start = await request(app).get("/auth/google").expect(302);
      const state = stateFromResponse(start);

      const res = await request(app)
        .get(`/auth/google/callback?code=bad&state=${state}`)
        .set("Cookie", `${STATE_COOKIE}=${state}`)
        .set("Accept", BROWSER_ACCEPT)
        .expect(302);

      const fragment = fragmentOf(res.headers.location);
      expect(fragment.get("error")).toBe("oauth_failed");
      // Google's raw error text must not be forwarded to the browser.
      expect(fragment.get("error_description")).not.toContain("invalid_grant");
    });

    it("never puts a token in the fragment on a failure", async () => {
      const res = await request(app)
        .get("/auth/google/callback?code=abc&state=forged")
        .set("Cookie", `${STATE_COOKIE}=real`)
        .set("Accept", BROWSER_ACCEPT)
        .expect(302);

      const fragment = fragmentOf(res.headers.location);
      expect(fragment.get("token")).toBeNull();
      expect(fragment.get("refresh")).toBeNull();
    });

    it("does not leak an internal message when the failure is a bug", async () => {
      // A non-AppError must not have its message forwarded - it could carry
      // driver strings or file paths.
      global.fetch = (() => {
        throw new Error("ECONNREFUSED 10.0.0.5:443 internal-detail");
      }) as unknown as typeof fetch;

      const start = await request(app).get("/auth/google").expect(302);
      const state = stateFromResponse(start);

      const res = await request(app)
        .get(`/auth/google/callback?code=abc&state=${state}`)
        .set("Cookie", `${STATE_COOKIE}=${state}`)
        .set("Accept", BROWSER_ACCEPT)
        .expect(302);

      const description = fragmentOf(res.headers.location).get("error_description")!;
      expect(description).toBe("Google sign-in failed. Please try again.");
      expect(description).not.toContain("ECONNREFUSED");
    });

    it("still redirects a browser to the app on success", async () => {
      mockGoogle({
        sub: "browser-success",
        email: "browser@example.com",
        email_verified: true,
        name: "Browser User",
      });

      const start = await request(app).get("/auth/google").expect(302);
      const state = stateFromResponse(start);

      const res = await request(app)
        .get(`/auth/google/callback?code=valid&state=${state}`)
        .set("Cookie", `${STATE_COOKIE}=${state}`)
        .set("Accept", BROWSER_ACCEPT)
        .expect(302);

      const fragment = fragmentOf(res.headers.location);
      expect(fragment.get("token")).toMatch(/^eyJ/);
      expect(fragment.get("error")).toBeNull();
    });
  });
});

describe("GET /auth/google/callback - Google-side failures", () => {
  beforeEach(configureOAuth);

  async function completeFlow() {
    const start = await request(app).get("/auth/google").expect(302);
    const state = stateFromResponse(start);

    return request(app)
      .get(`/auth/google/callback?code=valid-code&state=${state}`)
      .set("Cookie", `${STATE_COOKIE}=${state}`);
  }

  it("401s when the token exchange is rejected", async () => {
    mockGoogle({}, { tokenStatus: 400 });

    const res = await completeFlow();

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Google sign-in failed/);
    // Google's own error text must not be echoed to the client.
    expect(res.body.message).not.toContain("invalid_grant");
  });

  it("401s when the token response carries no access_token", async () => {
    mockGoogle({}, { accessToken: null });

    const res = await completeFlow();
    expect(res.status).toBe(401);
  });

  it("401s when userinfo fails", async () => {
    mockGoogle({}, { userinfoStatus: 401 });

    const res = await completeFlow();

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Could not read your Google profile/);
  });

  it("401s when the profile has no email", async () => {
    mockGoogle({ sub: "no-email-sub" });

    const res = await completeFlow();

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/did not return an email address/);
  });

  it("creates nothing when the profile is unusable", async () => {
    const before = await User.countDocuments();
    mockGoogle({ sub: "no-email-sub-2" });

    await completeFlow();

    expect(await User.countDocuments()).toBe(before);
  });
});
