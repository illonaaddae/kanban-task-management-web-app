import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query from JavaScript.
 *
 * Layout that only CSS cares about belongs in CSS. This is for the cases where
 * behaviour differs, not just appearance — the sidebar is a persistent column on
 * a desktop and a dismissable drawer on a phone, and "dismissable" is state, not
 * a style.
 *
 * `useSyncExternalStore` rather than useState + useEffect: matchMedia *is* an
 * external store, so React reads it during render instead of rendering once with
 * a guess and then correcting itself.
 */
export function useMediaQuery(query: string): boolean {
  const list = useMemo(
    () => (typeof window === 'undefined' ? null : window.matchMedia(query)),
    [query]
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    [list]
  );

  return useSyncExternalStore(
    subscribe,
    () => list?.matches ?? false,
    // Server render: assume the desktop layout rather than flashing a drawer.
    () => false
  );
}

/** Phones and tablets: the sidebar overlays content instead of sitting beside it. */
export const NARROW_VIEWPORT = '(max-width: 1024px)';
