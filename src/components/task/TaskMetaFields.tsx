import { useEffect } from 'react';
import { useStore } from '../../store/store';
import { useShallow } from 'zustand/react/shallow';
import { Input } from '../ui/Input';
import { Dropdown } from '../ui/Dropdown';

const UNASSIGNED = '';

interface TaskMetaFieldsProps {
  boardId: string;
  /** `yyyy-mm-dd`, the value a native date input expects. Empty means no date. */
  dueDate: string;
  onDueDateChange: (value: string) => void;
  /** A member id, or '' for unassigned. */
  assignedTo: string;
  onAssignedToChange: (value: string) => void;
}

/**
 * Due date and assignee, shared by the add and edit task modals.
 *
 * The assignee list is the board's own members (owner + collaborators) because
 * the API rejects an assignee who is not one — offering anyone else would just
 * produce a 400 on submit.
 */
export function TaskMetaFields({
  boardId,
  dueDate,
  onDueDateChange,
  assignedTo,
  onAssignedToChange,
}: TaskMetaFieldsProps) {
  const { members, fetchMembers } = useStore(
    useShallow((state) => ({
      members: state.members,
      fetchMembers: state.fetchMembers,
    })),
  );

  useEffect(() => {
    if (boardId) void fetchMembers(boardId);
  }, [boardId, fetchMembers]);

  const assigneeOptions = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...members.map((member) => ({
      value: member.id,
      label: member.role === 'owner' ? `${member.name} (owner)` : member.name,
    })),
  ];

  return (
    <>
      <Input
        label="Due date"
        type="date"
        value={dueDate}
        onChange={(event) => onDueDateChange(event.target.value)}
      />
      <Dropdown
        label="Assignee"
        value={assignedTo}
        onChange={onAssignedToChange}
        options={assigneeOptions}
        placeholder="Unassigned"
      />
    </>
  );
}
