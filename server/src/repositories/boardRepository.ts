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
}

export type UpdateBoardInput = Partial<{ title: string }>;

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
   * Every board the user can see: the ones they own plus the ones they were
   * invited to. The $or is served by the `owner` and `collaborators.user`
   * indexes.
   */
  findForUser(userId: UserId): Promise<BoardDocument[]> {
    return Board.find({
      $or: [{ owner: userId }, { "collaborators.user": userId }],
    })
      .sort({ createdAt: 1 })
      .exec();
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
