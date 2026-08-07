import { useBoardProgress } from '../../queries/orgs';
import { StatsSkeleton } from '../ui/Skeletons';
import { EmptyState, EMPTY_ICONS } from '../ui/EmptyState';
import { BarList, Donut } from './Charts';
import styles from './ProgressPanel.module.css';

interface ProgressPanelProps {
  boardId: string | undefined;
  /** Rendered above the table; omitted when the caller supplies its own heading. */
  showTotals?: boolean;
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
    return (
      <EmptyState
        compact
        icon={EMPTY_ICONS.chart}
        title="Pick a board"
        body="Progress is per board, so choose one to see who is carrying what."
      />
    );
  }

  if (isPending) {
    return (
      <div className={styles.loading}>
        <StatsSkeleton />
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
      <EmptyState
        compact
        icon={EMPTY_ICONS.check}
        title="Nothing to measure yet"
        body="This board has no tasks. Add some and this fills in on its own."
      />
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

      <section className={styles.chartBlock}>
        <Donut
          slices={[
            { label: 'Done', value: progress.totals.completed, color: 'var(--primary)' },
            { label: 'Overdue', value: progress.totals.overdue, color: 'var(--red)' },
            {
              label: 'In progress',
              value: Math.max(
                0,
                progress.totals.tasks -
                  progress.totals.completed -
                  progress.totals.overdue,
              ),
              color: 'var(--text-secondary)',
            },
          ]}
          centerValue={`${progress.totals.completionRate}%`}
          centerLabel="complete"
        />
      </section>

      <section className={styles.chartBlock}>
        <h3 className={styles.chartTitle}>By person</h3>
        <BarList
          emptyLabel="Nothing assigned on this board yet."
          data={progress.members.map((row) => ({
            label: row.userId === null ? 'Unassigned' : row.name,
            value: row.completed,
            alert: row.overdue,
            // One scale for every row, so the bars can be compared.
            max: Math.max(1, ...progress.members.map((m) => m.assigned)),
            caption:
              row.subtasks.total > 0
                ? `${row.completed}/${row.assigned} · ${row.subtasks.completed}/${row.subtasks.total} subtasks`
                : `${row.completed}/${row.assigned}`,
          }))}
        />
      </section>

      <p className={styles.footnote}>
        “Done” means the last column on the board
        {progress.doneColumn ? ` (${progress.doneColumn})` : ''} - renaming it changes
        nothing, moving a task does.
      </p>
    </div>
  );
}
