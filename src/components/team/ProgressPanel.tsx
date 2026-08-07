import { useBoardProgress } from '../../queries/orgs';
import { Loader } from '../ui/Loader';
import type { MemberProgress } from '../../services/orgApi';
import styles from './ProgressPanel.module.css';

interface ProgressPanelProps {
  boardId: string | undefined;
  /** Rendered above the table; omitted when the caller supplies its own heading. */
  showTotals?: boolean;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function Avatar({ row }: { row: MemberProgress }) {
  if (row.avatar) return <img className={styles.avatar} src={row.avatar} alt="" />;
  return (
    <div
      className={`${styles.initials} ${row.userId === null ? styles.initialsMuted : ''}`}
      aria-hidden="true"
    >
      {row.userId === null ? '?' : initialsOf(row.name)}
    </div>
  );
}

/**
 * Who is carrying what on one board.
 *
 * Scoped to a single board deliberately. A team-wide roll-up would have to span
 * boards the viewer may not have access to, and nothing links a board to a team,
 * so the number would either leak or be wrong.
 */
export function ProgressPanel({ boardId, showTotals = true }: ProgressPanelProps) {
  const { data: progress, isPending, error } = useBoardProgress(boardId);

  if (!boardId) {
    return <p className={styles.empty}>Pick a board to see who is working on what.</p>;
  }

  if (isPending) {
    return (
      <div className={styles.loading}>
        <Loader />
      </div>
    );
  }

  if (error || !progress) {
    return (
      <p className={styles.empty}>
        {error instanceof Error ? error.message : 'Could not load progress for this board.'}
      </p>
    );
  }

  if (progress.totals.tasks === 0) {
    return (
      <p className={styles.empty}>
        No tasks on this board yet — progress shows up once there is work to do.
      </p>
    );
  }

  return (
    <div>
      {showTotals && (
        <div className={styles.totals}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{progress.totals.tasks}</span>
            <span className={styles.statLabel}>tasks</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{progress.totals.completed}</span>
            <span className={styles.statLabel}>
              in {progress.doneColumn ?? 'the last column'}
            </span>
          </div>
          <div className={`${styles.stat} ${progress.totals.overdue > 0 ? styles.statAlert : ''}`}>
            <span className={styles.statValue}>{progress.totals.overdue}</span>
            <span className={styles.statLabel}>overdue</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{progress.totals.unassigned}</span>
            <span className={styles.statLabel}>unassigned</span>
          </div>
        </div>
      )}

      {/* Wide content scrolls inside its own container so the page never scrolls
          sideways on a phone. */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Assigned</th>
              <th scope="col">Done</th>
              <th scope="col">Overdue</th>
              <th scope="col">Subtasks</th>
              <th scope="col" className={styles.barHead}>Completion</th>
            </tr>
          </thead>
          <tbody>
            {progress.members.map((row) => (
              <tr key={row.userId ?? 'unassigned'}>
                <td>
                  <div className={styles.person}>
                    <Avatar row={row} />
                    <div className={styles.identity}>
                      <div className={styles.name}>{row.name}</div>
                      {row.email && <div className={styles.email}>{row.email}</div>}
                    </div>
                  </div>
                </td>
                <td className={styles.num}>{row.assigned}</td>
                <td className={styles.num}>{row.completed}</td>
                <td className={`${styles.num} ${row.overdue > 0 ? styles.overdue : ''}`}>
                  {row.overdue}
                </td>
                <td className={styles.num}>
                  {row.subtasks.total === 0
                    ? '—'
                    : `${row.subtasks.completed}/${row.subtasks.total}`}
                </td>
                <td>
                  <div className={styles.barRow}>
                    <div
                      className={styles.bar}
                      role="progressbar"
                      aria-valuenow={row.completionRate}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${row.name} completion`}
                    >
                      <div
                        className={styles.barFill}
                        style={{ width: `${row.completionRate}%` }}
                      />
                    </div>
                    <span className={styles.barValue}>{row.completionRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.footnote}>
        “Done” means the last column on the board
        {progress.doneColumn ? ` (${progress.doneColumn})` : ''} — renaming it changes
        nothing, moving a task does.
      </p>
    </div>
  );
}
