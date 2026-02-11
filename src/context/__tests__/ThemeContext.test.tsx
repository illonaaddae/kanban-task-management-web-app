import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useKanbanStore } from '../../store/kanbanStore';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Zustand persist key and structure
const KANBAN_STORE_KEY = 'kanban-store';

function getStoredTheme(): string | null {
  try {
    const raw = localStorage.getItem(KANBAN_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.theme ?? null;
  } catch {
    return null;
  }
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    useKanbanStore.setState({ theme: 'light' });
  });

  it('should initialize with light theme by default', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.theme).toBe('light');
  });

  it('should use dark theme when store has dark theme', () => {
    useKanbanStore.setState({ theme: 'dark' });

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.theme).toBe('dark');
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

    expect(getStoredTheme()).toBe('dark');
  });

  it('should toggle theme from dark to light', async () => {
    useKanbanStore.setState({ theme: 'dark' });

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

    expect(getStoredTheme()).toBe('light');
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
