import { Toaster } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';

export function ToastProvider() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
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
          iconTheme: {
            primary: '#EA5555',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  );
}
