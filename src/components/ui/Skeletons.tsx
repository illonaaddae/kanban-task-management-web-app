import { Skeleton, SkeletonGroup } from './Skeleton';
import styles from './Skeletons.module.css';

/**
 * Loading placeholders shaped like the thing being loaded.
 *
 * One per view rather than a shared generic block: the point is that the space is
 * reserved correctly, and a board's columns, a list of task rows and a table of
 * numbers do not occupy the same shape.
 *
 * The auth gates keep their spinner. A skeleton promises a particular layout, and
 * "are you signed in" resolves to one of two completely different pages.
 */

/** Dashboard: a grid of board cards. */
export function BoardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonGroup label="Loading your boards">
      <div className={styles.cardGrid}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={styles.card}>
            <Skeleton width="2.75rem" height="2.75rem" />
            <Skeleton width="55%" height="1.25rem" />
            <div className={styles.cardFooter}>
              <Skeleton width="5rem" height="0.75rem" />
              <Skeleton width="4rem" height="0.75rem" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

/** Board view: columns of cards. */
export function BoardSkeleton({ columns = 3 }: { columns?: number }) {
  // Uneven card counts, so it looks like a board rather than a grid.
  const cardsPer = [3, 2, 4];

  return (
    <SkeletonGroup label="Loading board">
      <div className={styles.board}>
        {Array.from({ length: columns }, (_, columnIndex) => (
          <div key={columnIndex} className={styles.column}>
            <div className={styles.columnHead}>
              <Skeleton width="0.9375rem" height="0.9375rem" circle />
              <Skeleton width="7rem" height="0.75rem" />
            </div>
            {Array.from({ length: cardsPer[columnIndex % cardsPer.length] }, (_, i) => (
              <div key={i} className={styles.taskCard}>
                <Skeleton width="80%" height="1rem" />
                <Skeleton width="45%" height="0.75rem" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

/** My tasks: grouped rows. */
export function TaskListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonGroup label="Loading your tasks">
      <Skeleton width="8rem" height="0.75rem" className={styles.groupHeading} />
      <div className={styles.rows}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={styles.row}>
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="35%" height="0.75rem" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

/** A member or collaborator list: avatar, name, email. */
export function MemberListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SkeletonGroup label="Loading people">
      <div className={styles.members}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={styles.member}>
            <Skeleton width="2.25rem" height="2.25rem" circle />
            <div className={styles.memberText}>
              <Skeleton width="45%" height="0.875rem" />
              <Skeleton width="65%" height="0.75rem" />
            </div>
            <Skeleton width="4.5rem" height="1.5rem" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

/** Progress and analytics: stat tiles, a ring, then bars. */
export function StatsSkeleton({ bars = 3 }: { bars?: number }) {
  return (
    <SkeletonGroup label="Loading progress">
      <div className={styles.stats}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} width="6.5rem" height="4.25rem" />
        ))}
      </div>
      <div className={styles.donutRow}>
        <Skeleton width="9rem" height="9rem" circle />
        <div className={styles.legend}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} width="7rem" height="0.75rem" />
          ))}
        </div>
      </div>
      <div className={styles.rows}>
        {Array.from({ length: bars }, (_, i) => (
          <div key={i} className={styles.barRow}>
            <Skeleton width="7rem" height="0.8125rem" />
            <Skeleton height="0.625rem" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

/** Activity feed: an icon bubble, a line of text, a timestamp. */
export function ActivitySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <SkeletonGroup label="Loading activity">
      <Skeleton width="4rem" height="0.625rem" className={styles.groupHeading} />
      <div className={styles.activity}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={styles.activityRow}>
            <Skeleton width="1.5rem" height="1.5rem" circle />
            <div className={styles.memberText}>
              {/* Varied widths, because uniform bars read as a table. */}
              <Skeleton width={`${65 + ((i * 7) % 25)}%`} height="0.8125rem" />
              <Skeleton width="5rem" height="0.625rem" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
