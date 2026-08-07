import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** Any CSS length. */
  width?: string;
  height?: string;
  /** Pill instead of a rounded rectangle, for avatars and chips. */
  circle?: boolean;
  className?: string;
}

/**
 * A placeholder shaped like the content that is coming.
 *
 * Replaces a centred spinner. A spinner says "something is happening"; a skeleton
 * says what is about to appear and reserves its space, so the page does not jump
 * when data lands. Marked `aria-hidden` because the container announces loading
 * once, and a screen reader does not benefit from twenty grey boxes.
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  circle = false,
  className = '',
}: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${circle ? styles.circle : ''} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** Wraps a group of skeletons and announces the wait exactly once. */
export function SkeletonGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      {children}
    </div>
  );
}
