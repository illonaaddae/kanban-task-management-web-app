import { useTeamAnalytics } from '../../queries/orgs';
import { Loader } from '../ui/Loader';
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
 * only — enforced server-side, mirrored here so a member is never shown an error
 * for something they were not meant to see.
 */
export function AnalyticsPanel({ orgId, canManage }: AnalyticsPanelProps) {
  const { data: analytics, isPending, error } = useTeamAnalytics(orgId, canManage);

  if (!canManage) {
    return (
      <p className={styles.empty}>
        Team analytics are available to team admins and the owner.
      </p>
    );
  }

  if (isPending) {
    return (
      <div className={styles.loading}>
        <Loader />
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
      <p className={styles.empty}>
        This team has no boards yet. Create a board and pick this team when you make
        it — every member gets access without a separate invite.
      </p>
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

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Board</th>
              <th scope="col">Tasks</th>
              <th scope="col">Done</th>
              <th scope="col">Overdue</th>
              <th scope="col" className={styles.barHead}>Completion</th>
            </tr>
          </thead>
          <tbody>
            {analytics.perBoard.map((board) => (
              <tr key={board.boardId}>
                <td>
                  <span className={styles.name}>{board.name}</span>
                </td>
                <td className={styles.num}>{board.tasks}</td>
                <td className={styles.num}>{board.completed}</td>
                <td className={`${styles.num} ${board.overdue > 0 ? styles.overdue : ''}`}>
                  {board.overdue}
                </td>
                <td>
                  <div className={styles.barRow}>
                    <div
                      className={styles.bar}
                      role="progressbar"
                      aria-valuenow={board.completionRate}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${board.name} completion`}
                    >
                      <div
                        className={styles.barFill}
                        style={{ width: `${board.completionRate}%` }}
                      />
                    </div>
                    <span className={styles.barValue}>{board.completionRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.footnote}>
        Across every board belonging to this team. Someone shown as “Outside the team”
        has tasks here but is no longer a member.
      </p>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Assigned</th>
              <th scope="col">Done</th>
              <th scope="col">Overdue</th>
              <th scope="col" className={styles.barHead}>Completion</th>
            </tr>
          </thead>
          <tbody>
            {analytics.members.map((row) => (
              <tr key={row.userId ?? 'unassigned'}>
                <td>
                  <div className={styles.identity}>
                    <div className={styles.name}>{row.name}</div>
                    {row.email && <div className={styles.email}>{row.email}</div>}
                  </div>
                </td>
                <td className={styles.num}>{row.assigned}</td>
                <td className={styles.num}>{row.completed}</td>
                <td className={`${styles.num} ${row.overdue > 0 ? styles.overdue : ''}`}>
                  {row.overdue}
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
    </div>
  );
}
