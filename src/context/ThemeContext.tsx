import { createContext, useCallback, useContext, type ReactNode, useEffect } from 'react';
import { useKanbanStore } from '../store/kanbanStore';
import { saveThemePreference } from '../services/userApi';
import type { ThemeContextType } from '../types';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useKanbanStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleLocalTheme = useKanbanStore((state) => state.toggleTheme);

  /**
   * Flip locally, then tell the server.
   *
   * The write is fire-and-forget: the UI has already repainted, and blocking the
   * toggle on a round trip would make it feel broken on a slow connection. It is
   * a no-op when signed out, so the login screen never fires a 401.
   */
  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    toggleLocalTheme();
    saveThemePreference(next);
  }, [theme, toggleLocalTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
 
}
