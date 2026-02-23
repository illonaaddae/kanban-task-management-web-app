import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { useStore } from '../../store/store';
import { Dashboard } from '../Dashboard';

vi.mock('../../store/store', async () => {
  const actual = await vi.importActual<typeof import('../../store/store')>('../../store/store');
  return { ...actual };
});

const mockBoards = [
  {
    id: 'b1',
    name: 'Marketing Plan',
    columns: [
      { name: 'Todo', tasks: [{ id: 't1', title: 'Task A', description: '', status: 'Todo', subtasks: [] }] },
      { name: 'Done', tasks: [] },
    ],
  },
  {
    id: 'b2',
    name: 'Roadmap',
    columns: [],
  },
];

function renderDashboard() {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
}

describe('Dashboard', () => {
  const fetchBoards = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      boards: [],
      boardLoading: false,
      boardError: null,
      user: { id: 'u1', name: 'Test User', email: 'test@test.com' },
      fetchBoards,
    } as any);
  });

  it('shows a loading spinner when boardLoading is true', () => {
    useStore.setState({ boardLoading: true } as any);
    renderDashboard();
    expect(screen.getByText(/loading your boards/i)).toBeInTheDocument();
  });

  it('shows an error message and retry button when boardError is set', () => {
    useStore.setState({ boardError: 'Network error' } as any);
    renderDashboard();
    expect(screen.getByText(/could not load boards/i)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry calls fetchBoards with the user id', async () => {
    const user = userEvent.setup();
    useStore.setState({ boardError: 'Oops', fetchBoards } as any);
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(fetchBoards).toHaveBeenCalledWith('u1');
  });

  it('shows empty state when there are no boards', () => {
    renderDashboard();
    expect(screen.getByText(/no boards yet/i)).toBeInTheDocument();
  });

  it('renders a card for each board', () => {
    useStore.setState({ boards: mockBoards } as any);
    renderDashboard();
    expect(screen.getByText('Marketing Plan')).toBeInTheDocument();
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
  });

  it('displays the column and task counts for each board', () => {
    useStore.setState({ boards: mockBoards } as any);
    renderDashboard();
    // Marketing Plan: 2 columns, 1 task
    expect(screen.getByText('2 columns')).toBeInTheDocument();
    expect(screen.getByText('1 tasks')).toBeInTheDocument();
  });
});
