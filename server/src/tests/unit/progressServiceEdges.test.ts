import { Types } from "mongoose";
import type { BoardDocument } from "../../models/Board";
import type { ColumnDocument } from "../../models/Column";
import type { OrganizationDocument } from "../../models/Organization";
import type { TaskDocument } from "../../models/Task";
import type { UserDocument } from "../../models/User";
import { boardRepository } from "../../repositories/boardRepository";
import { columnRepository } from "../../repositories/columnRepository";
import { organizationRepository } from "../../repositories/organizationRepository";
import { taskRepository } from "../../repositories/taskRepository";
import { progressService } from "../../services/progressService";

/**
 * Branches the HTTP surface cannot reach: unpopulated refs (every real read
 * populates), a task whose column has been deleted, and the ordering tie-breakers.
 */
jest.mock("../../repositories/boardRepository");
jest.mock("../../repositories/columnRepository");
jest.mock("../../repositories/organizationRepository");
jest.mock("../../repositories/taskRepository");

const mockedBoards = jest.mocked(boardRepository);
const mockedColumns = jest.mocked(columnRepository);
const mockedOrgs = jest.mocked(organizationRepository);
const mockedTasks = jest.mocked(taskRepository);

const BOARD = new Types.ObjectId();
const ORG = new Types.ObjectId();
const TODO = new Types.ObjectId();
const DONE = new Types.ObjectId();
const ALICE = new Types.ObjectId();
const BOB = new Types.ObjectId();

function user(id: Types.ObjectId, email = "someone@example.com"): UserDocument {
  return { _id: id, email, name: "Someone" } as unknown as UserDocument;
}

function person(id: Types.ObjectId, name: string, avatar?: string) {
  return { _id: id, name, email: `${name}@example.com`, ...(avatar ? { avatar } : {}) };
}

function column(id: Types.ObjectId, title: string, position: number): ColumnDocument {
  return { _id: id, title, position, boardId: BOARD } as unknown as ColumnDocument;
}

function task(overrides: Record<string, unknown> = {}): TaskDocument {
  return {
    _id: new Types.ObjectId(),
    title: "A task",
    description: "",
    status: "Todo",
    position: 0,
    boardId: BOARD,
    columnId: TODO,
    assignedTo: null,
    dueDate: null,
    subtasks: [],
    ...overrides,
  } as unknown as TaskDocument;
}

function board(overrides: Record<string, unknown> = {}): BoardDocument {
  return {
    _id: BOARD,
    title: "Board",
    owner: person(ALICE, "Alice"),
    collaborators: [],
    organization: undefined,
    ...overrides,
  } as unknown as BoardDocument;
}

function org(overrides: Record<string, unknown> = {}): OrganizationDocument {
  return {
    _id: ORG,
    name: "Acme",
    owner: person(ALICE, "Alice"),
    members: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as OrganizationDocument;
}

describe("progressService.teammatesFor", () => {
  it("skips an unpopulated or deleted member ref", async () => {
    // A bare ObjectId has no `name`, and neither does a populated ref to an
    // account that has since been deleted.
    mockedOrgs.findForUserPopulated.mockResolvedValue([
      org({ owner: BOB, members: [{ user: new Types.ObjectId(), role: "member" }] }),
    ]);

    const teammates = await progressService.teammatesFor(user(ALICE));

    expect(teammates).toEqual([]);
  });

  it("carries an avatar through when there is one, and omits the key otherwise", async () => {
    mockedOrgs.findForUserPopulated.mockResolvedValue([
      org({
        owner: person(BOB, "Bob", "http://x/y.png"),
        members: [{ user: person(new Types.ObjectId(), "Zoe"), role: "member" }],
      }),
    ]);

    const teammates = await progressService.teammatesFor(user(ALICE));

    expect(teammates.find((t) => t.name === "Bob")?.avatar).toBe("http://x/y.png");
    expect(teammates.find((t) => t.name === "Zoe")).not.toHaveProperty("avatar");
  });

  it("sorts by name", async () => {
    mockedOrgs.findForUserPopulated.mockResolvedValue([
      org({
        owner: person(BOB, "Zoe"),
        members: [{ user: person(new Types.ObjectId(), "Adam"), role: "member" }],
      }),
    ]);

    const teammates = await progressService.teammatesFor(user(ALICE));

    expect(teammates.map((t) => t.name)).toEqual(["Adam", "Zoe"]);
  });
});

describe("progressService.forBoard", () => {
  beforeEach(() => {
    mockedBoards.findByIdPopulated.mockResolvedValue(board());
    mockedColumns.findByBoardId.mockResolvedValue([]);
    mockedTasks.findByBoardId.mockResolvedValue([]);
  });

  it("copes with the board having vanished", async () => {
    mockedBoards.findByIdPopulated.mockResolvedValue(null);

    const progress = await progressService.forBoard(BOARD.toString());

    expect(progress.members).toEqual([]);
    expect(progress.totals.tasks).toBe(0);
  });

  it("skips a collaborator whose ref is not populated", async () => {
    mockedBoards.findByIdPopulated.mockResolvedValue(
      board({ collaborators: [{ user: new Types.ObjectId(), role: "editor" }] }),
    );

    const progress = await progressService.forBoard(BOARD.toString());

    // Alice the owner is populated and stays; the bare id cannot be rendered.
    expect(progress.members.map((m) => m.name)).toEqual(["Alice"]);
  });

  it("reports no done column when the board has only one", async () => {
    mockedColumns.findByBoardId.mockResolvedValue([column(TODO, "Todo", 0)]);
    mockedTasks.findByBoardId.mockResolvedValue([task({ assignedTo: ALICE })]);

    const progress = await progressService.forBoard(BOARD.toString());

    // One column is a queue, not a workflow with an end.
    expect(progress.doneColumn).toBeNull();
    expect(progress.totals.completed).toBe(0);
  });

  it("puts the unassigned bucket last however busy it is", async () => {
    mockedColumns.findByBoardId.mockResolvedValue([
      column(TODO, "Todo", 0),
      column(DONE, "Done", 1),
    ]);
    mockedTasks.findByBoardId.mockResolvedValue([
      task({ assignedTo: null }),
      task({ assignedTo: null }),
      task({ assignedTo: null }),
      task({ assignedTo: ALICE }),
    ]);

    const progress = await progressService.forBoard(BOARD.toString());

    // It is a queue, not a person, so it never leads the table.
    expect(progress.members.at(-1)?.userId).toBeNull();
  });

  it("breaks an equal workload tie by name", async () => {
    mockedBoards.findByIdPopulated.mockResolvedValue(
      board({
        owner: person(ALICE, "Zoe"),
        collaborators: [{ user: person(BOB, "Adam"), role: "editor" }],
      }),
    );
    mockedColumns.findByBoardId.mockResolvedValue([
      column(TODO, "Todo", 0),
      column(DONE, "Done", 1),
    ]);
    mockedTasks.findByBoardId.mockResolvedValue([
      task({ assignedTo: ALICE }),
      task({ assignedTo: BOB }),
    ]);

    const progress = await progressService.forBoard(BOARD.toString());

    expect(progress.members.map((m) => m.name)).toEqual(["Adam", "Zoe"]);
  });

  it("files a task owned by somebody off the board under Former member", async () => {
    mockedColumns.findByBoardId.mockResolvedValue([
      column(TODO, "Todo", 0),
      column(DONE, "Done", 1),
    ]);
    mockedTasks.findByBoardId.mockResolvedValue([
      task({ assignedTo: new Types.ObjectId() }),
    ]);

    const progress = await progressService.forBoard(BOARD.toString());

    // Dropping the row would make the per-person numbers disagree with the board.
    expect(progress.members.find((m) => m.name === "Former member")).toMatchObject({
      assigned: 1,
    });
    expect(progress.totals.tasks).toBe(1);
  });

  it("counts a due date in the past as overdue only outside the done column", async () => {
    mockedColumns.findByBoardId.mockResolvedValue([
      column(TODO, "Todo", 0),
      column(DONE, "Done", 1),
    ]);
    mockedTasks.findByBoardId.mockResolvedValue([
      task({ assignedTo: ALICE, dueDate: new Date("2020-01-01") }),
      task({ assignedTo: ALICE, columnId: DONE, dueDate: new Date("2020-01-01") }),
    ]);

    const progress = await progressService.forBoard(BOARD.toString());

    expect(progress.totals).toMatchObject({ completed: 1, overdue: 1 });
  });
});

describe("progressService.assignedTo", () => {
  beforeEach(() => {
    mockedOrgs.findForUser.mockResolvedValue([]);
    mockedBoards.findForUser.mockResolvedValue([board()]);
    mockedColumns.findByBoardId.mockResolvedValue([
      column(TODO, "Todo", 0),
      column(DONE, "Done", 1),
    ]);
    mockedTasks.findAssignedInBoards.mockResolvedValue([]);
  });

  it("drops a task whose column no longer exists", async () => {
    mockedTasks.findAssignedInBoards.mockResolvedValue([
      task({ assignedTo: ALICE, columnId: new Types.ObjectId() }),
    ]);

    const tasks = await progressService.assignedTo(user(ALICE));

    // A row that cannot be opened is worse than an absent one.
    expect(tasks).toEqual([]);
  });

  it("drops a task whose board is not in the reachable set", async () => {
    mockedTasks.findAssignedInBoards.mockResolvedValue([
      task({ assignedTo: ALICE, boardId: new Types.ObjectId() }),
    ]);

    const tasks = await progressService.assignedTo(user(ALICE));

    expect(tasks).toEqual([]);
  });

  it("reports the team a board belongs to, or null for a personal one", async () => {
    mockedBoards.findForUser.mockResolvedValue([board({ organization: ORG })]);
    mockedTasks.findAssignedInBoards.mockResolvedValue([task({ assignedTo: ALICE })]);

    const [withTeam] = await progressService.assignedTo(user(ALICE));
    expect(withTeam?.board.organizationId).toBe(ORG.toString());

    mockedBoards.findForUser.mockResolvedValue([board()]);
    const [personal] = await progressService.assignedTo(user(ALICE));
    expect(personal?.board.organizationId).toBeNull();
  });

  it("does not treat a single-column board as all done", async () => {
    mockedColumns.findByBoardId.mockResolvedValue([column(TODO, "Todo", 0)]);
    mockedTasks.findAssignedInBoards.mockResolvedValue([task({ assignedTo: ALICE })]);

    const [only] = await progressService.assignedTo(user(ALICE));

    expect(only?.isDone).toBe(false);
  });

  it("counts subtasks and leaves a task with none at zero", async () => {
    mockedTasks.findAssignedInBoards.mockResolvedValue([
      task({
        assignedTo: ALICE,
        subtasks: [{ title: "a", isCompleted: true }, { title: "b", isCompleted: false }],
      }),
      task({ assignedTo: ALICE }),
    ]);

    const tasks = await progressService.assignedTo(user(ALICE));

    expect(tasks[0]?.subtasks).toEqual({ total: 2, completed: 1 });
    expect(tasks[1]?.subtasks).toEqual({ total: 0, completed: 0 });
  });
});

describe("progressService.forOrganization", () => {
  beforeEach(() => {
    mockedOrgs.findByIdPopulated.mockResolvedValue(org());
    mockedBoards.findForOrganization.mockResolvedValue([]);
    mockedTasks.findByBoardIds.mockResolvedValue([]);
    mockedColumns.findByBoardId.mockResolvedValue([]);
  });

  it("copes with the organization having vanished", async () => {
    mockedOrgs.findByIdPopulated.mockResolvedValue(null);

    const analytics = await progressService.forOrganization(ORG.toString());

    expect(analytics.members).toEqual([]);
    expect(analytics.boards).toBe(0);
  });

  it("skips members whose refs are not populated", async () => {
    mockedOrgs.findByIdPopulated.mockResolvedValue(
      org({ owner: BOB, members: [{ user: new Types.ObjectId(), role: "member" }] }),
    );

    const analytics = await progressService.forOrganization(ORG.toString());

    expect(analytics.members).toEqual([]);
  });

  it("files a task assigned to a non-member under Outside the team", async () => {
    mockedBoards.findForOrganization.mockResolvedValue([board({ organization: ORG })]);
    mockedColumns.findByBoardId.mockResolvedValue([
      column(TODO, "Todo", 0),
      column(DONE, "Done", 1),
    ]);
    mockedTasks.findByBoardIds.mockResolvedValue([
      task({ assignedTo: new Types.ObjectId() }),
    ]);

    const analytics = await progressService.forOrganization(ORG.toString());

    expect(
      analytics.members.find((m) => m.name === "Outside the team"),
    ).toMatchObject({ assigned: 1 });
  });

  it("ignores the done rule on a single-column board", async () => {
    mockedBoards.findForOrganization.mockResolvedValue([board({ organization: ORG })]);
    mockedColumns.findByBoardId.mockResolvedValue([column(TODO, "Todo", 0)]);
    mockedTasks.findByBoardIds.mockResolvedValue([task({ assignedTo: ALICE })]);

    const analytics = await progressService.forOrganization(ORG.toString());

    expect(analytics.totals.completed).toBe(0);
    expect(analytics.perBoard[0]?.completed).toBe(0);
  });

  it("orders boards by workload, then by name", async () => {
    const second = new Types.ObjectId();
    mockedBoards.findForOrganization.mockResolvedValue([
      board({ _id: BOARD, title: "Zeta", organization: ORG }),
      board({ _id: second, title: "Alpha", organization: ORG }),
    ]);
    mockedColumns.findByBoardId.mockResolvedValue([]);
    mockedTasks.findByBoardIds.mockResolvedValue([]);

    const analytics = await progressService.forOrganization(ORG.toString());

    // Both empty, so the tie-break by name decides.
    expect(analytics.perBoard.map((b) => b.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("puts the unassigned bucket last", async () => {
    mockedBoards.findForOrganization.mockResolvedValue([board({ organization: ORG })]);
    mockedColumns.findByBoardId.mockResolvedValue([
      column(TODO, "Todo", 0),
      column(DONE, "Done", 1),
    ]);
    mockedTasks.findByBoardIds.mockResolvedValue([
      task({ assignedTo: null }),
      task({ assignedTo: null }),
    ]);

    const analytics = await progressService.forOrganization(ORG.toString());

    expect(analytics.members.at(-1)?.userId).toBeNull();
    expect(analytics.totals.unassigned).toBe(2);
  });

  it("carries member avatars through", async () => {
    mockedOrgs.findByIdPopulated.mockResolvedValue(
      org({
        owner: person(ALICE, "Alice", "http://x/a.png"),
        members: [{ user: person(BOB, "Bob"), role: "admin" }],
      }),
    );

    const analytics = await progressService.forOrganization(ORG.toString());

    expect(analytics.members.find((m) => m.name === "Alice")?.avatar).toBe(
      "http://x/a.png",
    );
    expect(analytics.members.find((m) => m.name === "Bob")).not.toHaveProperty(
      "avatar",
    );
  });
});
