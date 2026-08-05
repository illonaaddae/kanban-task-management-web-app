import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getActivity } from '../../services/activityApi';
import { Loader } from '../ui/Loader';
import type { ActivityEntry, Pagination } from '../../types';
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
 * The board's activity feed — read-only, and readable by viewers too.
 *
 * Paginated server-side; this holds one page at a time rather than accumulating,
 * so a long-lived board cannot grow the panel without bound.
 */
export function ActivityPanel({ isOpen, onClose, boardId }: ActivityPanelProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getActivity(boardId, targetPage, PAGE_SIZE);
        setEntries(result.entries);
        setPagination(result.pagination);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load activity');
      } finally {
        setLoading(false);
      }
    },
    [boardId],
  );

  // Always reopen on page 1 — resuming deep in the feed after a mutation would
  // show a page whose contents have shifted.
  useEffect(() => {
    if (!isOpen) return;
    setPage(1);
    void load(1);
  }, [isOpen, load]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const goTo = (targetPage: number) => {
    setPage(targetPage);
    void load(targetPage);
  };

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

        <div className={styles.body}>
          {loading && entries.length === 0 && (
            <div className={styles.loading}>
              <Loader />
            </div>
          )}

          {error && <p className={styles.state}>{error}</p>}

          {!loading && !error && entries.length === 0 && (
            <p className={styles.state}>
              Nothing has happened on this board yet.
            </p>
          )}

          {entries.length > 0 && (
            <ul className={styles.list}>
              {entries.map((entry) => (
                <li key={entry.id} className={styles.entry}>
                  <span className={styles.dot} aria-hidden="true" />
                  <div className={styles.entryBody}>
                    <p className={styles.message}>{entry.message}</p>
                    <time className={styles.meta} dateTime={entry.createdAt}>
                      {formatWhen(entry.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
                onClick={() => goTo(page - 1)}
                disabled={page <= 1 || loading}
              >
                Newer
              </button>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => goTo(page + 1)}
                disabled={page >= totalPages || loading}
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
