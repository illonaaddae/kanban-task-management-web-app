import type { BoardDocument } from "../models/Board";
import type { ColumnDocument } from "../models/Column";
import type { TaskDocument } from "../models/Task";
import type { UserDocument } from "../models/User";
import type { EffectiveRole } from "../middlewares/boardAccess";

declare global {
  namespace Express {
    interface Request {
      /**
       * Set by the `protect` middleware. Present on every route mounted
       * behind it; undefined elsewhere.
       */
      user?: UserDocument;

      /**
       * Set by a resource loader (e.g. `loadColumn`) so `boardAccess` can
       * resolve the parent board without a board id in the path.
       */
      boardId?: string;

      /** Set by `boardAccess` — the board the request was authorised against. */
      board?: BoardDocument;

      /** Set by `boardAccess` — the caller's effective role on that board. */
      myRole?: EffectiveRole;

      /** Set by `loadColumn`. */
      column?: ColumnDocument;

      /** Set by `loadTask`. */
      task?: TaskDocument;
    }
  }
}

export {};
