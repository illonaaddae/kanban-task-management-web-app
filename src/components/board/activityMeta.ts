/**
 * How each activity action is presented.
 *
 * The feed used to render one purple dot per entry, so fifteen rows looked
 * identical and a deletion read exactly like a rename. Shape and colour do the
 * scanning work that the text alone could not.
 */
export type ActivityTone = 'create' | 'move' | 'update' | 'destroy' | 'people';

export interface ActivityMeta {
  tone: ActivityTone;
  /**
   * SVG `d` strings rather than JSX.
   *
   * Keeps this module free of components, which is what lets it export plain
   * helpers as well: a file mixing the two breaks fast refresh, and splitting it
   * for that reason alone would scatter one small idea across two files.
   */
  paths: readonly string[];
  /** Which filter chip this action belongs to. */
  group: 'tasks' | 'columns' | 'board' | 'people';
}

const icons = {
  plus: ['M12 5v14M5 12h14'],
  arrow: ['M5 12h14M13 6l6 6-6 6'],
  pencil: ['M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  trash: ['M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5'],
  people: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    'M23 21v-2a4 4 0 0 0-3-3.87',
  ],
  columns: ['M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z'],
  board: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18'],
} as const;

const MAP: Record<string, ActivityMeta> = {
  'board.created': { tone: 'create', paths: icons.board, group: 'board' },
  'board.renamed': { tone: 'update', paths: icons.pencil, group: 'board' },
  'board.attached': { tone: 'people', paths: icons.people, group: 'board' },
  'board.detached': { tone: 'people', paths: icons.people, group: 'board' },
  'column.created': { tone: 'create', paths: icons.plus, group: 'columns' },
  'column.renamed': { tone: 'update', paths: icons.pencil, group: 'columns' },
  'column.deleted': { tone: 'destroy', paths: icons.trash, group: 'columns' },
  'columns.reordered': { tone: 'move', paths: icons.columns, group: 'columns' },
  'task.created': { tone: 'create', paths: icons.plus, group: 'tasks' },
  'task.updated': { tone: 'update', paths: icons.pencil, group: 'tasks' },
  'task.moved': { tone: 'move', paths: icons.arrow, group: 'tasks' },
  'task.deleted': { tone: 'destroy', paths: icons.trash, group: 'tasks' },
  'task.assigned': { tone: 'people', paths: icons.people, group: 'tasks' },
  'collaborator.added': { tone: 'people', paths: icons.people, group: 'people' },
  'collaborator.removed': { tone: 'destroy', paths: icons.people, group: 'people' },
  'collaborator.role_changed': { tone: 'update', paths: icons.people, group: 'people' },
};

/**
 * Falls back rather than throwing on an unknown action: the server can start
 * logging something new before the client knows about it, and an unstyled entry
 * beats a blank feed.
 */
export function metaFor(action: string): ActivityMeta {
  return (
    MAP[action] ?? {
      tone: 'update',
      paths: icons.pencil,
      group: action.startsWith('column') ? 'columns' : 'board',
    }
  );
}

export const FILTER_GROUPS = [
  { value: 'all', label: 'All' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'columns', label: 'Columns' },
  { value: 'people', label: 'People' },
  { value: 'board', label: 'Board' },
] as const;

export type ActivityFilter = (typeof FILTER_GROUPS)[number]['value'];

/** "Today", "Yesterday", then a date once neither applies. */
export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const days = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
}
