import { Toaster } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';

export function ToastProvider() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-center"
      /**
       * Toasts are the app's only feedback for "invited", "moved", "could not save",
       * so a screen reader has to hear them and an error has to interrupt rather
       * than wait for a pause. react-hot-toast leaves both to the caller: each
       * toast gets its own live region through `ariaProps` below.
       */
      toastOptions={{
        duration: 3000,
        ariaProps: { role: 'status', 'aria-live': 'polite' },
        style: {
          background: theme === 'dark' ? '#20212C' : '#FFFFFF',
          color: theme === 'dark' ? '#FFFFFF' : '#000112',
          border: `1px solid ${theme === 'dark' ? '#3E3F4E' : '#E4EBFA'}`,
        },
        success: {
          iconTheme: {
            primary: '#635FC7',
            secondary: '#FFFFFF',
          },
        },
        error: {
          // Assertive, and longer: an error the user missed is one they will hit
          // again.
          ariaProps: { role: 'alert', 'aria-live': 'assertive' },
          duration: 5000,
          iconTheme: {
            primary: '#EA5555',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  );
}
