import { useTeamAnalytics } from '../../queries/orgs';
import { StatsSkeleton } from '../ui/Skeletons';
import { EmptyState, EMPTY_ICONS } from '../ui/EmptyState';
import { BarList, Donut } from './Charts';
import styles from './ProgressPanel.module.css';

interface AnalyticsPanelProps {
  orgId: string | undefined;
  /** The API restricts this to team admins; don't even ask when they aren't one. */
  canManage: boolean;
}

/**
 * Team-wide numbers across every board the team owns.
 *
 * Distinct from ProgressPanel, which covers one board and is readable by anyone
 * on it. This spans boards an individual member might not open, so it is admins
 * only - enforced server-side, mirrored here so a member is never shown an error
 * for something they were not meant to see.
 */
export function AnalyticsPanel({ orgId, canManage }: AnalyticsPanelProps) {
  const { data: analytics, isPending, error } = useTeamAnalytics(orgId, canManage);

  if (!canManage) {
    return (
      <EmptyState
        compact
        icon={EMPTY_ICONS.chart}
        title="Admins only"
        body="Team analytics span every board the team owns, including ones you may not be on, so they are limited to admins and the owner."
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

  if (error || !analytics) {
    return (
      <p className={styles.empty}>
        {error instanceof Error ? error.message : 'Could not load team analytics.'}
      </p>
    );
  }

  if (analytics.boards === 0) {
    return (
      <EmptyState
        compact
        icon={EMPTY_ICONS.board}
        title="No boards in this team"
        body={
          <>
            Boards you already have are <strong>personal</strong> until you move them
            in, which is why they are not counted here. Use{' '}
            <strong>Boards in this team</strong> above to create one here or move an
            existing one across.
          </>
        }
      />
    );
  }

  return (
    <div>
      <div className={styles.totals}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.boards}</span>
          <span className={styles.statLabel}>boards</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.totals.tasks}</span>
          <span className={styles.statLabel}>tasks</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.totals.completionRate}%</span>
          <span className={styles.statLabel}>complete</span>
        </div>
        <div
          className={`${styles.stat} ${analytics.totals.overdue > 0 ? styles.statAlert : ''}`}
        >
          <span className={styles.statValue}>{analytics.totals.overdue}</span>
          <span className={styles.statLabel}>overdue</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.totals.unassigned}</span>
          <span className={styles.statLabel}>unassigned</span>
        </div>
      </div>

      {/* One grid, so the three read as one picture across the width rather
          than a column of full-width bars. */}
      <div className={styles.charts}>
        <section className={styles.chartBlock}>
          <h3 className={styles.chartTitle}>Where the work stands</h3>
          <Donut
            slices={[
              { label: 'Done', value: analytics.totals.completed, color: 'var(--primary)' },
              {
                label: 'Overdue',
                value: analytics.totals.overdue,
                color: 'var(--red)',
              },
              {
                label: 'In progress',
                value: Math.max(
                  0,
                  analytics.totals.tasks -
                    analytics.totals.completed -
                    analytics.totals.overdue,
                ),
                color: 'var(--text-secondary)',
              },
            ]}
            centerValue={`${analytics.totals.completionRate}%`}
            centerLabel="complete"
          />
        </section>

        <section className={styles.chartBlock}>
          <h3 className={styles.chartTitle}>By board</h3>
          <BarList
            emptyLabel="No boards in this team yet."
            data={analytics.perBoard.map((board) => ({
              label: board.name,
              value: board.completed,
              alert: board.overdue,
              // One scale across every board, so bar lengths are comparable rather
              // than each row being its own 100%.
              max: Math.max(1, ...analytics.perBoard.map((b) => b.tasks)),
              caption: `${board.completed}/${board.tasks} · ${board.completionRate}%`,
            }))}
          />
        </section>

        <section className={styles.chartBlock}>
          <h3 className={styles.chartTitle}>By person</h3>
          <BarList
            emptyLabel="Nothing assigned yet."
            data={analytics.members.map((row) => ({
              label: row.name,
              value: row.completed,
              alert: row.overdue,
              max: Math.max(1, ...analytics.members.map((m) => m.assigned)),
              caption: `${row.completed}/${row.assigned} · ${row.completionRate}%`,
            }))}
          />
        </section>
      </div>

      <p className={styles.footnote}>
        Across every board belonging to this team. Red is overdue. Anyone shown as
        "Outside the team" has tasks here but is no longer a member.
      </p>
    </div>
  );
}
