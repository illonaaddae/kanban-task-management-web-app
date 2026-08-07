import { useBoardMembers } from '../../queries/boards';
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
  // Shared cache entry: the share modal asks for the same list, and both get
  // one request instead of a fetch each.
  const { data: members = [] } = useBoardMembers(boardId);

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
