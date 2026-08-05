import request from "supertest";
import app from "../../app";
import { User } from "../../models/User";
import { registerAndLogin } from "../fixtures/auth";

beforeAll(async () => {
  await User.init();
});

describe("PATCH /users/me", () => {
  it("updates the name", async () => {
    const { authHeader, user } = await registerAndLogin(app);

    const res = await request(app)
      .patch("/users/me")
      .set(authHeader)
      .send({ name: "Renamed" })
      .expect(200);

    expect(res.body.data.user.name).toBe("Renamed");
    expect(res.body.data.user.id).toBe(user.id);
  });

  it("persists themePreference so the theme survives logout and login", async () => {
    const { authHeader, user, password } = await registerAndLogin(app);

    await request(app)
      .patch("/users/me")
      .set(authHeader)
      .send({ themePreference: "dark" })
      .expect(200);

    const relogin = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password })
      .expect(200);

    expect(relogin.body.data.user.themePreference).toBe("dark");
  });

  it("updates the avatar", async () => {
    const { authHeader } = await registerAndLogin(app);

    const res = await request(app)
      .patch("/users/me")
      .set(authHeader)
      .send({ avatar: "data:image/png;base64,iVBORw0KGgo=" })
      .expect(200);

    expect(res.body.data.user.avatar).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("accepts several fields at once", async () => {
    const { authHeader } = await registerAndLogin(app);

    const res = await request(app)
      .patch("/users/me")
      .set(authHeader)
      .send({ name: "Both", themePreference: "dark" })
      .expect(200);

    expect(res.body.data.user).toMatchObject({ name: "Both", themePreference: "dark" });
  });

  it("never returns the password", async () => {
    const { authHeader } = await registerAndLogin(app);

    const res = await request(app)
      .patch("/users/me")
      .set(authHeader)
      .send({ name: "Nope" })
      .expect(200);

    expect(res.body.data.user).not.toHaveProperty("password");
  });

  describe("validation", () => {
    it("rejects a themePreference outside the enum", async () => {
      const { authHeader } = await registerAndLogin(app);

      const res = await request(app)
        .patch("/users/me")
        .set(authHeader)
        .send({ themePreference: "solarized" })
        .expect(400);

      expect(res.body.details).toEqual([
        { field: "themePreference", message: "Theme preference must be either light or dark" },
      ]);
    });

    it("rejects an empty body", async () => {
      const { authHeader } = await registerAndLogin(app);

      const res = await request(app).patch("/users/me").set(authHeader).send({}).expect(400);

      expect(res.body.message).toBe("Validation failed");
      expect(res.body.details[0].message).toMatch(/at least one of/i);
    });

    it("rejects an empty name", async () => {
      const { authHeader } = await registerAndLogin(app);

      const res = await request(app)
        .patch("/users/me")
        .set(authHeader)
        .send({ name: "   " })
        .expect(400);

      expect(res.body.details).toEqual([
        expect.objectContaining({ field: "name" }),
      ]);
    });
  });

  describe("privilege escalation", () => {
    it("silently drops a role field instead of applying it", async () => {
      const { authHeader, user } = await registerAndLogin(app);

      await request(app)
        .patch("/users/me")
        .set(authHeader)
        .send({ name: "Sneaky", role: "admin" })
        .expect(200);

      const stored = await User.findById(user.id);
      expect(stored!.role).toBe("editor");
    });

    it("does not let a client overwrite the password hash", async () => {
      const { authHeader, user, password } = await registerAndLogin(app);

      await request(app)
        .patch("/users/me")
        .set(authHeader)
        .send({ name: "Still Me", password: "hijacked-password" })
        .expect(200);

      // The original password must still work, and the injected one must not.
      await request(app)
        .post("/auth/login")
        .send({ email: user.email, password })
        .expect(200);

      await request(app)
        .post("/auth/login")
        .send({ email: user.email, password: "hijacked-password" })
        .expect(401);
    });

    it("cannot bump another user's tokenVersion", async () => {
      const { authHeader } = await registerAndLogin(app);
      const victim = await registerAndLogin(app);

      await request(app)
        .patch("/users/me")
        .set(authHeader)
        .send({ name: "x", tokenVersion: 99 })
        .expect(200);

      const stored = await User.findById(victim.user.id);
      expect(stored!.tokenVersion).toBe(0);
    });
  });

  it("requires authentication", async () => {
    await request(app).patch("/users/me").send({ name: "Anon" }).expect(401);
  });
});

describe("GET /users", () => {
  it("returns every user for an admin", async () => {
    await registerAndLogin(app);
    await registerAndLogin(app);
    const admin = await registerAndLogin(app, { role: "admin" });

    const res = await request(app).get("/users").set(admin.authHeader).expect(200);

    expect(res.body.status).toBe("success");
    expect(res.body.data.count).toBe(3);
    expect(res.body.data.users).toHaveLength(3);
    expect(res.body.data.users[0]).not.toHaveProperty("password");
  });

  it("returns 403 for an editor — authenticated but not permitted", async () => {
    const editor = await registerAndLogin(app, { role: "editor" });

    const res = await request(app).get("/users").set(editor.authHeader).expect(403);

    expect(res.body.status).toBe("error");
    expect(res.body.message).toMatch(/permission/i);
  });

  it("returns 403 for a viewer", async () => {
    const viewer = await registerAndLogin(app, { role: "viewer" });

    await request(app).get("/users").set(viewer.authHeader).expect(403);
  });

  it("returns 401 — not 403 — when no token is supplied", async () => {
    const res = await request(app).get("/users").expect(401);

    expect(res.body.message).toMatch(/not logged in/i);
  });

  it("uses the stored role, not the role baked into the token", async () => {
    // Token minted while the user was an editor.
    const editor = await registerAndLogin(app);
    await request(app).get("/users").set(editor.authHeader).expect(403);

    // Promotion happens in the database; the old token must now pass.
    await User.findByIdAndUpdate(editor.user.id, { role: "admin" });
    await request(app).get("/users").set(editor.authHeader).expect(200);
  });
});
