import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../../app";
import { env } from "../../config/env";
import { User } from "../../models/User";
import { registerAndLogin, TEST_PASSWORD } from "../fixtures/auth";

beforeAll(async () => {
  await User.init();
});

const credentials = {
  name: "Illona",
  email: "illona@example.com",
  password: TEST_PASSWORD,
};

describe("POST /auth/register", () => {
  it("creates the account and returns the user with both tokens", async () => {
    const res = await request(app).post("/auth/register").send(credentials).expect(201);

    expect(res.body.status).toBe("success");
    expect(res.body.data.user).toMatchObject({
      name: "Illona",
      email: "illona@example.com",
      role: "editor",
      themePreference: "light",
    });
    expect(res.body.data.user.id).toEqual(expect.any(String));
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(typeof res.body.data.refreshToken).toBe("string");
  });

  it("never returns the password, _id or internal session state", async () => {
    const res = await request(app).post("/auth/register").send(credentials).expect(201);

    expect(res.body.data.user).not.toHaveProperty("password");
    expect(res.body.data.user).not.toHaveProperty("_id");
    expect(res.body.data.user).not.toHaveProperty("__v");
    expect(res.body.data.user).not.toHaveProperty("tokenVersion");
  });

  it("issues an access token carrying only id, role and tokenVersion", async () => {
    const res = await request(app).post("/auth/register").send(credentials).expect(201);

    const payload = jwt.verify(res.body.data.accessToken, env.JWT_SECRET) as Record<
      string,
      unknown
    >;

    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "id", "role", "tokenVersion"]);
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("name");
  });

  it("returns 409 for a duplicate email", async () => {
    await request(app).post("/auth/register").send(credentials).expect(201);

    const res = await request(app).post("/auth/register").send(credentials).expect(409);

    expect(res.body.status).toBe("error");
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("treats email as case-insensitive when detecting duplicates", async () => {
    await request(app).post("/auth/register").send(credentials).expect(201);

    await request(app)
      .post("/auth/register")
      .send({ ...credentials, email: "ILLONA@EXAMPLE.COM" })
      .expect(409);
  });

  describe("validation", () => {
    it("rejects a missing name with a details entry", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: credentials.email, password: TEST_PASSWORD })
        .expect(400);

      expect(res.body.message).toBe("Validation failed");
      expect(res.body.details).toEqual([
        expect.objectContaining({ field: "name" }),
      ]);
    });

    it("rejects a malformed email", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...credentials, email: "not-an-email" })
        .expect(400);

      expect(res.body.details).toEqual([
        { field: "email", message: "Must be a valid email address" },
      ]);
    });

    it("rejects a password shorter than 8 characters", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...credentials, password: "short" })
        .expect(400);

      expect(res.body.details).toEqual([
        { field: "password", message: "Password must be at least 8 characters" },
      ]);
    });

    it("reports every invalid field at once", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ name: "", email: "bad", password: "x" })
        .expect(400);

      expect(res.body.details).toHaveLength(3);
    });

    it("ignores a role supplied by the client", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...credentials, role: "admin" })
        .expect(201);

      expect(res.body.data.user.role).toBe("editor");
    });
  });
});

describe("POST /auth/login", () => {
  it("returns the user and a fresh token pair", async () => {
    await request(app).post("/auth/register").send(credentials).expect(201);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: credentials.email, password: TEST_PASSWORD })
      .expect(200);

    expect(res.body.data.user.email).toBe("illona@example.com");
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(typeof res.body.data.refreshToken).toBe("string");
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  it("accepts a differently-cased email", async () => {
    await request(app).post("/auth/register").send(credentials).expect(201);

    await request(app)
      .post("/auth/login")
      .send({ email: "ILLONA@Example.com", password: TEST_PASSWORD })
      .expect(200);
  });

  describe("generic 401 on every failure", () => {
    it("returns the same message for an unknown email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: TEST_PASSWORD })
        .expect(401);

      expect(res.body).toEqual({ status: "error", message: "Invalid credentials" });
    });

    it("returns the same message for a wrong password", async () => {
      await request(app).post("/auth/register").send(credentials).expect(201);

      const res = await request(app)
        .post("/auth/login")
        .send({ email: credentials.email, password: "wrong-password" })
        .expect(401);

      expect(res.body).toEqual({ status: "error", message: "Invalid credentials" });
    });

    it("returns the same message for a Google-only account", async () => {
      await User.create({
        name: "Google User",
        email: "google@example.com",
        googleId: "google-sub-1",
      });

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "google@example.com", password: TEST_PASSWORD })
        .expect(401);

      expect(res.body).toEqual({ status: "error", message: "Invalid credentials" });
    });

    it("never leaks which half was wrong", async () => {
      await request(app).post("/auth/register").send(credentials).expect(201);

      const [unknownEmail, wrongPassword] = await Promise.all([
        request(app).post("/auth/login").send({ email: "no@example.com", password: "x1234567" }),
        request(app).post("/auth/login").send({ email: credentials.email, password: "x1234567" }),
      ]);

      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });
  });

  it("returns 400 when a field is missing", async () => {
    const res = await request(app).post("/auth/login").send({}).expect(400);

    expect(res.body.details).toHaveLength(2);
  });
});

describe("POST /auth/refresh", () => {
  it("issues a new pair from a valid refresh token", async () => {
    const { refreshToken } = await registerAndLogin(app);

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(200);

    expect(typeof res.body.data.accessToken).toBe("string");
    expect(typeof res.body.data.refreshToken).toBe("string");
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  it("returns an access token that actually works", async () => {
    const { refreshToken } = await registerAndLogin(app);

    const res = await request(app).post("/auth/refresh").send({ refreshToken }).expect(200);

    await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${res.body.data.accessToken}`)
      .expect(200);
  });

  it("rejects an access token used as a refresh token", async () => {
    const { token } = await registerAndLogin(app);

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: token })
      .expect(401);

    expect(res.body.message).toBe("Refresh token is invalid");
  });

  it("rejects a garbled token with 401, not 500", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "not.a.jwt" })
      .expect(401);

    expect(res.body.status).toBe("error");
  });

  it("rejects an expired refresh token with a distinct message", async () => {
    const { user } = await registerAndLogin(app);
    const expired = jwt.sign(
      { id: user.id, role: user.role, tokenVersion: 0 },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "-1s" },
    );

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: expired })
      .expect(401);

    expect(res.body.message).toMatch(/expired/i);
  });

  it("rejects a refresh token whose tokenVersion is stale", async () => {
    const { refreshToken, authHeader } = await registerAndLogin(app);

    await request(app).post("/auth/logout").set(authHeader).expect(200);

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(401);

    expect(res.body.message).toMatch(/no longer valid/i);
  });

  it("rejects a refresh token for a deleted user", async () => {
    const { refreshToken, user } = await registerAndLogin(app);
    await User.findByIdAndDelete(user.id);

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(401);

    expect(res.body.message).toMatch(/no longer exists/i);
  });

  it("returns 400 when refreshToken is absent", async () => {
    const res = await request(app).post("/auth/refresh").send({}).expect(400);

    expect(res.body.details).toEqual([
      expect.objectContaining({ field: "refreshToken" }),
    ]);
  });
});

describe("POST /auth/logout", () => {
  it("bumps tokenVersion and invalidates the existing access token", async () => {
    const { authHeader, user } = await registerAndLogin(app);

    await request(app).get("/auth/me").set(authHeader).expect(200);
    await request(app).post("/auth/logout").set(authHeader).expect(200);

    const after = await User.findById(user.id);
    expect(after!.tokenVersion).toBe(1);

    const res = await request(app).get("/auth/me").set(authHeader).expect(401);
    expect(res.body.message).toMatch(/no longer valid/i);
  });

  it("requires authentication", async () => {
    await request(app).post("/auth/logout").expect(401);
  });
});

describe("GET /auth/me", () => {
  it("returns the current user", async () => {
    const { authHeader, user } = await registerAndLogin(app);

    const res = await request(app).get("/auth/me").set(authHeader).expect(200);

    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  describe("401 messages are distinct per cause", () => {
    it("missing header", async () => {
      const res = await request(app).get("/auth/me").expect(401);
      expect(res.body.message).toMatch(/not logged in/i);
    });

    it("wrong scheme", async () => {
      const { token } = await registerAndLogin(app);
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Basic ${token}`)
        .expect(401);

      expect(res.body.message).toMatch(/not logged in/i);
    });

    it("bare token with no scheme", async () => {
      const { token } = await registerAndLogin(app);
      const res = await request(app).get("/auth/me").set("Authorization", token).expect(401);

      expect(res.body.message).toMatch(/not logged in/i);
    });

    it("garbled token returns 401, never 500", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer this-is-not-a-jwt")
        .expect(401);

      expect(res.body.message).toBe("Token is invalid");
    });

    it("token signed with the wrong secret", async () => {
      const forged = jwt.sign({ id: "x", role: "admin", tokenVersion: 0 }, "an-attacker-secret");

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${forged}`)
        .expect(401);

      expect(res.body.message).toBe("Token is invalid");
    });

    it("token with the right signature but the wrong payload shape", async () => {
      const malformed = jwt.sign({ sub: "no-id-field" }, env.JWT_SECRET);

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${malformed}`)
        .expect(401);

      expect(res.body.message).toBe("Token is invalid");
    });

    it("expired token", async () => {
      const { user } = await registerAndLogin(app);
      const expired = jwt.sign(
        { id: user.id, role: user.role, tokenVersion: 0 },
        env.JWT_SECRET,
        { expiresIn: "-1s" },
      );

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${expired}`)
        .expect(401);

      expect(res.body.message).toMatch(/session has expired/i);
    });

    it("deleted user", async () => {
      const { authHeader, user } = await registerAndLogin(app);
      await User.findByIdAndDelete(user.id);

      const res = await request(app).get("/auth/me").set(authHeader).expect(401);
      expect(res.body.message).toMatch(/no longer exists/i);
    });
  });
});
