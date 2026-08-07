import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type AuthState, createAuthSlice } from "./authSlice";

/**
 * Session state only.
 *
 * Board, task and member data used to live here behind hand-written loading
 * flags and manual cache updates - which is where the duplicate creates, stale
 * lists and page-blanking spinners came from. That now belongs to React Query
 * (see src/queries), leaving this store responsible for the one thing it is
 * actually good at: who is signed in.
 */
export type StoreState = AuthState;
export type StoreSet = (partial: Partial<StoreState>) => void;

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      ...createAuthSlice(set as StoreSet),
    }),
    {
      name: "kanban-storage-v2",
      partialize: (state) => ({
        user: state.user,
        // Do NOT persist isAuthenticated - it must be verified
        // by checkSession on each app load to prevent stale logins.
      }),
    },
  ),
);
