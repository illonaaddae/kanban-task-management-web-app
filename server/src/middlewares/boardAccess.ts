import type { Request, RequestHandler } from "express";
import type { BoardDocument } from "../models/Board";
import { boardRepository } from "../repositories/boardRepository";
import { organizationRepository } from "../repositories/organizationRepository";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

/**
 * What the caller may do on one specific board.
 *
 * `admin` is the global platform role reaching a board it has no explicit
 * relationship with - it is not a board-level grant.
 */
export type EffectiveRole = "viewer" | "editor" | "owner" | "admin";

/** Minimum board-level role a route can demand. */
export type MinBoardRole = "viewer" | "editor" | "owner";

const RANK: Record<EffectiveRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
  admin: 4,
};

/**
 * Where the board id comes from, most specific first:
 *   1. `req.boardId`        - set by a column/task resource loader
 *   2. `req.params.boardId` - nested routes like /boards/:boardId/columns
 *   3. `req.params.id`      - /boards/:id
 *   4. `req.body.boardId`   - creation routes such as POST /tasks
 *
 * The body is last so a path can never be overridden by the payload. It is
 * only consulted on routes whose schema already validated it as an ObjectId.
 */
function resolveBoardId(req: Request): string | undefined {
  // Express 5 types repeated params as string[]; a board id is never one, so
  // anything non-string is treated as absent rather than coerced.
  const fromParams = req.params.boardId ?? req.params.id;
  const single = typeof fromParams === "string" ? fromParams : undefined;

  const fromBody = (req.body as { boardId?: unknown } | undefined)?.boardId;
  const bodyId = typeof fromBody === "string" ? fromBody : undefined;

  return req.boardId ?? single ?? bodyId;
}

/**
 * The caller's relationship to a board, most specific first:
 *
 *   1. owner              - they created it
 *   2. collaborator entry - they were invited to this board specifically
 *   3. team membership    - the board belongs to a team they are in
 *
 * An explicit collaborator entry beats the team default, which is what makes it
 * possible to hold one person to `viewer` on a board their whole team can edit.
 */
async function relationshipTo(
  board: BoardDocument,
  userId: string,
): Promise<EffectiveRole | null> {
  if (board.owner.toString() === userId) return "owner";

  const entry = board.collaborators.find((c) => c.user.toString() === userId);
  if (entry) return entry.role;

  if (!board.organization) return null;

  // Team boards are shared work: a member who cannot move a card cannot do the
  // job the board exists for, so membership grants `editor`. Downgrading a
  // specific person is still possible - add them as a `viewer` collaborator and
  // the branch above wins.
  const org = await organizationRepository.findById(board.organization);
  if (!org) return null;

  const isOrgOwner = org.owner.toString() === userId;
  const isOrgMember = org.members.some((m) => m.user.toString() === userId);

  return isOrgOwner || isOrgMember ? "editor" : null;
}

/**
 * Board-level authorisation. Runs after `protect`.
 *
 * Order matters: the board is resolved and 404s **before** any permission
 * check, so a genuinely missing board never reports 403. A board that exists
 * but is not shared with the caller returns 403 - deliberately, per the RBAC
 * spec, so column and task routes cannot be turned into a 404-vs-403 probe
 * for ids belonging to other people's boards.
 *
 * On success attaches `req.board` and `req.myRole`.
 */
export const boardAccess = (minRole: MinBoardRole): RequestHandler =>
  catchAsync(async (req, _res, next) => {
    if (!req.user) {
      throw AppError.unauthorized("You are not logged in");
    }

    const boardId = resolveBoardId(req);
    if (!boardId) {
      throw AppError.badRequest("No board was specified for this request");
    }

    // Existence first - 404 before any permission reasoning.
    const board = await boardRepository.findById(boardId);
    if (!board) {
      throw AppError.notFound("Board not found");
    }

    const userId = req.user._id.toString();
    const isGlobalAdmin = req.user.role === "admin";
    const relationship = await relationshipTo(board, userId);

    if (!relationship && !isGlobalAdmin) {
      throw AppError.forbidden("You do not have access to this board");
    }

    // Report the real board relationship when there is one, so the frontend's
    // read-only mode reflects the actual grant; fall back to `admin` for a
    // platform admin with no relationship to this board.
    const myRole: EffectiveRole = relationship ?? "admin";

    // A global admin bypasses the rank check entirely - including when their
    // board relationship is a lower role than the route demands.
    if (!isGlobalAdmin && RANK[myRole] < RANK[minRole]) {
      throw AppError.forbidden(
        `This action requires ${minRole} access to the board`,
      );
    }

    req.board = board;
    req.myRole = myRole;
    next();
  });

export default boardAccess;
