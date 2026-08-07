import styles from './Landing.module.css';

/**
 * Illustrations for the landing page, drawn rather than photographed.
 *
 * Three reasons this is SVG and not stock imagery. The page's argument is that the
 * product is real, and product shapes are evidence of that where a photograph of
 * strangers is evidence of nothing. These inherit `--primary` and the surrounding
 * background, so they work in both themes without shipping two of everything. And
 * they cost a couple of kB against the few hundred a hero photograph would add,
 * having just spent effort getting the bundle down.
 *
 * `aria-hidden` throughout: each one sits beside prose that already says the same
 * thing, so announcing it twice helps nobody.
 */

/** A board with people on it: avatars on cards, one mid-drag. */
export function TeamBoardArt() {
  const columns = [
    { name: 'Todo', tone: '#49c4e5', cards: [1, 2, 3] },
    { name: 'Doing', tone: '#8471f2', cards: [1, 2] },
    { name: 'Done', tone: '#67e2ae', cards: [1, 2, 3, 4] },
  ];

  return (
    <svg
      className={styles.art}
      viewBox="0 0 340 200"
      role="img"
      aria-hidden="true"
      fill="none"
    >
      {columns.map((column, columnIndex) => {
        const x = 8 + columnIndex * 112;
        return (
          <g key={column.name}>
            <circle cx={x + 5} cy={12} r={4} fill={column.tone} />
            <rect x={x + 15} y={8} width={44} height={7} rx={3.5} className={styles.artMuted} />

            {column.cards.map((_, cardIndex) => {
              const y = 26 + cardIndex * 40;
              return (
                <g key={cardIndex}>
                  <rect
                    x={x}
                    y={y}
                    width={96}
                    height={32}
                    rx={5}
                    className={styles.artCard}
                  />
                  <rect
                    x={x + 8}
                    y={y + 8}
                    width={52 + ((cardIndex * 9) % 24)}
                    height={5}
                    rx={2.5}
                    className={styles.artMuted}
                  />
                  {/* An avatar on each card: work belongs to somebody. */}
                  <circle
                    cx={x + 13}
                    cy={y + 23}
                    r={5}
                    className={
                      cardIndex % 3 === 0 ? styles.artAccent : styles.artMuted
                    }
                  />
                  <circle
                    cx={x + 22}
                    cy={y + 23}
                    r={5}
                    className={styles.artFaint}
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* A card lifted between columns, which is the one interaction the whole
          product is built around. */}
      <g className={styles.artDragging}>
        <rect x={92} y={110} width={96} height={32} rx={5} className={styles.artLift} />
        <rect x={100} y={118} width={58} height={5} rx={2.5} className={styles.artOnAccent} />
        <circle cx={105} cy={133} r={5} className={styles.artOnAccentSolid} />
      </g>
    </svg>
  );
}

/** How access resolves: owner, then an explicit grant, then the team. */
export function PermissionsArt() {
  const rows = [
    { label: 'Owner', width: 96, tone: styles.artAccent },
    { label: 'Invited', width: 74, tone: styles.artMid },
    { label: 'Team', width: 52, tone: styles.artFaint },
  ];

  return (
    <svg
      className={styles.art}
      viewBox="0 0 220 132"
      role="img"
      aria-hidden="true"
      fill="none"
    >
      {rows.map((row, index) => {
        const y = 12 + index * 40;
        return (
          <g key={row.label}>
            <circle cx={14} cy={y + 10} r={9} className={row.tone} />
            <rect x={32} y={y + 2} width={44} height={7} rx={3.5} className={styles.artMuted} />
            {/* Bar length carries the level: the narrower the bar, the less it grants. */}
            <rect
              x={32}
              y={y + 13}
              width={row.width}
              height={6}
              rx={3}
              className={row.tone}
            />
            {index < rows.length - 1 && (
              <path
                d={`M14 ${y + 21} L14 ${y + 33}`}
                className={styles.artStroke}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )}
          </g>
        );
      })}
      <rect x={148} y={104} width={64} height={18} rx={9} className={styles.artCard} />
      <rect x={158} y={111} width={44} height={5} rx={2.5} className={styles.artMuted} />
    </svg>
  );
}

/** An invitation travelling from an address to a person on a team. */
export function InviteArt() {
  return (
    <svg
      className={styles.art}
      viewBox="0 0 240 120"
      role="img"
      aria-hidden="true"
      fill="none"
    >
      {/* An address, not an account: that is the point of the feature. */}
      <rect x={6} y={44} width={78} height={30} rx={6} className={styles.artCard} />
      <path
        d="M14 52 L45 66 L76 52"
        className={styles.artStroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <rect x={14} y={50} width={62} height={20} rx={3} className={styles.artStroke} strokeWidth={1.2} />

      {/* In flight. */}
      <path
        d="M92 59 C112 59, 122 44, 146 44"
        className={styles.artAccentStroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="5 4"
      />
      <path
        d="M140 39 L147 44 L140 49"
        className={styles.artAccentStroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Landing in a team of people. */}
      <circle cx={172} cy={36} r={11} className={styles.artAccent} />
      <circle cx={200} cy={52} r={9} className={styles.artMid} />
      <circle cx={176} cy={70} r={9} className={styles.artFaint} />
      <path
        d="M172 47 L200 43 M181 66 L193 59"
        className={styles.artStroke}
        strokeWidth={1.4}
      />
    </svg>
  );
}
