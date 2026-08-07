import { useEffect } from 'react';

export interface Shortcut {
  /** The key as reported by KeyboardEvent.key, matched case-insensitively. */
  key: string;
  description: string;
  run: () => void;
}

/**
 * True when the keystroke belongs to whatever the user is typing in.
 *
 * Without this, typing a board name called "New sprint" would fire the new-task
 * shortcut on the "n". Single-key shortcuts are only safe outside text entry.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

  // `isContentEditable` is the right property but jsdom does not implement it, so
  // the attribute is checked too. Explicit "false" still means not editable.
  if (target.isContentEditable) return true;

  const attribute = target.getAttribute('contenteditable');
  return attribute === '' || attribute === 'true' || attribute === 'plaintext-only';
}

/**
 * Single-key shortcuts, active only when nothing is being typed into and no
 * dialog is open.
 *
 * `enabled` is how the caller suppresses them while a modal is up: a shortcut that
 * opens a second dialog on top of the first is worse than no shortcut.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Leave browser and OS combinations alone.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const match = shortcuts.find(
        (shortcut) => shortcut.key.toLowerCase() === event.key.toLowerCase(),
      );
      if (!match) return;

      event.preventDefault();
      match.run();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shortcuts, enabled]);
}
