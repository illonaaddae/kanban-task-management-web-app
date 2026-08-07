import type { Types } from "mongoose";
import {
  Board,
  type BoardDocument,
  type CollaboratorRole,
} from "../models/Board";

export type BoardId = string | Types.ObjectId;
export type UserId = string | Types.ObjectId;

export interface CreateBoardInput {
  title: string;
  owner: UserId;
  /** Set to make this a team board, reachable by every member of that team. */
  organization?: BoardId;
}

export type UpdateBoardInput = Partial<{
  title: string;
  /** `null` detaches the board from its team, making it personal again. */
  organization: BoardId | null;
}>;

export const boardRepository = {
  create(data: CreateBoardInput): Promise<BoardDocument> {
    return Board.create(data);
  },

  findById(id: BoardId): Promise<BoardDocument | null> {
    return Board.findById(id).exec();
  },

  /** Board plus resolved collaborator identities, for the share modal. */
  findByIdPopulated(id: BoardId): Promise<BoardDocument | null> {
    return Board.findById(id)
      .populate("owner", "name email avatar")
      .populate("collaborators.user", "name email avatar")
      .exec();
  },

  /**
   * Every board the user can see: the ones they own, the ones they were invited
   * to, and every board belonging to a team they are in. The $or is served by the
   * `owner`, `collaborators.user` and `organization` indexes.
   *
   * `orgIds` is passed in rather than looked up here — a repository that queries
   * a second collection to answer one question stops being a repository.
   */
  findForUser(userId: UserId, orgIds: BoardId[] = []): Promise<BoardDocument[]> {
    const clauses: Record<string, unknown>[] = [
      { owner: userId },
      { "collaborators.user": userId },
    ];
    if (orgIds.length > 0) clauses.push({ organization: { $in: orgIds } });

    return Board.find({ $or: clauses }).sort({ createdAt: 1 }).exec();
  },

  /** Boards belonging to one team. Backs the team's analytics roll-up. */
  findForOrganization(orgId: BoardId): Promise<BoardDocument[]> {
    return Board.find({ organization: orgId }).sort({ createdAt: 1 }).exec();
  },

  updateById(id: BoardId, updates: UpdateBoardInput): Promise<BoardDocument | null> {
    return Board.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).exec();
  },

  deleteById(id: BoardId): Promise<BoardDocument | null> {
    return Board.findByIdAndDelete(id).exec();
  },

  /**
   * Adds a collaborator only if that user is not already on the board.
   * Returns null when the board is missing or the user is already a
   * collaborator, so the service can answer 404 vs 409 without a second read.
   */
  addCollaborator(
    boardId: BoardId,
    userId: UserId,
    role: CollaboratorRole,
  ): Promise<BoardDocument | null> {
    return Board.findOneAndUpdate(
      { _id: boardId, "collaborators.user": { $ne: userId } },
      { $push: { collaborators: { user: userId, role } } },
      { new: true, runValidators: true },
    ).exec();
  },

  updateCollaboratorRole(
    boardId: BoardId,
    userId: UserId,
    role: CollaboratorRole,
  ): Promise<BoardDocument | null> {
    return Board.findOneAndUpdate(
      { _id: boardId, "collaborators.user": userId },
      { $set: { "collaborators.$.role": role } },
      { new: true, runValidators: true },
    ).exec();
  },

  removeCollaborator(boardId: BoardId, userId: UserId): Promise<BoardDocument | null> {
    return Board.findOneAndUpdate(
      { _id: boardId },
      { $pull: { collaborators: { user: userId } } },
      { new: true },
    ).exec();
  },

  hasCollaborator(boardId: BoardId, userId: UserId): Promise<boolean> {
    return Board.exists({ _id: boardId, "collaborators.user": userId }).then(Boolean);
  },
};

export default boardRepository;
