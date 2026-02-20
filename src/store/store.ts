import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type AuthState, createAuthSlice } from "./authSlice";
import type { BoardState } from "./boardTypes";
import { createBoardSlice } from "./boardSlice";
import { createTaskSlice } from "./taskSlice";

export type StoreState = AuthState & BoardState;
export type StoreSet = (partial: Partial<StoreState>) => void;
export type StoreGet = () => StoreState;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...createAuthSlice(set as StoreSet, get),
      ...createBoardSlice(set as StoreSet, get),
      ...createTaskSlice(set as StoreSet, get),
    }),
    {
      name: "kanban-storage-v2",
      partialize: (state) => ({
        user: state.user,
        // Do NOT persist isAuthenticated — it must be verified
        // by checkSession on each app load to prevent stale logins.
      }),
    },
  ),
);
