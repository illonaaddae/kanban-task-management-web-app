import express, { type Express, type Request, type Response } from "express";
import mongoose from "mongoose";
import request from "supertest";
import { z } from "zod";
import { env } from "../../config/env";
import { errorHandler } from "../../middlewares/errorHandler";
import { AppError } from "../../utils/AppError";

/** App whose single route throws whatever the test hands it. */
function appThrowing(error: unknown): Express {
  const app = express();
  app.use(express.json());
  app.get("/", (_req: Request, _res: Response) => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler — AppError", () => {
  it("uses the status code and message as given", async () => {
    const res = await request(appThrowing(new AppError("Nope", 418))).get("/");

    expect(res.status).toBe(418);
    expect(res.body).toEqual({ status: "error", message: "Nope" });
  });

  it("passes through the details array", async () => {
    const error = AppError.badRequest("Validation failed", [
      { field: "title", message: "Required" },
    ]);

    const res = await request(appThrowing(error)).get("/").expect(400);

    expect(res.body.details).toEqual([{ field: "title", message: "Required" }]);
  });

  it("omits details when there are none", async () => {
    const res = await request(appThrowing(AppError.notFound())).get("/").expect(404);

    expect(res.body).not.toHaveProperty("details");
  });
});

describe("errorHandler — mapped library errors", () => {
  it("maps a ZodError that escaped the validate middleware to 400", async () => {
    const parsed = z.object({ title: z.string() }).safeParse({ title: 1 });
    const res = await request(appThrowing(parsed.error)).get("/").expect(400);

    expect(res.body.message).toBe("Validation failed");
    expect(res.body.details).toEqual([
      expect.objectContaining({ field: "title" }),
    ]);
  });

  it("labels a root-level ZodError issue as (root)", async () => {
    const parsed = z.object({ title: z.string() }).safeParse("not-an-object");
    const res = await request(appThrowing(parsed.error)).get("/").expect(400);

    expect(res.body.details[0].field).toBe("(root)");
  });

  it("maps a CastError to 400 naming the offending path", async () => {
    const error = new mongoose.Error.CastError("ObjectId", "abc", "boardId");
    const res = await request(appThrowing(error)).get("/").expect(400);

    expect(res.body.message).toBe("Invalid value for 'boardId'");
    expect(res.body.details).toEqual([
      { field: "boardId", message: "'abc' is not a valid ObjectId" },
    ]);
  });

  it("maps a mongoose ValidationError to 400 with one detail per path", async () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      "title",
      new mongoose.Error.ValidatorError({ path: "title", message: "Title is required" }),
    );
    error.addError(
      "position",
      new mongoose.Error.ValidatorError({ path: "position", message: "Too small" }),
    );

    const res = await request(appThrowing(error)).get("/").expect(400);

    expect(res.body.message).toBe("Validation failed");
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        { field: "title", message: "Title is required" },
        { field: "position", message: "Too small" },
      ]),
    );
  });

  it("maps a duplicate-key violation to 409 naming the field", async () => {
    const error = Object.assign(new Error("E11000"), {
      code: 11000,
      keyValue: { email: "taken@example.com" },
    });

    const res = await request(appThrowing(error)).get("/").expect(409);

    expect(res.body.message).toBe("A record with that email already exists");
    expect(res.body.details).toEqual([{ field: "email", message: "Must be unique" }]);
  });

  it("falls back to 'field' when a duplicate carries no keyValue", async () => {
    const error = Object.assign(new Error("E11000"), { code: 11000 });
    const res = await request(appThrowing(error)).get("/").expect(409);

    expect(res.body.message).toBe("A record with that field already exists");
  });

  it("maps a JsonWebTokenError to 401", async () => {
    const error = Object.assign(new Error("bad signature"), {
      name: "JsonWebTokenError",
    });

    const res = await request(appThrowing(error)).get("/").expect(401);

    expect(res.body.message).toBe("Invalid token");
  });

  it("maps a TokenExpiredError to 401", async () => {
    const error = Object.assign(new Error("jwt expired"), {
      name: "TokenExpiredError",
    });

    const res = await request(appThrowing(error)).get("/").expect(401);

    expect(res.body.message).toBe("Token has expired");
  });

  it("maps malformed JSON to 400", async () => {
    const app = express();
    app.use(express.json());
    app.post("/", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send("{ not json")
      .expect(400);

    expect(res.body.message).toBe("Malformed JSON in request body");
  });
});

describe("errorHandler — unexpected errors", () => {
  it("returns 500 and includes the stack outside production", async () => {
    const res = await request(appThrowing(new Error("kaboom"))).get("/").expect(500);

    expect(res.body.message).toBe("kaboom");
    expect(res.body.stack).toBeDefined();
  });

  it("handles a thrown non-Error value", async () => {
    const res = await request(appThrowing("just a string")).get("/").expect(500);

    expect(res.body.status).toBe("error");
  });

  describe("in production", () => {
    beforeEach(() => {
      jest.replaceProperty(env, "isProduction", true);
    });

    it("hides the real message behind a generic 500", async () => {
      const res = await request(appThrowing(new Error("connect ECONNREFUSED 10.0.0.1:27017")))
        .get("/")
        .expect(500);

      // A driver string or file path must never reach the client.
      expect(res.body.message).toBe("Something went wrong");
      expect(res.body.stack).toBeUndefined();
    });

    it("still reports operational errors verbatim", async () => {
      const res = await request(appThrowing(AppError.conflict("Email already exists")))
        .get("/")
        .expect(409);

      expect(res.body.message).toBe("Email already exists");
    });
  });
});

describe("errorHandler — headers already sent", () => {
  it("delegates back to Express instead of trying to rewrite the response", () => {
    // Once the status line is flushed there is no way to change it, so the
    // handler must hand the error back and let Express abort the connection.
    const error = new Error("too late");
    const next = jest.fn();
    const res = {
      headersSent: true,
      status: jest.fn(),
      json: jest.fn(),
    } as unknown as Response;

    errorHandler(error, { originalUrl: "/late" } as Request, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
