import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { toJSONOptions } from "./transforms";

export const COLLABORATOR_ROLES = ["editor", "viewer"] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

export interface ICollaborator {
  user: Types.ObjectId;
  role: CollaboratorRole;
}

export interface IBoard {
  title: string;
  owner: Types.ObjectId;
  collaborators: ICollaborator[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IBoardVirtuals {
  /** Mirrors `title` so the existing frontend `Board.name` keeps working. */
  name: string;
}

export type BoardDocument = HydratedDocument<IBoard, IBoardVirtuals>;

// The 5th generic pins the hydrated type, so query results carry the `name`
// virtual instead of Mongoose inferring a virtual-less document.
export type BoardModel = Model<
  IBoard,
  Record<string, never>,
  Record<string, never>,
  IBoardVirtuals,
  BoardDocument
>;

const collaboratorSchema = new Schema<ICollaborator>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: {
        values: [...COLLABORATOR_ROLES],
        message: "Collaborator role must be either editor or viewer",
      },
      required: true,
      default: "editor",
    },
  },
  // The pairing is identified by `user`; a subdocument _id would just be noise
  // in the API response.
  { _id: false },
);

const boardSchema = new Schema<IBoard, BoardModel, Record<string, never>, Record<string, never>, IBoardVirtuals>(
  {
    title: {
      type: String,
      required: [true, "Board title is required"],
      trim: true,
      maxlength: [120, "Board title cannot exceed 120 characters"],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Columns live in their own collection — a board never embeds them.
    collaborators: { type: [collaboratorSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: toJSONOptions(),
    toObject: toJSONOptions(),
  },
);

// Supports the `collaborators.user` half of boardRepository.findForUser's $or.
boardSchema.index({ "collaborators.user": 1 });

boardSchema.virtual("name").get(function (this: HydratedDocument<IBoard>) {
  return this.title;
});

export const Board = model<IBoard, BoardModel>("Board", boardSchema);

export default Board;
