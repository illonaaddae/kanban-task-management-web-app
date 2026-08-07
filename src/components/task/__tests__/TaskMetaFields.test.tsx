import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskMetaFields } from '../TaskMetaFields';
import { renderWithProviders } from '../../../test/utils';
import * as boardQueries from '../../../queries/boards';

// `useBoardMembers` is gated on `tokenStore.isAuthenticated`, so against the real
// hook the list stays empty in tests. The member list is the fixture here, not the
// thing under test.
vi.mock('../../../queries/boards');

function render() {
  return renderWithProviders(
    <TaskMetaFields
      boardId="board-1"
      dueDate=""
      onDueDateChange={vi.fn()}
      assignedTo=""
      onAssignedToChange={vi.fn()}
    />,
  );
}

describe('TaskMetaFields assignee list', () => {
  beforeEach(() => {
    vi.mocked(boardQueries.useBoardMembers).mockReturnValue({
      data: [
        { id: 'u-owner', name: 'Owner Person', email: 'owner@example.com', role: 'owner', via: 'owner' },
        { id: 'u-collab', name: 'Invited Person', email: 'invited@example.com', role: 'editor', via: 'collaborator' },
      // Reaches the board through the team rather than an invitation. The API
      // accepts them as an assignee, so the picker has to offer them.
        { id: 'u-team', name: 'Team Person', email: 'team@example.com', role: 'editor', via: 'team' },
      ],
      // Only `data` is read; asserting the whole UseQueryResult shape would be noise.
    } as unknown as ReturnType<typeof boardQueries.useBoardMembers>);
  });

  it('offers a teammate who has no collaborator entry', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /Unassigned/ }));

    // The bug this covers: assignable server-side but missing from the dropdown,
    // so a team board could not have work handed to the team.
    expect(await screen.findByText('Team Person')).toBeInTheDocument();
    expect(screen.getByText('Invited Person')).toBeInTheDocument();
    expect(screen.getByText(/Owner Person/)).toBeInTheDocument();
  });

  it('marks the board owner, so two similar names are distinguishable', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /Unassigned/ }));

    expect(await screen.findByText('Owner Person (owner)')).toBeInTheDocument();
  });

  it('keeps Unassigned available', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /Unassigned/ }));

    // A task must be un-assignable, not only assignable.
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
  });
});
