import express from "express";
import request from "supertest";
import { z } from "zod";
import { errorHandler } from "../../middlewares/errorHandler";
import { validate } from "../../middlewares/validate";

/** Minimal app that echoes back whatever the middleware left on the request. */
function buildApp(
  schema: z.ZodType,
  source: "body" | "query" | "params",
  path = "/",
) {
  const app = express();
  app.use(express.json());
  app.all(path, validate(schema, source), (req, res) => {
    res.json({ received: req[source] });
  });
  app.use(errorHandler);
  return app;
}

describe("validate middleware", () => {
  describe("body", () => {
    const schema = z.object({
      title: z.string().min(1),
      position: z.number().int().min(0),
    });

    it("passes valid payloads through", async () => {
      const res = await request(buildApp(schema, "body"))
        .post("/")
        .send({ title: "Todo", position: 0 })
        .expect(200);

      expect(res.body.received).toEqual({ title: "Todo", position: 0 });
    });

    it("strips keys not present in the schema", async () => {
      const res = await request(buildApp(schema, "body"))
        .post("/")
        .send({ title: "Todo", position: 0, isAdmin: true })
        .expect(200);

      expect(res.body.received).not.toHaveProperty("isAdmin");
    });

    it("returns 400 with a details entry per failed field", async () => {
      const res = await request(buildApp(schema, "body"))
        .post("/")
        .send({ position: -1 })
        .expect(400);

      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "title" }),
          expect.objectContaining({ field: "position" }),
        ]),
      );
      expect(res.body.details).toHaveLength(2);
    });

    it("joins nested paths with dots", async () => {
      const nested = z.object({
        subtasks: z.array(z.object({ title: z.string() })),
      });

      const res = await request(buildApp(nested, "body"))
        .post("/")
        .send({ subtasks: [{ title: "ok" }, { title: 42 }] })
        .expect(400);

      expect(res.body.details[0].field).toBe("subtasks.1.title");
    });

    it("falls back to the source name when the whole payload is wrong", async () => {
      const res = await request(buildApp(schema, "body"))
        .post("/")
        .send([1, 2, 3])
        .expect(400);

      expect(res.body.details[0].field).toBe("body");
    });
  });

  describe("query", () => {
    // Express 5 exposes req.query as a getter with no setter, so writing the
    // parsed result back has to go through defineProperty. This is the
    // regression guard for that.
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });

    it("replaces req.query with the coerced result", async () => {
      const res = await request(buildApp(schema, "query"))
        .get("/?page=3&limit=50")
        .expect(200);

      expect(res.body.received).toEqual({ page: 3, limit: 50 });
    });

    it("applies defaults when params are absent", async () => {
      const res = await request(buildApp(schema, "query")).get("/").expect(200);

      expect(res.body.received).toEqual({ page: 1, limit: 20 });
    });

    it("rejects out-of-range values", async () => {
      const res = await request(buildApp(schema, "query"))
        .get("/?limit=500")
        .expect(400);

      expect(res.body.details).toEqual([
        expect.objectContaining({ field: "limit" }),
      ]);
    });
  });

  describe("params", () => {
    const schema = z.object({
      id: z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId"),
    });

    it("accepts a well-formed ObjectId", async () => {
      const res = await request(buildApp(schema, "params", "/:id"))
        .get("/507f1f77bcf86cd799439011")
        .expect(200);

      expect(res.body.received.id).toBe("507f1f77bcf86cd799439011");
    });

    it("rejects a malformed id with the schema's message", async () => {
      const res = await request(buildApp(schema, "params", "/:id"))
        .get("/not-an-id")
        .expect(400);

      expect(res.body.details).toEqual([
        { field: "id", message: "Must be a valid ObjectId" },
      ]);
    });
  });
});
