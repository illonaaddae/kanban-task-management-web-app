import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts, type Shortcut } from '../useKeyboardShortcuts';

function Harness({
  shortcuts,
  enabled = true,
  extra,
}: {
  shortcuts: Shortcut[];
  enabled?: boolean;
  extra?: ReactNode;
}) {
  useKeyboardShortcuts(shortcuts, enabled);
  return <div>{extra}</div>;
}

describe('useKeyboardShortcuts', () => {
  const shortcut = (key: string, run: () => void): Shortcut => ({
    key,
    description: key,
    run,
  });

  it('runs the matching shortcut', () => {
    const run = vi.fn();
    render(<Harness shortcuts={[shortcut('n', run)]} />);

    fireEvent.keyDown(document, { key: 'n' });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('matches regardless of case, so Shift+N still works', () => {
    const run = vi.fn();
    render(<Harness shortcuts={[shortcut('n', run)]} />);

    fireEvent.keyDown(document, { key: 'N' });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ignores keystrokes while typing in a field', () => {
    const run = vi.fn();
    const { getByRole } = render(
      <Harness shortcuts={[shortcut('n', run)]} extra={<input />} />,
    );

    const input = getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'n' });

    // Otherwise naming a board "New sprint" fires the new-task shortcut on "n".
    expect(run).not.toHaveBeenCalled();
  });

  it('ignores typing in a textarea and in contenteditable', () => {
    const run = vi.fn();
    const { container } = render(
      <Harness
        shortcuts={[shortcut('n', run)]}
        extra={
          <>
            <textarea aria-label="notes" />
            <div contentEditable suppressContentEditableWarning aria-label="rich" />
          </>
        }
      />,
    );

    fireEvent.keyDown(container.querySelector('textarea')!, { key: 'n' });
    fireEvent.keyDown(container.querySelector('[contenteditable]')!, { key: 'n' });

    expect(run).not.toHaveBeenCalled();
  });

  it('leaves browser and OS combinations alone', () => {
    const run = vi.fn();
    render(<Harness shortcuts={[shortcut('t', run)]} />);

    // Cmd+T opens a browser tab; hijacking it would be hostile.
    fireEvent.keyDown(document, { key: 't', metaKey: true });
    fireEvent.keyDown(document, { key: 't', ctrlKey: true });
    fireEvent.keyDown(document, { key: 't', altKey: true });

    expect(run).not.toHaveBeenCalled();
  });

  it('does nothing when disabled, so a dialog cannot stack another on top', () => {
    const run = vi.fn();
    render(<Harness shortcuts={[shortcut('n', run)]} enabled={false} />);

    fireEvent.keyDown(document, { key: 'n' });

    expect(run).not.toHaveBeenCalled();
  });

  it('ignores a key nothing is bound to', () => {
    const run = vi.fn();
    render(<Harness shortcuts={[shortcut('n', run)]} />);

    fireEvent.keyDown(document, { key: 'z' });

    expect(run).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const run = vi.fn();
    const { unmount } = render(<Harness shortcuts={[shortcut('n', run)]} />);

    unmount();
    fireEvent.keyDown(document, { key: 'n' });

    expect(run).not.toHaveBeenCalled();
  });
});
