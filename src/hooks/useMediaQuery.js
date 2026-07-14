import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query without resize listeners or refs-as-state.
 * The snapshot is read synchronously, so the first render already has the
 * correct value (no desktop-sized flash on mobile).
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
