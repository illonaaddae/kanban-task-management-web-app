import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('should initialize with light theme by default', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.theme).toBe('light');
  });

  it('should persist theme to localStorage', async () => {
    localStorage.setItem('kanban-theme', JSON.stringify('dark'));

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    // useLocalStorage reads from localStorage on mount
    await waitFor(() => {
      expect(result.current.theme).toBe('dark');
    });
  });

  it('should toggle theme from light to dark', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    await waitFor(() => {
      expect(result.current.theme).toBe('dark');
    });

    expect(JSON.parse(localStorage.getItem('kanban-theme') || '""')).toBe('dark');
  });

  it('should toggle theme from dark to light', async () => {
    localStorage.setItem('kanban-theme', JSON.stringify('dark'));

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(result.current.theme).toBe('dark');
    });

    act(() => {
      result.current.toggleTheme();
    });

    await waitFor(() => {
      expect(result.current.theme).toBe('light');
    });

    expect(JSON.parse(localStorage.getItem('kanban-theme') || '""')).toBe('light');
  });

  it('should apply theme class to document element', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => {
      result.current.toggleTheme();
    });

    await waitFor(() => {
      expect(document.documentElement.className).toContain('dark');
    });
  });
});
