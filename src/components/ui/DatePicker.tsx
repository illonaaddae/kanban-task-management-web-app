import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './DatePicker.module.css';

interface DatePickerProps {
  label?: string;
  /** `yyyy-mm-dd`, or '' for no date. Same contract as a native date input. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * `yyyy-mm-dd` <-> Date, in **local** time.
 *
 * `new Date('2026-08-07')` parses as UTC midnight, which is the previous day for
 * anyone west of Greenwich - so a date picked on the 7th saves as the 6th. Build
 * the parts explicitly to keep everything in the user's own day.
 */
function parse(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Monday-first offset for the 1st of the month. */
function leadingBlanks(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

function readableDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Due-date picker.
 *
 * Replaces `<input type="date">`, whose control is drawn by the browser: it
 * ignored the app's palette entirely, looked different in every browser, and on
 * some Android builds opened a full-screen dialog over the form. This renders the
 * calendar itself, so it matches the rest of the UI and behaves the same
 * everywhere.
 */
export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'No due date',
  error,
}: DatePickerProps) {
  const selected = useMemo(() => parse(value), [value]);
  const today = useMemo(() => new Date(), []);

  const [open, setOpen] = useState(false);
  // Which month the grid is showing - starts at the selection, or this month.
  const [cursor, setCursor] = useState(() => selected ?? today);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // The calendar is inside a modal that also closes on Escape; stop here so
      // one press closes the calendar rather than the whole form.
      event.stopPropagation();
      setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = leadingBlanks(year, month);

  const pick = (day: number) => {
    onChange(format(new Date(year, month, day)));
    setOpen(false);
  };

  const shiftMonth = (by: number) => setCursor(new Date(year, month + by, 1));

  /**
   * Opening resets the grid to the selected month.
   *
   * Done here rather than in an effect on `selected`: an effect would set state
   * during render-commit for a value the user cannot see yet, and React's lint
   * rules rightly flag that as a cascading render. The month only matters at the
   * moment the calendar becomes visible.
   */
  const toggle = () => {
    if (!open) setCursor(selected ?? today);
    setOpen(!open);
  };

  return (
    <div className={styles.field} ref={rootRef}>
      {label && <span className={styles.label}>{label}</span>}

      <div className={styles.triggerRow}>
        <button
          type="button"
          className={`${styles.trigger} ${error ? styles.triggerError : ''}`}
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          /* An explicit label, because the visible text is a locale-formatted
             date - "Aug 7, 2026" in one locale, "07/08/2026" in another. */
          aria-label={selected ? `Due date ${value}` : 'Set a due date'}
        >
          <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 11h18" />
          </svg>
          <span className={selected ? styles.valueText : styles.placeholder}>
            {selected ? readableDate(selected) : placeholder}
          </span>
        </button>

        {/* A due date has to be removable, not only changeable. A sibling rather
            than a child: a button inside a button is invalid markup, and it made
            the trigger's own accessible name absorb this one's. */}
        {selected && (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear due date"
            onClick={() => onChange('')}
          >
            ×
          </button>
        )}
      </div>

      {error && <span className={styles.error}>{error}</span>}

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Choose a date">
          <div className={styles.head}>
            <button type="button" className={styles.nav} onClick={() => shiftMonth(-1)}
              aria-label="Previous month">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <span className={styles.monthLabel} aria-live="polite">
              {MONTHS[month]} {year}
            </span>
            <button type="button" className={styles.nav} onClick={() => shiftMonth(1)}
              aria-label="Next month">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className={styles.grid}>
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const isSelected = !!selected && sameDay(date, selected);
              const isToday = sameDay(date, today);

              return (
                <button
                  key={day}
                  type="button"
                  className={`${styles.day} ${isSelected ? styles.daySelected : ''} ${
                    isToday && !isSelected ? styles.dayToday : ''
                  }`}
                  onClick={() => pick(day)}
                  aria-current={isToday ? 'date' : undefined}
                  aria-pressed={isSelected}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.footerButton}
              onClick={() => { onChange(format(today)); setOpen(false); }}>
              Today
            </button>
            <button type="button" className={styles.footerButton}
              onClick={() => { onChange(''); setOpen(false); }}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
