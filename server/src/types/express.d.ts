import type { BoardDocument } from "../models/Board";
import type { ColumnDocument } from "../models/Column";
import type { TaskDocument } from "../models/Task";
import type { UserDocument } from "../models/User";
import type { OrganizationDocument } from "../models/Organization";
import type { EffectiveRole } from "../middlewares/boardAccess";
import type { EffectiveOrgRole } from "../middlewares/orgAccess";

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

      /** Set by `boardAccess` - the board the request was authorised against. */
      board?: BoardDocument;

      /** Set by `boardAccess` - the caller's effective role on that board. */
      myRole?: EffectiveRole;

      /** Set by `orgAccess` - the organization the request was authorised against. */
      organization?: OrganizationDocument;

      /** Set by `orgAccess` - the caller's effective role in that organization. */
      myOrgRole?: EffectiveOrgRole;

      /** Set by `loadColumn`. */
      column?: ColumnDocument;

      /** Set by `loadTask`. */
      task?: TaskDocument;
    }
  }
}

export {};
