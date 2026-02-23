import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddBoardModal } from '../AddBoardModal';
import { useStore } from '../../../store/store';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const createBoard = vi.fn();

function renderModal(isOpen = true) {
  useStore.setState({
    user: { id: 'u1', name: 'Test', email: 'test@test.com' },
    createBoard,
  } as any);
  return render(<AddBoardModal isOpen={isOpen} onClose={vi.fn()} />);
}

describe('AddBoardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBoard.mockResolvedValue({ id: 'new-b', name: 'New', columns: [] });
  });

  it('renders the modal title and input when open', () => {
    renderModal();
    expect(screen.getByText('Add New Board')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. Web Design/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderModal(false);
    expect(screen.queryByText('Add New Board')).not.toBeInTheDocument();
  });

  it('allows typing a board name', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByPlaceholderText(/e.g. Web Design/i) as HTMLInputElement;
    await user.type(input, 'My New Board');
    expect(input.value).toBe('My New Board');
  });

  it('calls createBoard with correct args when submitted', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText(/e.g. Web Design/i), 'Sprint Board');
    await user.click(screen.getByRole('button', { name: /create new board/i }));

    await waitFor(() => {
      expect(createBoard).toHaveBeenCalledWith('u1', {
        name: 'Sprint Board',
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'Todo' }),
          expect.objectContaining({ name: 'Doing' }),
        ]),
      });
    });
  });

  it('does not call createBoard when name is empty', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /create new board/i }));
    expect(createBoard).not.toHaveBeenCalled();
  });

  it('renders default column inputs (Todo, Doing)', () => {
    renderModal();
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const columnValues = inputs.map(i => i.value).filter(v => v === 'Todo' || v === 'Doing');
    expect(columnValues).toContain('Todo');
    expect(columnValues).toContain('Doing');
  });
});
