import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { toJSONOptions } from "./transforms";

export interface ISubtask {
  title: string;
  isCompleted: boolean;
}

export interface ITask {
  title: string;
  description: string;
  boardId: Types.ObjectId;
  columnId: Types.ObjectId;
  /** Zero-based order within the column. */
  position: number;
  /**
   * Denormalised copy of the parent column's title. The existing frontend
   * groups tasks by `status`, so it is kept in sync on move and on column
   * rename rather than being derived per request.
   */
  status: string;
  assignedTo?: Types.ObjectId;
  dueDate?: Date;
  subtasks: ISubtask[];
  createdAt: Date;
  updatedAt: Date;
}

export type TaskModel = Model<ITask>;
export type TaskDocument = HydratedDocument<ITask>;

const subtaskSchema = new Schema<ISubtask>(
  {
    title: {
      type: String,
      required: [true, "Subtask title is required"],
      trim: true,
      maxlength: [200, "Subtask title cannot exceed 200 characters"],
    },
    isCompleted: { type: Boolean, default: false },
  },
  // The frontend replaces the whole subtasks array on every edit, so per-item
  // ids would be generated and discarded on each write.
  { _id: false },
);

const taskSchema = new Schema<ITask, TaskModel>(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Task title cannot exceed 200 characters"],
    },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    columnId: {
      type: Schema.Types.ObjectId,
      ref: "Column",
      required: true,
      index: true,
    },
    position: {
      type: Number,
      required: true,
      min: [0, "Position cannot be negative"],
      default: 0,
    },
    status: { type: String, required: true, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: { type: Date, default: null },
    subtasks: { type: [subtaskSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: toJSONOptions(),
    toObject: toJSONOptions(),
  },
);

// Serves both the ordered column read and the position shifts done on move.
taskSchema.index({ columnId: 1, position: 1 });

export const Task = model<ITask, TaskModel>("Task", taskSchema);

export default Task;
