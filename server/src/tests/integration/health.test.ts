import request from "supertest";
import app from "../../app";

describe("GET /health", () => {
  it("names the database it is connected to", async () => {
    // "connected" alone hid a connection string with no path, which silently
    // used `test` instead of the intended database. The name makes that
    // visible from the outside.
    const res = await request(app).get("/health").expect(200);

    expect(res.body.data.databaseName).toBeTruthy();
    expect(res.body.data.databaseName).not.toBe("(none)");
  });

  it("reports ok with uptime and timestamp while the DB is connected", async () => {
    const res = await request(app).get("/health").expect(200);

    expect(res.body.status).toBe("success");
    expect(res.body.data).toMatchObject({
      status: "ok",
      environment: "test",
      database: "connected",
    });
    expect(typeof res.body.data.uptime).toBe("number");
    expect(new Date(res.body.data.timestamp).toString()).not.toBe("Invalid Date");
  });
});

describe("404 handler", () => {
  it("returns the error envelope naming the original URL", async () => {
    const res = await request(app).get("/does/not/exist?x=1").expect(404);

    expect(res.body).toEqual({
      status: "error",
      message: "Cannot GET /does/not/exist?x=1",
    });
  });

  it("distinguishes methods on the same path", async () => {
    const res = await request(app).delete("/health").expect(404);

    expect(res.body.message).toBe("Cannot DELETE /health");
  });
});

describe("error handler", () => {
  it("returns 400 with a clean message for malformed JSON", async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send('{"broken":')
      .expect(400);

    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Malformed JSON in request body");
  });
});
