import { useTheme } from '../../context/ThemeContext';
import styles from './ThemeToggleButton.module.css';

/**
 * A single icon button that flips the theme.
 *
 * The app has a labelled sun/moon switch in the sidebar, but the public pages have
 * no sidebar to put it in, which left a signed-out visitor with whatever theme the
 * store defaulted to and no way to change it. This is the compact form for a nav
 * bar: one button, no track, showing the theme it will switch *to*.
 *
 * `useTheme` writes the preference to the server as well, and that call is a no-op
 * when signed out, so this works on the marketing page without firing a 401.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={`${styles.button} ${className ?? ''}`}
      onClick={toggleTheme}
      // Named by what it does, not by what is showing: a button labelled "dark" is
      // ambiguous about whether that is the state or the outcome.
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      {theme === 'dark' ? (
        // Sun: pressing it brings the light theme.
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
