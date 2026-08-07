import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { toJSONOptions } from "./transforms";

export interface IActivityLog {
  boardId: Types.ObjectId;
  user: Types.ObjectId;
  /** Machine-readable verb, e.g. "task.moved". */
  action: string;
  /** Human-readable line, e.g. "Task moved to Done by Illona". */
  message: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ActivityLogModel = Model<IActivityLog>;
export type ActivityLogDocument = HydratedDocument<IActivityLog>;

const activityLogSchema = new Schema<IActivityLog, ActivityLogModel>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    meta: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: toJSONOptions(),
    toObject: toJSONOptions(),
  },
);

// The feed is always "this board, newest first" - paginated.
activityLogSchema.index({ boardId: 1, createdAt: -1 });

export const ActivityLog = model<IActivityLog, ActivityLogModel>(
  "ActivityLog",
  activityLogSchema,
);

export default ActivityLog;
