import { useEffect, useState } from 'react';
import { Delete, Fingerprint } from 'lucide-react';
import { kvDel, prefs } from '../lib/storage';
import { verifyPin } from '../security/crypto';
import { verifyPasskey } from '../security/passkey';
import { useApp } from '../store/context';
import { Mascot } from './Mascot';
import { Button } from './ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const PIN_MAX = 8;
export const PIN_MIN = 4;

/** Full-screen gate. Nothing financial is rendered behind it. */
export function LockScreen() {
  const { lock, setLocked } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  const submit = async (candidate: string) => {
    if (!lock.pin || candidate.length < PIN_MIN || checking) return;
    setChecking(true);
    const ok = await verifyPin(candidate, lock.pin).catch(() => false);
    setChecking(false);
    if (ok) {
      setLocked(false);
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 420);
    }
  };

  const press = (digit: string) => {
    if (checking || pin.length >= PIN_MAX) return;
    setPin(pin + digit);
  };

  const biometric = async () => {
    if (lock.passkeyId && (await verifyPasskey(lock.passkeyId))) setLocked(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lock.pin) return;
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < PIN_MAX ? p + e.key : p));
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lock.pin]);

  const erase = async () => {
    await kvDel('plan');
    prefs.del('lock');
    prefs.del('settings');
    location.reload();
  };

  return (
    <div className="safe-top safe-bottom relative z-10 flex h-full flex-col items-center justify-center px-6">
      <Mascot mood={error ? 'worried' : pin.length > 0 ? 'calm' : 'sleepy'} size={88} />
      <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.01em] text-fg">Fin Modeler is locked</h1>
      <p className="mt-1 text-center text-[14px] text-fg2">{error ? 'Not quite. Try again.' : lock.pin ? 'Pip is guarding your nest egg. Enter your passcode.' : 'Pip is guarding your nest egg. Unlock with your passkey.'}</p>

      {lock.pin && (
        <form
          className="mt-6 flex flex-col items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(pin);
          }}
        >
          <div className={`flex h-5 items-center gap-3 ${error ? 'anim-shake' : ''}`} aria-label={`${pin.length} digits entered`}>
            {Array.from({ length: Math.max(PIN_MIN, pin.length) }, (_, i) => (
              <span key={i} className={`h-3 w-3 rounded-full border border-line-strong transition-colors ${i < pin.length ? 'bg-fg' : ''}`} />
            ))}
          </div>
          <div className="mt-7 grid grid-cols-3 gap-x-5 gap-y-3.5">
            {KEYS.map((k) => (
              <button key={k} type="button" onClick={() => press(k)} className="num h-[68px] w-[68px] rounded-full border border-line bg-raised text-[26px] font-medium text-fg transition-transform duration-200 ease-spring active:scale-90">
                {k}
              </button>
            ))}
            <button type="button" aria-label="Delete last digit" onClick={() => setPin(pin.slice(0, -1))} className="grid h-[68px] w-[68px] place-items-center rounded-full text-fg2 active:scale-90">
              <Delete size={24} aria-hidden />
            </button>
            <button type="button" onClick={() => press('0')} className="num h-[68px] w-[68px] rounded-full border border-line bg-raised text-[26px] font-medium text-fg transition-transform duration-200 ease-spring active:scale-90">
              0
            </button>
            <button type="submit" disabled={pin.length < PIN_MIN || checking} className="h-[68px] w-[68px] rounded-full bg-accent text-[15px] font-semibold text-accent-ink transition-transform duration-200 ease-spring active:scale-90 disabled:opacity-35">
              OK
            </button>
          </div>
        </form>
      )}

      {lock.passkeyId && (
        <Button icon={Fingerprint} variant={lock.pin ? 'secondary' : 'primary'} onClick={() => void biometric()} className="mt-6">
          Unlock with passkey
        </Button>
      )}

      <div className="mt-6 text-center">
        {confirmErase ? (
          <div className="flex flex-col items-center gap-2">
            <p className="max-w-[280px] text-[12px] leading-snug text-fg2">This permanently deletes the plan, the passcode and all settings stored on this device.</p>
            <div className="flex gap-2">
              <Button onClick={() => setConfirmErase(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => void erase()}>
                Erase everything
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmErase(true)} className="min-h-[44px] px-3 text-[13px] text-fg3 underline underline-offset-4">
            Forgot it? Erase local data
          </button>
        )}
      </div>
    </div>
  );
}
