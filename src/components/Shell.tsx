import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Activity, Eye, EyeOff, LayoutDashboard, Lock, ShieldCheck, SlidersHorizontal, Table2, X, type LucideIcon } from 'lucide-react';
import { useApp, type Tab } from '../store/context';
import { IconButton } from './ui';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', icon: SlidersHorizontal },
  { id: 'simulate', label: 'Simulate', icon: Activity },
  { id: 'ledger', label: 'Ledger', icon: Table2 },
  { id: 'vault', label: 'Vault', icon: ShieldCheck },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="15" fill="#0b0e13" />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
      <path d="M12 46 L24 36 L33 40 L52 18" fill="none" stroke="#3987e5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 52 L24 47 L33 49 L52 38" fill="none" stroke="#3ddc97" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand() {
  const { plan } = useApp();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Logo />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[16px] font-semibold tracking-[-0.01em] text-fg">Fin Modeler</div>
        <div className="truncate text-[11px] font-medium text-fg3">{plan.label}</div>
      </div>
    </div>
  );
}

/** Real / nominal switch, privacy blur and lock. Always right-aligned, never centred. */
export function BarActions() {
  const { settings, setSettings, lock, setLocked } = useApp();
  const hasLock = Boolean(lock.pin || lock.passkeyId);
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => setSettings({ real: !settings.real })}
        aria-label={settings.real ? 'Showing today’s dollars. Switch to nominal.' : 'Showing nominal dollars. Switch to today’s dollars.'}
        className="h-11 rounded-full border border-line bg-raised px-3.5 text-[12px] font-semibold text-fg transition-transform duration-300 ease-spring active:scale-95"
      >
        {settings.real ? 'Today’s $' : 'Nominal $'}
      </button>
      <IconButton
        icon={settings.privacy ? EyeOff : Eye}
        label={settings.privacy ? 'Privacy blur is on. Show values.' : 'Blur all monetary values'}
        active={settings.privacy}
        onClick={() => setSettings({ privacy: !settings.privacy })}
      />
      {hasLock && <IconButton icon={Lock} label="Lock now" onClick={() => setLocked(true)} />}
    </div>
  );
}

export function BottomNav() {
  const { tab, setTab } = useApp();
  return (
    <nav aria-label="Sections" className="glass-bar safe-bottom absolute inset-x-0 bottom-0 z-20 border-t border-line">
      <div className="mx-auto grid max-w-[520px] grid-cols-5 px-1">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={on ? 'page' : undefined} className="flex h-[54px] flex-col items-center justify-center gap-[3px]">
              <t.icon size={21} strokeWidth={on ? 2.4 : 1.9} style={{ color: on ? 'var(--accent)' : 'var(--fg3)' }} className="transition-transform duration-300 ease-spring" aria-hidden />
              <span className={`text-[10.5px] font-semibold ${on ? 'text-fg' : 'text-fg3'}`}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Vertical rail: used on the unfolded display and on the cover screen in landscape. */
export function NavRail() {
  const { tab, setTab } = useApp();
  return (
    <nav aria-label="Sections" className="safe-left safe-top safe-bottom glass-bar z-20 flex shrink-0 flex-col items-center border-r border-line">
      <div className="flex w-[68px] flex-1 flex-col items-center justify-center gap-1 py-2">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`flex h-[56px] w-[58px] flex-col items-center justify-center gap-[3px] rounded-2xl transition-colors duration-200 ${on ? 'bg-raised' : ''}`}
            >
              <t.icon size={21} strokeWidth={on ? 2.4 : 1.9} style={{ color: on ? 'var(--accent)' : 'var(--fg3)' }} aria-hidden />
              <span className={`text-[10px] font-semibold ${on ? 'text-fg' : 'text-fg3'}`}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Bottom sheet for the cover screen. Drag the header down, tap the scrim, or press Escape to dismiss. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startY = useRef(0);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(onClose, 250);
  };
  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    startY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) setDrag(Math.max(0, e.clientY - startY.current));
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (drag > 110) dismiss();
    else setDrag(0);
  };

  return (
    <div className="fixed inset-0 z-40">
      <div
        onClick={dismiss}
        aria-hidden
        className="anim-fade-in absolute inset-0 bg-black/55 transition-opacity duration-200"
        style={{ opacity: leaving ? 0 : Math.max(0.25, 1 - drag / 500) }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[93dvh] max-w-[640px] flex-col rounded-t-[28px] border border-b-0 border-line-strong bg-solid shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)]"
        style={{
          transform: leaving ? 'translateY(100%)' : `translateY(${drag}px)`,
          transition: dragging ? 'none' : leaving ? 'transform 250ms cubic-bezier(0.4,0,1,1)' : 'transform 420ms var(--ease-spring)',
        }}
      >
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="shrink-0 cursor-grab touch-none px-4 pt-2.5 pb-2">
          <div aria-hidden className="mx-auto mb-2 h-[5px] w-10 rounded-full bg-line-strong" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="truncate text-[19px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
            <button ref={closeRef} type="button" onClick={dismiss} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-fg2 active:scale-90">
              <X size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        </div>
        <div className="scroll-y min-h-0 flex-1 px-4 pt-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }} role="status" aria-live="polite">
      <div className="anim-rise rounded-full border border-line-strong bg-solid px-4 py-2.5 text-[13px] font-semibold text-fg shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]">{toast}</div>
    </div>
  );
}
