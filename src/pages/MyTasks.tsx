import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskListSkeleton } from '../components/ui/Skeletons';
import { EmptyState, EMPTY_ICONS } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { useMyTasks } from '../queries/orgs';
import type { AssignedTask } from '../services/orgApi';
import styles from './MyTasks.module.css';

type Filter = 'open' | 'overdue' | 'done' | 'all';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'open', label: 'To do' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

function dueLabel(task: AssignedTask): string | null {
  if (!task.dueDate) return null;

  const due = new Date(task.dueDate);
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000);

  if (task.isOverdue) {
    const late = Math.abs(days);
    return late === 0 ? 'Due today' : `${late} day${late === 1 ? '' : 's'} overdue`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1 && days <= 7) return `Due in ${days} days`;

  return `Due ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

/**
 * Everything assigned to the signed-in user, across every board they can reach.
 *
 * This is the view a team member actually needs: their own work, not a board they
 * have to find first. Boards resolve through the same union as the board list, so
 * a task on a team board appears without anyone inviting them to that board.
 */
export function MyTasks() {
  const { data: tasks = [], isPending, error } = useMyTasks();
  const [filter, setFilter] = useState<Filter>('open');

  const counts = useMemo(
    () => ({
      open: tasks.filter((task) => !task.isDone).length,
      overdue: tasks.filter((task) => task.isOverdue).length,
      done: tasks.filter((task) => task.isDone).length,
      all: tasks.length,
    }),
    [tasks],
  );

  const visible = useMemo(() => {
    switch (filter) {
      case 'open':
        return tasks.filter((task) => !task.isDone);
      case 'overdue':
        return tasks.filter((task) => task.isOverdue);
      case 'done':
        return tasks.filter((task) => task.isDone);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  /** Grouped by board, so the list reads as "where my work lives". */
  const grouped = useMemo(() => {
    const byBoard = new Map<string, { name: string; tasks: AssignedTask[] }>();
    for (const task of visible) {
      const entry = byBoard.get(task.board.id);
      if (entry) entry.tasks.push(task);
      else byBoard.set(task.board.id, { name: task.board.name, tasks: [task] });
    }
    return [...byBoard.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [visible]);

  if (isPending) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>
          <TaskListSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>My tasks</h1>
        <p className={styles.subtitle}>
          Everything assigned to you, on every board you can reach - including your
          teams&rsquo; boards.
        </p>
      </header>

      {error ? (
        <EmptyState
          icon={EMPTY_ICONS.search}
          title="Could not load your tasks"
          body={error instanceof Error ? error.message : 'Something went wrong'}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={EMPTY_ICONS.check}
          title="Nothing assigned to you yet"
          body="When somebody assigns you a task, on any board you can reach, it shows up here. Your teams' boards count too."
          action={
            <Link to="/teams">
              <Button variant="secondary">Go to your teams</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className={styles.filters} role="tablist" aria-label="Filter tasks">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                className={`${styles.filter} ${
                  filter === option.value ? styles.filterActive : ''
                } ${option.value === 'overdue' && counts.overdue > 0 ? styles.filterAlert : ''}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
                <span className={styles.filterCount}>{counts[option.value]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              compact
              icon={EMPTY_ICONS.check}
              title={
                filter === 'overdue'
                  ? 'Nothing overdue'
                  : filter === 'done'
                    ? 'Nothing finished yet'
                    : 'Nothing here'
              }
              body={
                filter === 'overdue'
                  ? 'Every task assigned to you is either finished or still within its due date.'
                  : 'Try another filter to see the rest of your work.'
              }
            />
          ) : (
            grouped.map(([boardId, group]) => (
              <section key={boardId} className={styles.group}>
                <div className={styles.groupHead}>
                  <h2 className={styles.groupTitle}>{group.name}</h2>
                  {/* Straight to the board, which is where the work gets done. */}
                  <Link className={styles.groupLink} to={`/board/${boardId}`}>
                    Open board
                  </Link>
                </div>

                <div className={styles.list}>
                  {group.tasks.map((task) => {
                    const due = dueLabel(task);

                    return (
                      <Link
                        key={task.id}
                        to={`/board/${boardId}`}
                        className={`${styles.task} ${task.isDone ? styles.taskDone : ''}`}
                      >
                        <div className={styles.taskMain}>
                          <div className={styles.taskTitle}>{task.title}</div>
                          <div className={styles.taskMeta}>
                            <span className={styles.column}>{task.column.name}</span>
                            {task.subtasks.total > 0 && (
                              <span>
                                {task.subtasks.completed} of {task.subtasks.total} subtasks
                              </span>
                            )}
                            {due && (
                              <span className={task.isOverdue ? styles.overdue : undefined}>
                                {due}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </main>
  );
}

export default MyTasks;
