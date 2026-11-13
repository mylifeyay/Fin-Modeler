import { useSyncExternalStore } from 'react';

/**
 * Layout classes for the two displays of a book-style foldable.
 *  - `cover`: folded outer screen in portrait. Single column, bottom tab bar.
 *  - `cover-wide`: folded outer screen in landscape. Single column, side rail.
 *  - `split`: unfolded inner display, either orientation. Master-detail panes
 *    on either side of the vertical fold.
 */
export type LayoutMode = 'cover' | 'cover-wide' | 'split';

export const SPLIT_MIN_WIDTH = 680;
export const SPLIT_MIN_HEIGHT = 500;

function compute(): LayoutMode {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w >= SPLIT_MIN_WIDTH && h >= SPLIT_MIN_HEIGHT) return 'split';
  if (w > h && w >= 560) return 'cover-wide';
  return 'cover';
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('resize', cb);
  window.addEventListener('orientationchange', cb);
  window.visualViewport?.addEventListener('resize', cb);
  return () => {
    window.removeEventListener('resize', cb);
    window.removeEventListener('orientationchange', cb);
    window.visualViewport?.removeEventListener('resize', cb);
  };
}

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, compute, () => 'cover');
}

function subscribeScheme(cb: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export function useSystemDark(): boolean {
  return useSyncExternalStore(
    subscribeScheme,
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    () => true,
  );
}
