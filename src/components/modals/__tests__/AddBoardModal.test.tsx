import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddBoardModal } from '../AddBoardModal';
import { renderWithProviders } from '../../../test/utils';
import * as boardApi from '../../../services/boardApi';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// The modal creates boards through the React Query mutation, so the seam worth
// asserting on is the API module underneath it - not the store, which no longer
// holds board data.
vi.mock('../../../services/boardApi');

function renderModal(isOpen = true) {
  return renderWithProviders(<AddBoardModal isOpen={isOpen} onClose={vi.fn()} />);
}

describe('AddBoardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(boardApi.createBoard).mockResolvedValue({
      id: 'new-b',
      name: 'New',
      columns: [],
    });
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

  it('creates the board with the typed name and columns when submitted', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText(/e.g. Web Design/i), 'Sprint Board');
    await user.click(screen.getByRole('button', { name: /create new board/i }));

    await waitFor(() => {
      expect(boardApi.createBoard).toHaveBeenCalledWith('', {
        name: 'Sprint Board',
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'Todo' }),
          expect.objectContaining({ name: 'Doing' }),
        ]),
      });
    });
  });

  it('does not create a board when the name is empty', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /create new board/i }));
    expect(boardApi.createBoard).not.toHaveBeenCalled();
  });

  it('adds a column row without submitting the form', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText(/e.g. Web Design/i), 'Sprint Board');

    await user.click(screen.getByRole('button', { name: /add new column/i }));

    // Regression: Button rendered a bare <button>, which inside a form defaults
    // to type="submit" - so this click created the board instead of adding a row.
    expect(boardApi.createBoard).not.toHaveBeenCalled();
    expect(screen.getAllByPlaceholderText('e.g. Todo')).toHaveLength(3);
  });

  it('renders default column inputs (Todo, Doing)', () => {
    renderModal();
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const columnValues = inputs.map(i => i.value).filter(v => v === 'Todo' || v === 'Doing');
    expect(columnValues).toContain('Todo');
    expect(columnValues).toContain('Doing');
  });
});
