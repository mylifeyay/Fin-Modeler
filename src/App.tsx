import { useEffect, useState, type ComponentType } from 'react';
import { LockScreen } from './components/LockScreen';
import { SetupWizard } from './components/SetupWizard';
import { Confetti } from './components/Friendly';
import { Mascot } from './components/Mascot';
import { BarActions, BottomNav, Brand, NavRail, Sheet, Toast } from './components/Shell';
import { DETAILS } from './details/registry';
import { useLayoutMode } from './hooks/useViewport';
import { useApp, type Tab } from './store/context';
import { useDetailNav } from './store/useDetailNav';
import { LedgerView } from './views/LedgerView';
import { OverviewView } from './views/OverviewView';
import { PlanView } from './views/PlanView';
import { SimulateView } from './views/SimulateView';
import { VaultView } from './views/VaultView';

const VIEWS: Record<Tab, ComponentType> = {
  overview: OverviewView,
  plan: PlanView,
  simulate: SimulateView,
  ledger: LedgerView,
  vault: VaultView,
};

/** Mounts the confetti for one burst, then removes it. */
function PartyBurst() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 3200);
    return () => clearTimeout(t);
  }, []);
  return on ? <Confetti /> : null;
}

function Splash() {
  return (
    <div className="relative z-10 grid h-full place-items-center">
      <Mascot mood="calm" size={96} className="anim-pop" />
    </div>
  );
}

/** Cover screen: one column. Bottom tab bar in portrait, side rail in landscape. Details open as a sheet. */
function CoverShell({ rail }: { rail: boolean }) {
  const { tab } = useApp();
  const nav = useDetailNav();
  const View = VIEWS[tab];
  const detail = nav.active ? DETAILS[nav.active] : null;
  return (
    <div className="relative z-10 flex h-full">
      {rail && <NavRail />}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className={`glass-bar safe-top z-20 shrink-0 border-b border-line ${rail ? 'safe-right' : 'safe-left safe-right'}`}>
          <div className="flex h-[56px] items-center justify-between gap-3 px-4">
            <Brand />
            <BarActions />
          </div>
        </header>
        <main key={tab} className={`scroll-y min-h-0 flex-1 pt-4 ${rail ? 'safe-right' : 'safe-left safe-right'}`}>
          <div className="mx-auto max-w-[592px] px-4" style={{ paddingBottom: rail ? 'calc(env(safe-area-inset-bottom, 0px) + 24px)' : 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}>
            <View />
          </div>
        </main>
        {!rail && <BottomNav />}
      </div>
      {detail && nav.active && (
        <Sheet key={nav.active} title={detail.title} onClose={nav.close}>
          <detail.Component />
        </Sheet>
      )}
    </div>
  );
}

/**
 * Unfolded inner display: two equal panes either side of the vertical fold.
 * Left is the cover-screen layout (charts, scenario controls, tab bar), so
 * folding and unfolding keeps your place. Right is the live inspection pane.
 * The gutter between them sits on the hinge: the tab bar stops at the left
 * pane's edge, and no control, title or tooltip is ever placed across the fold.
 */
function SplitShell() {
  const { tab } = useApp();
  const nav = useDetailNav();
  const View = VIEWS[tab];
  const detail = nav.active ? DETAILS[nav.active] : null;
  return (
    <div className="split relative z-10 h-full">
      <div className="safe-left relative flex min-h-0 min-w-0 flex-col">
        <header className="safe-top shrink-0">
          <div className="flex h-[60px] items-center px-5">
            <Brand />
          </div>
        </header>
        <main key={tab} className="scroll-y min-h-0 flex-1 px-5 pt-1">
          <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}>
            <View />
          </div>
        </main>
        <BottomNav />
      </div>
      <aside className="safe-right flex min-h-0 min-w-0 flex-col" aria-label="Detail">
        <header className="safe-top shrink-0">
          <div className="flex h-[60px] items-center justify-end px-5">
            <BarActions />
          </div>
        </header>
        <div key={nav.active ?? 'none'} className="scroll-y anim-rise min-h-0 flex-1 px-5 pt-1">
          <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
            {detail && (
              <>
                <h2 className="mb-4 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-fg">{detail.title}</h2>
                <detail.Component />
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const { ready, locked, wizard, party } = useApp();
  const mode = useLayoutMode();
  return (
    <>
      <div className="app-backdrop" aria-hidden />
      {!ready ? <Splash /> : locked ? <LockScreen /> : wizard ? <SetupWizard /> : mode === 'split' ? <SplitShell /> : <CoverShell rail={mode === 'cover-wide'} />}
      <Toast />
      {party > 0 && <PartyBurst key={party} />}
    </>
  );
}
