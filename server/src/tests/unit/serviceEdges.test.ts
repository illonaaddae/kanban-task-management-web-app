import { Types } from "mongoose";
import type { BoardDocument } from "../../models/Board";
import type { UserDocument } from "../../models/User";
import { activityRepository } from "../../repositories/activityRepository";
import { boardRepository } from "../../repositories/boardRepository";
import { columnRepository } from "../../repositories/columnRepository";
import { taskRepository } from "../../repositories/taskRepository";
import { userRepository } from "../../repositories/userRepository";
import { boardService } from "../../services/boardService";
import { userService } from "../../services/userService";
import { AppError } from "../../utils/AppError";

// Branches that are unreachable — or only reachable through a race — from the
// HTTP surface, so the integration suites cannot exercise them.
jest.mock("../../repositories/boardRepository");
jest.mock("../../repositories/columnRepository");
jest.mock("../../repositories/taskRepository");
jest.mock("../../repositories/userRepository");
jest.mock("../../repositories/activityRepository");

const mockedBoards = jest.mocked(boardRepository);
const mockedColumns = jest.mocked(columnRepository);
const mockedTasks = jest.mocked(taskRepository);
const mockedUsers = jest.mocked(userRepository);
const mockedActivity = jest.mocked(activityRepository);

const OWNER = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
const STRANGER = new Types.ObjectId();
const BOARD_ID = new Types.ObjectId();

function fakeUser(id: Types.ObjectId, role: "admin" | "editor" | "viewer"): UserDocument {
  return { _id: id, role, name: "Someone" } as unknown as UserDocument;
}

/** A board owned by OWNER, serialising to a predictable JSON shape. */
function fakeBoard(collaborators: unknown[] = []): BoardDocument {
  return {
    _id: BOARD_ID,
    title: "Board",
    owner: OWNER,
    collaborators,
    toJSON: () => ({ id: BOARD_ID.toString(), name: "Board" }),
  } as unknown as BoardDocument;
}

describe("userService.updateMe", () => {
  it("404s when the user vanished between authentication and the write", async () => {
    // protect loaded the user a moment ago, so this only happens if the
    // account was deleted mid-request.
    mockedUsers.updateById.mockResolvedValue(null);

    await expect(userService.updateMe(OWNER.toString(), { name: "New" })).rejects.toThrow(
      AppError,
    );
    await expect(
      userService.updateMe(OWNER.toString(), { name: "New" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns the updated document on success", async () => {
    const updated = fakeUser(OWNER, "editor");
    mockedUsers.updateById.mockResolvedValue(updated);

    await expect(
      userService.updateMe(OWNER.toString(), { themePreference: "dark" }),
    ).resolves.toBe(updated);
  });
});

describe("boardService.listForUser — role resolution fallbacks", () => {
  it("tags a board the caller owns as owner", async () => {
    mockedBoards.findForUser.mockResolvedValue([fakeBoard()]);

    const [board] = await boardService.listForUser(fakeUser(OWNER, "editor"));

    expect(board.myRole).toBe("owner");
  });

  it("tags a board from the caller's collaborator entry", async () => {
    mockedBoards.findForUser.mockResolvedValue([
      fakeBoard([{ user: STRANGER, role: "viewer" }]),
    ]);

    const [board] = await boardService.listForUser(fakeUser(STRANGER, "editor"));

    expect(board.myRole).toBe("viewer");
  });

  it("tags a platform admin's unrelated board as admin", async () => {
    mockedBoards.findForUser.mockResolvedValue([fakeBoard()]);

    const [board] = await boardService.listForUser(fakeUser(ADMIN, "admin"));

    expect(board.myRole).toBe("admin");
  });

  it("falls back to viewer for a non-admin with no relationship", async () => {
    // findForUser cannot return such a board today; the fallback exists so a
    // future caller cannot get an undefined role.
    mockedBoards.findForUser.mockResolvedValue([fakeBoard()]);

    const [board] = await boardService.listForUser(fakeUser(STRANGER, "editor"));

    expect(board.myRole).toBe("viewer");
  });
});

describe("boardService.getFull — collaborator resolution", () => {
  beforeEach(() => {
    mockedColumns.findByBoardId.mockResolvedValue([]);
    mockedTasks.findByBoardId.mockResolvedValue([]);
  });

  it("emits a populated collaborator as id/name/email", async () => {
    const userId = new Types.ObjectId();
    mockedBoards.findByIdPopulated.mockResolvedValue(
      fakeBoard([
        { user: { _id: userId, name: "Ada", email: "ada@example.com" }, role: "editor" },
      ]),
    );

    const full = await boardService.getFull(BOARD_ID.toString(), "owner");

    expect(full.collaborators).toEqual([
      { user: { id: userId.toString(), name: "Ada", email: "ada@example.com" }, role: "editor" },
    ]);
  });

  it("defaults a missing email to an empty string", async () => {
    const userId = new Types.ObjectId();
    mockedBoards.findByIdPopulated.mockResolvedValue(
      fakeBoard([{ user: { _id: userId, name: "Ada" }, role: "editor" }]),
    );

    const full = await boardService.getFull(BOARD_ID.toString(), "owner");

    expect(full.collaborators[0].user).toEqual({
      id: userId.toString(),
      name: "Ada",
      email: "",
    });
  });

  it("emits null for a collaborator whose user was deleted", async () => {
    // A populated ref resolves to null once the referenced document is gone.
    mockedBoards.findByIdPopulated.mockResolvedValue(
      fakeBoard([{ user: null, role: "viewer" }]),
    );

    const full = await boardService.getFull(BOARD_ID.toString(), "owner");

    expect(full.collaborators).toEqual([{ user: null, role: "viewer" }]);
  });

  it("emits null for an unpopulated collaborator ref", async () => {
    mockedBoards.findByIdPopulated.mockResolvedValue(
      fakeBoard([{ user: new Types.ObjectId(), role: "editor" }]),
    );

    const full = await boardService.getFull(BOARD_ID.toString(), "owner");

    expect(full.collaborators[0].user).toBeNull();
  });

  it("404s when the board disappears between the access check and the read", async () => {
    mockedBoards.findByIdPopulated.mockResolvedValue(null);

    await expect(
      boardService.getFull(BOARD_ID.toString(), "owner"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("boardService — races between the access check and the write", () => {
  it("getDetailed 404s when the board is gone", async () => {
    mockedBoards.findByIdPopulated.mockResolvedValue(null);

    await expect(
      boardService.getDetailed(BOARD_ID.toString(), "owner"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rename 404s when the board is gone", async () => {
    mockedBoards.updateById.mockResolvedValue(null);

    await expect(
      boardService.rename(BOARD_ID.toString(), "New", "owner"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("remove 404s when the board is gone, after the children were cleared", async () => {
    mockedTasks.deleteByBoardId.mockResolvedValue(0);
    mockedColumns.deleteByBoardId.mockResolvedValue(0);
    mockedActivity.deleteByBoardId.mockResolvedValue(0);
    mockedBoards.deleteById.mockResolvedValue(null);

    await expect(boardService.remove(BOARD_ID.toString())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("removeCollaborator names an unresolvable user generically in the log", async () => {
    const gone = new Types.ObjectId();
    const board = fakeBoard([{ user: gone, role: "viewer" }]);

    mockedBoards.removeCollaborator.mockResolvedValue(board);
    mockedTasks.unassignUserFromBoard.mockResolvedValue(0);
    mockedUsers.findById.mockResolvedValue(null);
    mockedBoards.findByIdPopulated.mockResolvedValue(board);
    mockedActivity.create.mockResolvedValue({} as never);

    await boardService.removeCollaborator(
      board,
      fakeUser(OWNER, "editor"),
      gone.toString(),
    );

    expect(mockedActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "collaborator.removed",
        message: "Someone removed a collaborator",
      }),
    );
  });
});
