import styles from './Charts.module.css';

/**
 * Charts drawn as plain SVG, with no charting library.
 *
 * Three reasons: the bundle is already 540kB and a chart library is a large
 * addition for four small figures; these need to follow the app's CSS variables so
 * they theme with everything else; and an SVG we control degrades to readable
 * markup rather than a blank canvas when something goes wrong.
 *
 * Each chart carries the same numbers in text as well, so it is not the only way
 * to read the data.
 */

export interface DonutSlice {
  label: string;
  value: number;
  /** A CSS colour, usually a variable. */
  color: string;
}

interface DonutProps {
  slices: DonutSlice[];
  /** Large text in the middle. */
  centerValue: string;
  centerLabel: string;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Completion split, as a ring. */
export function Donut({ slices, centerValue, centerLabel }: DonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  // Nothing to divide by. Draw the empty track rather than a broken ring.
  const drawable = total > 0 ? slices.filter((slice) => slice.value > 0) : [];

  /**
   * Each slice's dash length and where it starts, computed before rendering.
   *
   * A running counter mutated inside `.map` works, but it is state that survives
   * the render it belongs to, and React's lint rules flag it for good reason: the
   * second render would start from wherever the first left off.
   */
  const arcs = drawable.reduce<Array<{ slice: DonutSlice; dash: number; offset: number }>>(
    (acc, slice) => {
      const dash = (slice.value / total) * CIRCUMFERENCE;
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
      return [...acc, { slice, dash, offset }];
    },
    [],
  );

  return (
    <div className={styles.donutWrap}>
      <svg className={styles.donut} viewBox="0 0 100 100" role="img"
        aria-label={
          total > 0
            ? slices.map((s) => `${s.label}: ${s.value}`).join(', ')
            : 'No data yet'
        }>
        <circle className={styles.donutTrack} cx="50" cy="50" r={RADIUS} />
        {arcs.map(({ slice, dash, offset }) => (
          <circle
            key={slice.label}
            cx="50"
            cy="50"
            r={RADIUS}
            className={styles.donutSlice}
            stroke={slice.color}
            strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
            // Negative offset walks clockwise from 12 o'clock.
            strokeDashoffset={-offset}
          />
        ))}
        <text className={styles.donutValue} x="50" y="47" textAnchor="middle">
          {centerValue}
        </text>
        <text className={styles.donutLabel} x="50" y="62" textAnchor="middle">
          {centerLabel}
        </text>
      </svg>

      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li key={slice.label}>
            <span className={styles.swatch} style={{ background: slice.color }} />
            <span className={styles.legendLabel}>{slice.label}</span>
            <span className={styles.legendValue}>{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarDatum {
  label: string;
  /** Drawn as the filled portion. */
  value: number;
  /** Drawn on top of the bar in a warning colour, e.g. overdue within a total. */
  alert?: number;
  /** Scale maximum. Bars share one scale so their lengths are comparable. */
  max: number;
  /** Shown at the end of the row. */
  caption: string;
}

/**
 * Horizontal bars, which suit long labels far better than vertical columns and do
 * not need rotated text to stay readable on a phone.
 */
export function BarList({ data, emptyLabel = 'Nothing to show yet' }: {
  data: BarDatum[];
  emptyLabel?: string;
}) {
  if (data.length === 0) return <p className={styles.empty}>{emptyLabel}</p>;

  return (
    <ul className={styles.bars}>
      {data.map((datum) => {
        // A zero max would divide by zero; a bar of 0% is the honest answer.
        const pct = datum.max > 0 ? (datum.value / datum.max) * 100 : 0;
        const alertPct =
          datum.alert && datum.max > 0 ? (datum.alert / datum.max) * 100 : 0;

        return (
          <li key={datum.label} className={styles.barRow}>
            <span className={styles.barLabel} title={datum.label}>
              {datum.label}
            </span>
            <span className={styles.barTrack}>
              <span className={styles.barFill} style={{ width: `${pct}%` }} />
              {alertPct > 0 && (
                <span className={styles.barAlert} style={{ width: `${alertPct}%` }} />
              )}
            </span>
            <span className={styles.barCaption}>{datum.caption}</span>
          </li>
        );
      })}
    </ul>
  );
}
