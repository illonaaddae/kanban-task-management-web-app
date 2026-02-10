import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with logged out state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should persist user session from localStorage', async () => {
    const mockUser = 'admin';
    localStorage.setItem('kanban_user', mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Wait for useEffect to run
    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
    });

    expect(result.current.user).toBe(mockUser);
  });

  it('should login with username', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    act(() => {
      result.current.login('admin');
    });

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
    });

    expect(result.current.user).toBe('admin');
    expect(localStorage.getItem('kanban_user')).toBe('admin');
  });

  it('should logout and clear session', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Login first
    act(() => {
      result.current.login('admin');
    });

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
    });

    // Then logout
    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('kanban_user')).toBeNull();
  });
});
