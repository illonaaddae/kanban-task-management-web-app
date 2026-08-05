import type { Request, Response } from "express";
import { Types } from "mongoose";
import type { BoardDocument } from "../../models/Board";
import type { UserDocument } from "../../models/User";
import { boardAccess, type MinBoardRole } from "../../middlewares/boardAccess";
import { boardRepository } from "../../repositories/boardRepository";
import { AppError } from "../../utils/AppError";

// Role resolution is pure logic over a board document — the database is mocked
// out so these stay fast and can construct relationships the integration
// suites would need several requests to set up.
jest.mock("../../repositories/boardRepository");

const mockedRepo = jest.mocked(boardRepository);

const OWNER = new Types.ObjectId();
const EDITOR = new Types.ObjectId();
const VIEWER = new Types.ObjectId();
const OUTSIDER = new Types.ObjectId();
const BOARD_ID = new Types.ObjectId();

/** Enough of a board document for the middleware's purposes. */
function fakeBoard(): BoardDocument {
  return {
    _id: BOARD_ID,
    title: "Board",
    owner: OWNER,
    collaborators: [
      { user: EDITOR, role: "editor" },
      { user: VIEWER, role: "viewer" },
    ],
  } as unknown as BoardDocument;
}

function fakeUser(id: Types.ObjectId, role: "admin" | "editor" | "viewer" = "editor") {
  return { _id: id, role } as unknown as UserDocument;
}

interface RunOptions {
  user?: UserDocument;
  params?: Record<string, unknown>;
  body?: unknown;
  /** Simulates a resource loader having already resolved the parent board. */
  boardId?: string;
  /** Defaults to a board found; pass null for "no such board". */
  board?: BoardDocument | null;
}

interface RunResult {
  error: AppError | undefined;
  req: Request;
  nextCalledClean: boolean;
}

/**
 * Invokes the middleware against a hand-built request and resolves once it has
 * called `next` — with or without an error.
 */
async function run(minRole: MinBoardRole, options: RunOptions = {}): Promise<RunResult> {
  const { board = fakeBoard() } = options;
  mockedRepo.findById.mockResolvedValue(board);

  const req = {
    user: options.user,
    params: options.params ?? { id: BOARD_ID.toString() },
    body: options.body,
    boardId: options.boardId,
  } as unknown as Request;

  let error: AppError | undefined;
  let nextCalledClean = false;

  await new Promise<void>((resolve) => {
    boardAccess(minRole)(req, {} as Response, ((err?: unknown) => {
      if (err) error = err as AppError;
      else nextCalledClean = true;
      resolve();
    }) as never);
  });

  return { error, req, nextCalledClean };
}

describe("boardAccess — role resolution", () => {
  it("resolves the owner as owner", async () => {
    const { req, nextCalledClean } = await run("viewer", { user: fakeUser(OWNER) });

    expect(nextCalledClean).toBe(true);
    expect(req.myRole).toBe("owner");
  });

  it("resolves a collaborator to their entry's role", async () => {
    const editor = await run("viewer", { user: fakeUser(EDITOR) });
    const viewer = await run("viewer", { user: fakeUser(VIEWER) });

    expect(editor.req.myRole).toBe("editor");
    expect(viewer.req.myRole).toBe("viewer");
  });

  it("reports the caller's own role, not the owner's", async () => {
    const { req } = await run("viewer", { user: fakeUser(VIEWER) });

    expect(req.myRole).not.toBe("owner");
    expect(req.myRole).toBe("viewer");
  });

  it("attaches the board it authorised against", async () => {
    const { req } = await run("viewer", { user: fakeUser(OWNER) });

    expect(req.board?._id).toBe(BOARD_ID);
  });

  it("403s a user with no relationship to the board", async () => {
    const { error } = await run("viewer", { user: fakeUser(OUTSIDER) });

    expect(error?.statusCode).toBe(403);
    expect(error?.message).toBe("You do not have access to this board");
  });

  it("leaves req.board and req.myRole unset when it refuses", async () => {
    const { req } = await run("viewer", { user: fakeUser(OUTSIDER) });

    expect(req.board).toBeUndefined();
    expect(req.myRole).toBeUndefined();
  });
});

describe("boardAccess — rank ordering (viewer < editor < owner)", () => {
  const cases: Array<{
    who: string;
    id: Types.ObjectId;
    allowed: MinBoardRole[];
    refused: MinBoardRole[];
  }> = [
    { who: "viewer", id: VIEWER, allowed: ["viewer"], refused: ["editor", "owner"] },
    { who: "editor", id: EDITOR, allowed: ["viewer", "editor"], refused: ["owner"] },
    { who: "owner", id: OWNER, allowed: ["viewer", "editor", "owner"], refused: [] },
  ];

  for (const { who, id, allowed, refused } of cases) {
    for (const minRole of allowed) {
      it(`lets a ${who} through boardAccess("${minRole}")`, async () => {
        const { nextCalledClean } = await run(minRole, { user: fakeUser(id) });

        expect(nextCalledClean).toBe(true);
      });
    }

    for (const minRole of refused) {
      it(`403s a ${who} on boardAccess("${minRole}")`, async () => {
        const { error } = await run(minRole, { user: fakeUser(id) });

        expect(error?.statusCode).toBe(403);
        expect(error?.message).toBe(`This action requires ${minRole} access to the board`);
      });
    }
  }
});

describe("boardAccess — global admin", () => {
  it("bypasses the board check with no relationship at all", async () => {
    const { req, nextCalledClean } = await run("owner", {
      user: fakeUser(OUTSIDER, "admin"),
    });

    expect(nextCalledClean).toBe(true);
    expect(req.myRole).toBe("admin");
  });

  it("bypasses the rank check even when its board relationship is lower", async () => {
    // A platform admin who happens to be a viewer on this board still gets
    // through an owner-only route.
    const { req, nextCalledClean } = await run("owner", {
      user: fakeUser(VIEWER, "admin"),
    });

    expect(nextCalledClean).toBe(true);
    // The real relationship is reported, so the frontend reflects the grant.
    expect(req.myRole).toBe("viewer");
  });

  it("still 404s for an admin when the board is missing", async () => {
    const { error } = await run("viewer", {
      user: fakeUser(OUTSIDER, "admin"),
      board: null,
    });

    expect(error?.statusCode).toBe(404);
  });
});

describe("boardAccess — failure precedence", () => {
  it("401s before any lookup when there is no authenticated user", async () => {
    const { error } = await run("viewer", { user: undefined });

    expect(error?.statusCode).toBe(401);
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it("400s when no board id can be resolved from anywhere", async () => {
    const { error } = await run("viewer", { user: fakeUser(OWNER), params: {} });

    expect(error?.statusCode).toBe(400);
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it("404s a missing board before any permission reasoning", async () => {
    const { error } = await run("owner", {
      user: fakeUser(OUTSIDER),
      board: null,
    });

    // An outsider on a nonexistent board must see 404, not 403 — existence is
    // resolved first.
    expect(error?.statusCode).toBe(404);
    expect(error?.message).toBe("Board not found");
  });
});

describe("boardAccess — board id resolution order", () => {
  const LOADER_ID = new Types.ObjectId().toString();
  const PARAM_ID = new Types.ObjectId().toString();
  const BODY_ID = new Types.ObjectId().toString();

  it("prefers req.boardId set by a resource loader", async () => {
    await run("viewer", {
      user: fakeUser(OWNER),
      boardId: LOADER_ID,
      params: { boardId: PARAM_ID, id: PARAM_ID },
      body: { boardId: BODY_ID },
    });

    expect(mockedRepo.findById).toHaveBeenCalledWith(LOADER_ID);
  });

  it("prefers params.boardId over params.id", async () => {
    await run("viewer", {
      user: fakeUser(OWNER),
      params: { boardId: PARAM_ID, id: BODY_ID },
    });

    expect(mockedRepo.findById).toHaveBeenCalledWith(PARAM_ID);
  });

  it("falls back to params.id", async () => {
    await run("viewer", { user: fakeUser(OWNER), params: { id: PARAM_ID } });

    expect(mockedRepo.findById).toHaveBeenCalledWith(PARAM_ID);
  });

  it("falls back to body.boardId for creation routes", async () => {
    await run("viewer", {
      user: fakeUser(OWNER),
      params: {},
      body: { boardId: BODY_ID },
    });

    expect(mockedRepo.findById).toHaveBeenCalledWith(BODY_ID);
  });

  it("never lets the body override a path id", async () => {
    await run("viewer", {
      user: fakeUser(OWNER),
      params: { id: PARAM_ID },
      body: { boardId: BODY_ID },
    });

    expect(mockedRepo.findById).toHaveBeenCalledWith(PARAM_ID);
  });

  it("ignores a non-string board id rather than coercing it", async () => {
    // Express 5 types repeated params as string[]; a board id is never one.
    const { error } = await run("viewer", {
      user: fakeUser(OWNER),
      params: { id: [PARAM_ID, BODY_ID] },
      body: {},
    });

    expect(error?.statusCode).toBe(400);
  });

  it("tolerates an absent body", async () => {
    const { error } = await run("viewer", {
      user: fakeUser(OWNER),
      params: {},
      body: undefined,
    });

    expect(error?.statusCode).toBe(400);
  });
});
