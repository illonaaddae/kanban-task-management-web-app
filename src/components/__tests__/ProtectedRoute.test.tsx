import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { ProtectedRoute } from '../ProtectedRoute';

function TestComponent() {
  return <div>Protected Content</div>;
}

function LoginPage() {
  return <div>Login Page</div>;
}

async function renderProtectedRoute(isAuthenticated = false) {
  if (isAuthenticated) {
    localStorage.setItem('kanban_user', 'admin');
  } else {
    localStorage.clear();
  }

  let result;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  });
  
  return result;
}

describe('ProtectedRoute Component', () => {
  it('should redirect to login when not authenticated', async () => {
    await renderProtectedRoute(false);

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render protected content when authenticated', async () => {
    await renderProtectedRoute(true);

    // Wait for auth state to initialize from localStorage
    await waitFor(
      () => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
