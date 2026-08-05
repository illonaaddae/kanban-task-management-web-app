/**
 * Date conversions shared by the task modals.
 *
 * Kept out of the component file so it exports components only — mixing the two
 * breaks Fast Refresh for the component.
 */

/** ISO timestamp → `yyyy-mm-dd` for a native date input. */
export function toDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/** `yyyy-mm-dd` → what the API expects, with empty meaning "clear it". */
export function fromDateInputValue(value: string): string | null {
  return value ? value : null;
}
