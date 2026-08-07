import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '../ChatPanel';
import { renderWithProviders } from '../../../test/utils';
import * as boardQueries from '../../../queries/boards';
import * as orgQueries from '../../../queries/orgs';
import * as mutations from '../../../queries/mutations';
import type { Board } from '../../../types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// The queries are gated on `tokenStore.isAuthenticated`, so the board and the AI
// status are fixtures here rather than the thing under test. What is under test is
// what the panel does with a reply.
vi.mock('../../../queries/boards');
vi.mock('../../../queries/orgs');
vi.mock('../../../queries/mutations');

const board: Board = {
  id: 'b1',
  name: 'Platform Launch',
  columns: [
    {
      id: 'c-todo',
      name: 'Todo',
      tasks: [
        { id: 't-login', title: 'Fix the login redirect', description: '', status: 'Todo', subtasks: [] },
      ],
    },
    { id: 'c-done', name: 'Done', tasks: [] },
  ],
  members: [],
} as unknown as Board;

const movePlan = {
  action: 'move_task' as const,
  taskTitle: 'Fix the login redirect',
  columnName: 'Done',
  assigneeName: '',
  dueDate: '',
  newTaskTitle: '',
  summary: 'Move it to Done.',
};

const sendChat = vi.fn();
const moveTask = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  sendChat.mockReset();
  moveTask.mockResolvedValue(undefined);

  vi.mocked(orgQueries.useAiStatus).mockReturnValue({
    data: { enabled: true, model: 'test-model' },
  } as unknown as ReturnType<typeof orgQueries.useAiStatus>);

  vi.mocked(orgQueries.useBoardChat).mockReturnValue({
    mutateAsync: sendChat,
    isPending: false,
  } as unknown as ReturnType<typeof orgQueries.useBoardChat>);

  vi.mocked(boardQueries.useBoard).mockReturnValue({
    data: board,
  } as unknown as ReturnType<typeof boardQueries.useBoard>);

  vi.mocked(mutations.useMoveTask).mockReturnValue({
    mutateAsync: moveTask,
  } as unknown as ReturnType<typeof mutations.useMoveTask>);
  vi.mocked(mutations.useUpdateTask).mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof mutations.useUpdateTask>);
  vi.mocked(mutations.useCreateTask).mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof mutations.useCreateTask>);
});

function render(onClose = vi.fn()) {
  renderWithProviders(<ChatPanel isOpen boardId="b1" onClose={onClose} />);
  return onClose;
}

async function ask(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Message'), text);
  await user.click(screen.getByRole('button', { name: 'Send' }));
  return user;
}

describe('ChatPanel', () => {
  it('renders nothing when the assistant is not configured', () => {
    vi.mocked(orgQueries.useAiStatus).mockReturnValue({
      data: { enabled: false, model: null },
    } as unknown as ReturnType<typeof orgQueries.useAiStatus>);

    render();
    // No key on the server means no entry point at all, rather than a button that
    // fails when pressed.
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
  });

  it('shows the answer and sends the transcript back on the next turn', async () => {
    sendChat
      .mockResolvedValueOnce({ reply: 'Two tasks are open.', action: null })
      .mockResolvedValueOnce({ reply: 'One of them is overdue.', action: null });

    render();
    const user = await ask('what is open?');

    expect(await screen.findByText('Two tasks are open.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Message'), 'any overdue?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2));
    // The transcript is client state; the server keeps nothing between turns, so a
    // follow-up that dropped the earlier turns would lose the thread.
    expect(sendChat.mock.calls[1][0].messages).toEqual([
      { role: 'user', content: 'what is open?' },
      { role: 'assistant', content: 'Two tasks are open.' },
      { role: 'user', content: 'any overdue?' },
    ]);
  });

  it('offers a change without making it, then applies it once confirmed', async () => {
    sendChat.mockResolvedValue({ reply: 'I can move it.', action: movePlan });

    render();
    const user = await ask('move the login fix to done');

    expect(await screen.findByText(/Move "Fix the login redirect"/)).toBeInTheDocument();
    // Answering is not doing: nothing is written until the button is pressed.
    expect(moveTask).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Do it' }));

    await waitFor(() =>
      expect(moveTask).toHaveBeenCalledWith({
        taskId: 't-login',
        columnId: 'c-done',
        position: 0,
        boardId: 'b1',
      }),
    );

    // The button is replaced rather than left live, so a second click cannot move it
    // again.
    expect(await screen.findByText('Applied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Do it' })).not.toBeInTheDocument();
  });

  it('shows why a proposed change cannot be made, with no button', async () => {
    sendChat.mockResolvedValue({
      reply: 'Moving that one.',
      action: { ...movePlan, taskTitle: 'A task that does not exist' },
    });

    render();
    await ask('move the thing');

    expect(await screen.findByText(/No task called/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Do it' })).not.toBeInTheDocument();
  });

  it('leaves a failed turn in the transcript instead of only a toast', async () => {
    sendChat.mockRejectedValue(new Error('Too many requests. Try again in a minute.'));

    render();
    await ask('what is open?');

    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
    // The question stays visible, so it is clear which one went unanswered.
    expect(screen.getByText('what is open?')).toBeInTheDocument();
  });

  it('refuses to send an empty or one-character message', async () => {
    const user = userEvent.setup();
    render();

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.type(screen.getByLabelText('Message'), 'a');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('sends an opener when one is clicked', async () => {
    sendChat.mockResolvedValue({ reply: 'Nothing is overdue.', action: null });

    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'What is overdue?' }));

    await waitFor(() =>
      expect(sendChat).toHaveBeenCalledWith({
        boardId: 'b1',
        messages: [{ role: 'user', content: 'What is overdue?' }],
      }),
    );
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = render();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
