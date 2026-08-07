import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../Dashboard';
import * as boardApi from '../../services/boardApi';
import { ACCESS_TOKEN_KEY } from '../../services/api';

// The Dashboard now reads through a query, so the seam moved from the store to
// the service. Mocking here also exercises the real query wiring - keys,
// enabled, loading and error states - rather than a hand-set store snapshot.
vi.mock('../../services/boardApi');

const mockBoards = [
  {
    id: 'b1',
    name: 'Marketing Plan',
    myRole: 'owner' as const,
    columns: [
      {
        id: 'c1',
        name: 'Todo',
        tasks: [
          { id: 't1', title: 'Task A', description: '', status: 'Todo', subtasks: [] },
        ],
      },
      { id: 'c2', name: 'Done', tasks: [] },
    ],
  },
  { id: 'b2', name: 'Roadmap', myRole: 'owner' as const, columns: [] },
];

function renderDashboard() {
  // Retries off, so an error test fails fast instead of waiting out backoff.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The query is gated on being signed in.
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
  });

  afterEach(() => localStorage.clear());

  it('shows a loading state while boards are being fetched', () => {
    vi.mocked(boardApi.getBoards).mockReturnValue(new Promise(() => {}));

    renderDashboard();

    // The skeleton announces the wait once through an aria-live region rather
    // than printing a caption, so assert on the accessible name.
    expect(
      screen.getByRole('status', { name: /loading your boards/i }),
    ).toBeInTheDocument();
  });

  it('shows the failure message and a retry button when the fetch fails', async () => {
    vi.mocked(boardApi.getBoards).mockRejectedValue(new Error('Network error'));

    renderDashboard();

    expect(await screen.findByText(/could not load your boards/i)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('retry refetches', async () => {
    const user = userEvent.setup();
    vi.mocked(boardApi.getBoards).mockRejectedValue(new Error('Oops'));

    renderDashboard();
    await screen.findByRole('button', { name: /try again/i });

    // One call for the initial fetch; retry makes another.
    expect(boardApi.getBoards).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(boardApi.getBoards).toHaveBeenCalledTimes(2));
  });

  it('shows the empty state when there are no boards', async () => {
    vi.mocked(boardApi.getBoards).mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText(/no boards yet/i)).toBeInTheDocument();
  });

  it('renders a card for each board', async () => {
    vi.mocked(boardApi.getBoards).mockResolvedValue(mockBoards);

    renderDashboard();

    expect(await screen.findByText('Marketing Plan')).toBeInTheDocument();
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
  });

  it('displays the column and task counts for each board', async () => {
    vi.mocked(boardApi.getBoards).mockResolvedValue(mockBoards);

    renderDashboard();

    // Marketing Plan: 2 columns, 1 task.
    expect(await screen.findByText('2 columns')).toBeInTheDocument();
    expect(screen.getByText('1 tasks')).toBeInTheDocument();
  });
});
