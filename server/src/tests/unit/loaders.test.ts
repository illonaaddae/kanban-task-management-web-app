import express from "express";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import request from "supertest";
import { z } from "zod";
import type { ColumnDocument } from "../../models/Column";
import type { TaskDocument } from "../../models/Task";
import { errorHandler } from "../../middlewares/errorHandler";
import { loadColumn } from "../../middlewares/loadColumn";
import { loadTask } from "../../middlewares/loadTask";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import { columnRepository } from "../../repositories/columnRepository";
import { taskRepository } from "../../repositories/taskRepository";
import type { AppError } from "../../utils/AppError";

jest.mock("../../repositories/columnRepository");
jest.mock("../../repositories/taskRepository");

const mockedColumns = jest.mocked(columnRepository);
const mockedTasks = jest.mocked(taskRepository);

const BOARD_ID = new Types.ObjectId();
const RESOURCE_ID = new Types.ObjectId();

/** Invokes a loader against a hand-built request, resolving once next fires. */
async function runLoader(
  loader: typeof loadColumn,
  params: Record<string, unknown>,
): Promise<{ error: AppError | undefined; req: Request }> {
  const req = { params } as unknown as Request;
  let error: AppError | undefined;

  await new Promise<void>((resolve) => {
    loader(req, {} as Response, ((err?: unknown) => {
      if (err) error = err as AppError;
      resolve();
    }) as never);
  });

  return { error, req };
}

describe("validate convenience wrappers", () => {
  const schema = z.object({ value: z.coerce.number().int() });

  function appWith(middleware: ReturnType<typeof validateBody>, path = "/") {
    const app = express();
    app.use(express.json());
    app.all(path, middleware, (req, res) => {
      res.json({ body: req.body, query: req.query, params: req.params });
    });
    app.use(errorHandler);
    return app;
  }

  it("validateBody targets the body", async () => {
    const res = await request(appWith(validateBody(schema)))
      .post("/")
      .send({ value: "42" })
      .expect(200);

    expect(res.body.body).toEqual({ value: 42 });
  });

  it("validateQuery targets the query string", async () => {
    const res = await request(appWith(validateQuery(schema)))
      .get("/?value=7")
      .expect(200);

    expect(res.body.query).toEqual({ value: 7 });
  });

  it("validateParams targets the path params", async () => {
    const res = await request(appWith(validateParams(schema), "/:value"))
      .get("/9")
      .expect(200);

    expect(res.body.params).toEqual({ value: 9 });
  });

  it("each wrapper reports failures against its own source", async () => {
    const res = await request(appWith(validateQuery(schema)))
      .get("/?value=notanumber")
      .expect(400);

    expect(res.body.details[0].field).toBe("value");
  });
});

describe("loadColumn", () => {
  it("attaches the column and publishes its boardId", async () => {
    mockedColumns.findById.mockResolvedValue({
      _id: RESOURCE_ID,
      boardId: BOARD_ID,
    } as unknown as ColumnDocument);

    const { error, req } = await runLoader(loadColumn, {
      id: RESOURCE_ID.toString(),
    });

    expect(error).toBeUndefined();
    expect(req.column?._id).toBe(RESOURCE_ID);
    expect(req.boardId).toBe(BOARD_ID.toString());
  });

  it("404s a column that does not exist", async () => {
    mockedColumns.findById.mockResolvedValue(null);

    const { error } = await runLoader(loadColumn, { id: RESOURCE_ID.toString() });

    expect(error?.statusCode).toBe(404);
    expect(error?.message).toBe("Column not found");
  });

  it("400s rather than coercing a non-string id", async () => {
    // Express 5 types repeated params as string[]; a column id is never one.
    const { error } = await runLoader(loadColumn, { id: ["a", "b"] });

    expect(error?.statusCode).toBe(400);
    expect(mockedColumns.findById).not.toHaveBeenCalled();
  });
});

describe("loadTask", () => {
  it("attaches the task and publishes its boardId", async () => {
    mockedTasks.findById.mockResolvedValue({
      _id: RESOURCE_ID,
      boardId: BOARD_ID,
    } as unknown as TaskDocument);

    const { error, req } = await runLoader(loadTask, { id: RESOURCE_ID.toString() });

    expect(error).toBeUndefined();
    expect(req.task?._id).toBe(RESOURCE_ID);
    expect(req.boardId).toBe(BOARD_ID.toString());
  });

  it("404s a task that does not exist", async () => {
    mockedTasks.findById.mockResolvedValue(null);

    const { error } = await runLoader(loadTask, { id: RESOURCE_ID.toString() });

    expect(error?.statusCode).toBe(404);
    expect(error?.message).toBe("Task not found");
  });

  it("400s rather than coercing a non-string id", async () => {
    const { error } = await runLoader(loadTask, { id: undefined });

    expect(error?.statusCode).toBe(400);
    expect(mockedTasks.findById).not.toHaveBeenCalled();
  });
});
