import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { BoardProvider } from '../context/BoardContext';
import { ThemeProvider } from '../context/ThemeContext';

// All providers wrapper
function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <BoardProvider>
            {children}
          </BoardProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

// Custom render with all providers
function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { renderWithProviders };
