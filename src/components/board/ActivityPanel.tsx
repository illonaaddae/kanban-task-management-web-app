import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBoardActivity } from '../../queries/boards';
import { ActivitySkeleton } from '../ui/Skeletons';
import { EmptyState, EMPTY_ICONS } from '../ui/EmptyState';
import {
  dayLabel,
  FILTER_GROUPS,
  metaFor,
  type ActivityFilter,
} from './activityMeta';
import type { ActivityEntry } from '../../types';
import styles from './ActivityPanel.module.css';

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

const PAGE_SIZE = 15;

/** "3 minutes ago" for recent entries, an absolute date once it stops helping. */
function formatWhen(iso: string): string {
  const then = new Date(iso);
  const seconds = Math.round((Date.now() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (seconds < 86_400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (seconds < 604_800) {
    const days = Math.floor(seconds / 86_400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return then.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The board's activity feed - read-only, and readable by viewers too.
 *
 * Paginated server-side; this holds one page at a time rather than accumulating,
 * so a long-lived board cannot grow the panel without bound.
 */
/** The actor's initials, for the avatar bubble. */
function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ActivityPanel({ isOpen, onClose, boardId }: ActivityPanelProps) {
  /**
   * Page and filter reset because the caller mounts this only while it is open, so
   * every open is a fresh mount.
   *
   * That is deliberate rather than incidental: resetting them in an effect on
   * `isOpen` sets state during a commit for a panel nobody can see yet, and
   * resuming deep in the feed after a mutation shows a page whose contents have
   * shifted underneath.
   */
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const { data, isPending, isFetching, error } = useBoardActivity(
    isOpen ? boardId : undefined,
    page,
    PAGE_SIZE,
  );

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const pagination = data?.pagination;

  /**
   * Filtered, then grouped by day.
   *
   * Filtering happens client-side over the current page rather than as a query
   * parameter: the server paginates, so a filtered request would need its own
   * count and the page numbers would shift as the filter changed. Keeping it local
   * means the footer's "page 1 of 2" stays honest.
   */
  const groups = useMemo(() => {
    const visible =
      filter === 'all'
        ? entries
        : entries.filter((entry) => metaFor(entry.action).group === filter);

    const byDay: Array<{ label: string; entries: ActivityEntry[] }> = [];
    for (const entry of visible) {
      const label = dayLabel(entry.createdAt);
      const last = byDay[byDay.length - 1];
      if (last?.label === label) last.entries.push(entry);
      else byDay.push({ label, entries: [entry] });
    }
    return byDay;
  }, [entries, filter]);

  const visibleCount = groups.reduce((sum, group) => sum + group.entries.length, 0);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalPages = pagination?.totalPages ?? 1;

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Board activity"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Activity</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close activity"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1L13 13M13 1L1 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {entries.length > 0 && (
          <div className={styles.filters} role="tablist" aria-label="Filter activity">
            {FILTER_GROUPS.map((group) => (
              <button
                key={group.value}
                type="button"
                role="tab"
                aria-selected={filter === group.value}
                className={`${styles.filter} ${filter === group.value ? styles.filterActive : ''}`}
                onClick={() => setFilter(group.value)}
              >
                {group.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.body}>
          {isPending && (
            <div className={styles.loading}>
              <ActivitySkeleton />
            </div>
          )}

          {error && (
            <p className={styles.state}>
              {error instanceof Error ? error.message : 'Could not load activity'}
            </p>
          )}

          {!isPending && !error && entries.length === 0 && (
            <EmptyState
              compact
              icon={EMPTY_ICONS.activity}
              title="No activity yet"
              body="Adding a column, creating a task or moving a card all show up here, with who did it and when."
            />
          )}

          {/* The page has entries but none match the filter, which is different
              from an empty board and deserves its own wording. */}
          {entries.length > 0 && visibleCount === 0 && (
            <EmptyState
              compact
              icon={EMPTY_ICONS.search}
              title={`No ${filter} activity on this page`}
              body="There is activity here, just none of this kind. Try another filter or an older page."
            />
          )}

          {groups.map((group) => (
            <section key={group.label} className={styles.group}>
              <h3 className={styles.dayHeading}>{group.label}</h3>
              <ul className={styles.list}>
                {group.entries.map((entry) => {
                  const meta = metaFor(entry.action);

                  return (
                    <li key={entry.id} className={styles.entry}>
                      <span
                        className={`${styles.icon} ${styles[meta.tone]}`}
                        aria-hidden="true"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round">
                          {meta.paths.map((d) => (
                            <path key={d} d={d} />
                          ))}
                        </svg>
                      </span>

                      <div className={styles.entryBody}>
                        <p className={styles.message}>{entry.message}</p>
                        <div className={styles.meta}>
                          {entry.user && (
                            <span className={styles.actor}>
                              {entry.user.avatar ? (
                                <img className={styles.actorAvatar} src={entry.user.avatar} alt="" />
                              ) : (
                                <span className={styles.actorInitials} aria-hidden="true">
                                  {initialsOf(entry.user.name)}
                                </span>
                              )}
                              {entry.user.name}
                            </span>
                          )}
                          <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()}>
                            {formatWhen(entry.createdAt)}
                          </time>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {pagination && pagination.total > 0 && (
          <div className={styles.footer}>
            <span className={styles.pageInfo}>
              Page {page} of {totalPages} · {pagination.total} event
              {pagination.total === 1 ? '' : 's'}
            </span>
            <div className={styles.pageButtons}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
              >
                Newer
              </button>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages || isFetching}
              >
                Older
              </button>
            </div>
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}
