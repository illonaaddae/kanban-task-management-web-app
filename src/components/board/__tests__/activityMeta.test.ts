import { describe, it, expect, vi, afterEach } from 'vitest';
import { dayLabel, metaFor, FILTER_GROUPS } from '../activityMeta';

describe('metaFor', () => {
  it('gives a delete a different tone and shape from a rename', () => {
    // The whole point of the redesign: fifteen identical dots told you nothing.
    expect(metaFor('task.deleted').tone).toBe('destroy');
    expect(metaFor('task.updated').tone).toBe('update');
    expect(metaFor('task.deleted').paths).not.toEqual(metaFor('task.updated').paths);
  });

  it('files each action under a filter group', () => {
    expect(metaFor('task.moved').group).toBe('tasks');
    expect(metaFor('column.created').group).toBe('columns');
    expect(metaFor('collaborator.added').group).toBe('people');
    expect(metaFor('board.renamed').group).toBe('board');
  });

  it('falls back instead of throwing on an action it has never seen', () => {
    // The server can start logging something new before the client knows about
    // it; an unstyled row beats a crashed feed.
    const meta = metaFor('task.frobnicated');
    expect(meta.paths.length).toBeGreaterThan(0);
    expect(meta.tone).toBe('update');
  });

  it('routes an unknown column action to the columns group', () => {
    expect(metaFor('column.frozen').group).toBe('columns');
  });

  it('covers every action the server writes', () => {
    // Kept in step with the log calls in the services. A miss here means a real
    // entry renders with the fallback icon.
    const logged = [
      'board.created',
      'board.renamed',
      'board.attached',
      'board.detached',
      'column.created',
      'column.renamed',
      'column.deleted',
      'columns.reordered',
      'task.created',
      'task.updated',
      'task.moved',
      'task.deleted',
      'task.assigned',
      'collaborator.added',
      'collaborator.removed',
      'collaborator.role_changed',
    ];

    for (const action of logged) {
      const meta = metaFor(action);
      expect(meta.paths.length, `${action} has no icon`).toBeGreaterThan(0);
      expect(
        FILTER_GROUPS.some((group) => group.value === meta.group),
        `${action} is in group "${meta.group}", which no filter offers`,
      ).toBe(true);
    }
  });
});

describe('dayLabel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (year: number, month: number, day: number, hour = 12) =>
    new Date(year, month, day, hour).toISOString();

  it('says Today and Yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 15, 0));

    expect(dayLabel(at(2026, 7, 7, 1))).toBe('Today');
    expect(dayLabel(at(2026, 7, 6, 23))).toBe('Yesterday');
  });

  it('compares calendar days, not elapsed hours', () => {
    vi.useFakeTimers();
    // 00:30. Something at 23:30 last night is two hours ago but still yesterday.
    vi.setSystemTime(new Date(2026, 7, 7, 0, 30));

    expect(dayLabel(at(2026, 7, 6, 23))).toBe('Yesterday');
  });

  it('counts days within the last week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 12, 0));

    expect(dayLabel(at(2026, 7, 4))).toBe('3 days ago');
  });

  it('falls back to a date beyond a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12, 0));

    const label = dayLabel(at(2026, 7, 1));
    expect(label).not.toMatch(/ago|Today|Yesterday/);
    expect(label).toMatch(/1/);
  });
});
