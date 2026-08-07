import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** SVG path data, drawn in a muted bubble. */
  icon?: readonly string[];
  title: string;
  /** One or two sentences: what this is, and what to do about it. */
  body?: ReactNode;
  /** The action that fills the emptiness, when there is one. */
  action?: ReactNode;
  /** Tighter spacing, for an empty panel rather than an empty page. */
  compact?: boolean;
}

export const EMPTY_ICONS = {
  board: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18'],
  columns: ['M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z'],
  check: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  people: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    'M23 21v-2a4 4 0 0 0-3-3.87',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  chart: ['M3 3v18h18', 'M7 16v-5M12 16V8M17 16v-3'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
} as const;

/**
 * What a view says when it has nothing to show.
 *
 * The app used to answer with a bare sentence, which leaves the reader to work out
 * whether something is broken, still loading, or simply not there yet. An empty
 * state should name the thing, say why it is empty, and offer the action that
 * fills it.
 */
export function EmptyState({
  icon = EMPTY_ICONS.board,
  title,
  body,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ''}`}>
      <span className={styles.iconBubble} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </span>

      <h3 className={styles.title}>{title}</h3>
      {body && <p className={styles.body}>{body}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
