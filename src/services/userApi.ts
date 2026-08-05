import { api } from "./api";
import { tokenStore } from "./api";
import type { Theme } from "../types";

/**
 * Persists the theme choice.
 *
 * Fire-and-forget by design: the toggle has already repainted the UI, and a
 * failed write is not worth a toast in the user's face — the preference simply
 * does not follow them to their next device. Skipped entirely when not signed
 * in, which is why this never 401s on the login screen.
 */
export function saveThemePreference(themePreference: Theme): void {
  if (!tokenStore.isAuthenticated) return;

  void api
    .patch("/users/me", { themePreference })
    .catch((error) =>
      console.warn("Could not save the theme preference:", error?.message ?? error),
    );
}
