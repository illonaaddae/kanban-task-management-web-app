import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { toJSONOptions } from "./transforms";

export interface IColumn {
  title: string;
  boardId: Types.ObjectId;
  /** Zero-based order within the board. */
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IColumnVirtuals {
  /** Mirrors `title` so the existing frontend `Column.name` keeps working. */
  name: string;
}

export type ColumnDocument = HydratedDocument<IColumn, IColumnVirtuals>;

// The 5th generic pins the hydrated type, so query results carry the `name`
// virtual instead of Mongoose inferring a virtual-less document.
export type ColumnModel = Model<
  IColumn,
  Record<string, never>,
  Record<string, never>,
  IColumnVirtuals,
  ColumnDocument
>;

const columnSchema = new Schema<IColumn, ColumnModel, Record<string, never>, Record<string, never>, IColumnVirtuals>(
  {
    title: {
      type: String,
      required: [true, "Column title is required"],
      trim: true,
      maxlength: [80, "Column title cannot exceed 80 characters"],
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    position: {
      type: Number,
      required: true,
      min: [0, "Position cannot be negative"],
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: toJSONOptions(),
    toObject: toJSONOptions(),
  },
);

// Every column read is "this board's columns, in order".
columnSchema.index({ boardId: 1, position: 1 });

columnSchema.virtual("name").get(function (this: HydratedDocument<IColumn>) {
  return this.title;
});

export const Column = model<IColumn, ColumnModel>("Column", columnSchema);

export default Column;
