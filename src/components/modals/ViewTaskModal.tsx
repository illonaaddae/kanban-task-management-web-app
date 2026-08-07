import { useState } from 'react';
import { useUpdateTask, useMoveTask } from '../../queries/mutations';
import { useBoards, useBoardMembers } from '../../queries/boards';
import { type Task } from '../../types';
import { useBoardPermissions } from '../../hooks/useBoardPermissions';
import { Modal } from './Modal';
import { Checkbox } from '../ui/Checkbox';
import { Dropdown } from '../ui/Dropdown';
import { EditTaskModal } from './EditTaskModal';
import { DeleteTaskModal } from './DeleteTaskModal';
import { TaskActionsMenu } from '../task/TaskActionsMenu';
import toast from 'react-hot-toast';
import styles from './ViewTaskModal.module.css';

interface ViewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  boardIndex?: number;
  columnIndex?: number;
  taskIndex?: number;
  boardId: string;
}

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Midnight-to-midnight comparison, so "today" is never already overdue. */
function isOverdue(iso: string): boolean {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return false;

  const endOfDueDay = new Date(due);
  endOfDueDay.setHours(23, 59, 59, 999);
  return endOfDueDay.getTime() < Date.now();
}

export function ViewTaskModal({ isOpen, onClose, task, boardId }: ViewTaskModalProps) {
  const { data: boards = [] } = useBoards();
  const { data: members = [] } = useBoardMembers(boardId);
  const updateTask = useUpdateTask();
  const moveTask = useMoveTask();
  const { canEdit } = useBoardPermissions();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const board = boards.find(b => b.id === boardId);
  const statusOptions = board?.columns.map(col => ({ value: col.name, label: col.name })) || [];
  const completedCount = task.subtasks?.filter(st => st.isCompleted).length || 0;

  const assignee = task.assignedTo
    ? members.find(member => member.id === task.assignedTo)
    : undefined;

  const handleToggleSubtask = async (subtaskIndex: number) => {
    // Viewers see the checkboxes and their state, but cannot change them.
    if (!canEdit || !task.subtasks || !task.id) return;

    const updatedSubtasks = [...task.subtasks];
    updatedSubtasks[subtaskIndex] = {
      ...updatedSubtasks[subtaskIndex],
      isCompleted: !updatedSubtasks[subtaskIndex].isCompleted,
    };

    try {
      await updateTask.mutateAsync({ taskId: task.id, boardId, updates: { subtasks: updatedSubtasks } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the subtask');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit || !task.id || newStatus === task.status) return;

    try {
      const targetCol = board?.columns.find(c => c.name === newStatus);
      if (!targetCol?.id) return;
      await moveTask.mutateAsync({
        taskId: task.id,
        columnId: targetCol.id,
        position: targetCol.tasks.length,
        boardId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the status');
    }
  };

  if (!task) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className={styles.header}>
          <h2 className={styles.title}>{task.title}</h2>
          {canEdit && (
            <TaskActionsMenu
              onEdit={() => setShowEditModal(true)}
              onDelete={() => setShowDeleteModal(true)}
            />
          )}
        </div>
        <div className={styles.content}>
          <div className={styles.section}>
            {canEdit ? (
              <Dropdown
                label="Current Status"
                value={task.status}
                onChange={handleStatusChange}
                options={statusOptions}
              />
            ) : (
              // A disabled Dropdown would still look interactive; plain text
              // reads correctly as "this is information, not a control".
              <>
                <p className={styles.sectionTitle}>Current Status</p>
                <p className={styles.readOnlyValue}>{task.status}</p>
              </>
            )}
          </div>

          {task.description && <p className={styles.description}>{task.description}</p>}

          {(task.dueDate || assignee || task.assignedTo) && (
            <div className={styles.metaGrid}>
              {task.dueDate && (
                <div className={styles.metaItem}>
                  <p className={styles.sectionTitle}>Due date</p>
                  <p
                    className={`${styles.readOnlyValue} ${
                      isOverdue(task.dueDate) ? styles.overdue : ''
                    }`}
                  >
                    {formatDueDate(task.dueDate)}
                    {isOverdue(task.dueDate) && (
                      <span className={styles.overdueTag}>Overdue</span>
                    )}
                  </p>
                </div>
              )}
              {task.assignedTo && (
                <div className={styles.metaItem}>
                  <p className={styles.sectionTitle}>Assignee</p>
                  <p className={styles.readOnlyValue}>
                    {/* The name resolves once members load; the id alone is
                        never shown, since it means nothing to a reader. */}
                    {assignee ? assignee.name : 'Loading…'}
                  </p>
                </div>
              )}
            </div>
          )}

          {task.subtasks && task.subtasks.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                Subtasks ({completedCount} of {task.subtasks.length})
              </p>
              <div className={styles.subtasks}>
                {task.subtasks.map((subtask, index) => (
                  <Checkbox
                    key={index}
                    label={subtask.title}
                    checked={subtask.isCompleted}
                    disabled={!canEdit}
                    readOnly={!canEdit}
                    onChange={() => handleToggleSubtask(index)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
      {canEdit && task.id && (
        <EditTaskModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          boardId={boardId}
          task={task}
        />
      )}
      {canEdit && task.id && (
        <DeleteTaskModal
          isOpen={showDeleteModal}
          onClose={() => { setShowDeleteModal(false); onClose(); }}
          boardId={boardId}
          taskId={task.id}
          taskTitle={task.title}
        />
      )}
    </>
  );
}
