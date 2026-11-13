import { useLayoutMode } from '../hooks/useViewport';
import { useApp, type DetailId, type Tab } from './context';

/** What the inspection pane shows on the unfolded display before anything is tapped. */
export const DEFAULT_DETAIL: Record<Tab, DetailId> = {
  overview: 'networth',
  plan: 'edit-profile',
  simulate: 'success',
  ledger: 'ledger',
  vault: 'about',
};

export function useDetailNav(): { active: DetailId | null; open: (id: DetailId) => void; close: () => void; split: boolean } {
  const { detail, setDetail, tab } = useApp();
  const split = useLayoutMode() === 'split';
  return {
    active: detail ?? (split ? DEFAULT_DETAIL[tab] : null),
    open: setDetail,
    close: () => setDetail(null),
    split,
  };
}
