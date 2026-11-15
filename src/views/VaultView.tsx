import { useRef, useState } from 'react';
import { Download, Eraser, FileLock2, FileSpreadsheet, Fingerprint, Info, KeyRound, Lock, RotateCcw, Upload, Wand2 } from 'lucide-react';
import { PIN_MAX, PIN_MIN } from '../components/LockScreen';
import { Button, Card, Chevron, Group, Note, Segmented, TextField, Toggle } from '../components/ui';
import { projectionToCsv } from '../engine/csv';
import { blankPlan, normalizePlan, samplePlan } from '../engine/defaults';
import { dateStamp, readTextFile, saveFile } from '../lib/download';
import { BACKUP_FORMAT, decryptBackup, encryptBackup, hashPin, isEncryptedBackup, verifyPin, type EncryptedBackup } from '../security/crypto';
import { passkeyAvailable, registerPasskey } from '../security/passkey';
import { useApp, type ThemeChoice } from '../store/context';
import { useDetailNav } from '../store/useDetailNav';

/** Destructive actions ask for a second tap. */
function ConfirmButton({ label, confirmLabel, icon, onConfirm }: { label: string; confirmLabel: string; icon: typeof Eraser; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <Button
      icon={icon}
      variant={armed ? 'danger' : 'secondary'}
      className="w-full"
      onClick={() => {
        if (timer.current) clearTimeout(timer.current);
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3500);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}

function DataSection() {
  const { plan, projection, settings, replacePlan, notify, startYear, setWizard } = useApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [encrypting, setEncrypting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState<EncryptedBackup | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = () => ({ format: BACKUP_FORMAT, version: 1, encrypted: false, exportedAt: new Date().toISOString(), plan });

  const exportPlain = async () => {
    await saveFile(`fin-modeler-backup-${dateStamp()}.json`, 'application/json', JSON.stringify(payload(), null, 2));
    notify('Plain backup exported');
  };

  const exportEncrypted = async () => {
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      const sealed = await encryptBackup(payload(), password);
      await saveFile(`fin-modeler-backup-${dateStamp()}.enc.json`, 'application/json', JSON.stringify(sealed, null, 2));
      setEncrypting(false);
      setPassword('');
      setConfirm('');
      notify('Encrypted backup exported');
    } catch {
      setError('Encryption failed on this device.');
    } finally {
      setBusy(false);
    }
  };

  const load = (data: unknown) => {
    const candidate = typeof data === 'object' && data !== null && 'plan' in data ? (data as { plan: unknown }).plan : data;
    if (typeof candidate !== 'object' || candidate === null || !('profile' in candidate) || !('liquid' in candidate)) {
      setError('That file is not a Fin Modeler backup.');
      return;
    }
    replacePlan(normalizePlan(candidate, startYear));
    notify('Backup imported');
  };

  const onFile = async (file: File | undefined) => {
    setError(null);
    setPending(null);
    if (!file) return;
    if (file.size > 5_000_000) return setError('That file is too large to be a backup.');
    try {
      const parsed: unknown = JSON.parse(await readTextFile(file));
      if (isEncryptedBackup(parsed)) setPending(parsed);
      else load(parsed);
    } catch {
      setError('That file is not valid JSON.');
    }
  };

  const unlockImport = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      load(await decryptBackup(pending, importPassword));
      setPending(null);
      setImportPassword('');
    } catch {
      setError('Wrong password, or the file has been altered.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Group title="Backup" note="Files are built on this device and handed to the share sheet. Save them to Files or iCloud Drive yourself. Nothing is uploaded by the app.">
        <div className="grid gap-2 py-2">
          <Button icon={Download} className="w-full" onClick={() => void exportPlain()}>
            Export JSON
          </Button>
          <Button icon={FileLock2} className="w-full" onClick={() => setEncrypting(!encrypting)}>
            Export encrypted backup
          </Button>
          {encrypting && (
            <form
              className="rounded-2xl border border-line bg-raised px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                void exportEncrypted();
              }}
            >
              <TextField label="Backup password" type="password" autoComplete="new-password" value={password} onChange={setPassword} />
              <TextField label="Repeat password" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
              <p className="py-1 text-[12px] leading-snug text-fg3">AES-256-GCM, key derived with PBKDF2-SHA-256. There is no recovery if the password is lost.</p>
              <Button type="submit" variant="primary" className="my-1 w-full" disabled={busy}>
                {busy ? 'Encrypting…' : 'Encrypt and export .enc.json'}
              </Button>
            </form>
          )}
          <Button
            icon={FileSpreadsheet}
            className="w-full"
            onClick={() => void saveFile(`fin-modeler-projection-${dateStamp()}.csv`, 'text/csv', projectionToCsv(projection, settings.real)).then(() => notify('Projection exported'))}
          >
            Export projection CSV
          </Button>
          <Button icon={Upload} className="w-full" onClick={() => fileRef.current?.click()}>
            Import backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {pending && (
            <form
              className="rounded-2xl border border-line bg-raised px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                void unlockImport();
              }}
            >
              <TextField label="Password for this encrypted backup" type="password" autoComplete="off" value={importPassword} onChange={setImportPassword} />
              <Button type="submit" variant="primary" className="my-1 w-full" disabled={busy || importPassword.length === 0}>
                {busy ? 'Decrypting…' : 'Decrypt and import'}
              </Button>
            </form>
          )}
          {error && <Note tone="critical">{error}</Note>}
        </div>
      </Group>

      <Group title="Start over" note="Guided setup saves nothing until you finish. Reset and Clear replace the current plan at once. Export a backup first if you want to keep it.">
        <div className="grid gap-2 py-2">
          <Button icon={Wand2} variant="primary" className="w-full" onClick={() => setWizard(true)}>
            Guided setup
          </Button>
          <ConfirmButton
            icon={RotateCcw}
            label="Reset to Sample"
            confirmLabel="Tap again to load the Sample Preset"
            onConfirm={() => {
              replacePlan(samplePlan(startYear));
              notify('Sample Preset loaded');
            }}
          />
          <ConfirmButton
            icon={Eraser}
            label="Clear to Blank"
            confirmLabel="Tap again to clear every figure"
            onConfirm={() => {
              replacePlan(blankPlan(startYear));
              notify('Plan cleared');
            }}
          />
        </div>
      </Group>
    </>
  );
}

function SecuritySection() {
  const { lock, setLock, setLocked, notify } = useApp();
  const [mode, setMode] = useState<'idle' | 'set' | 'remove'>('idle');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [current, setCurrent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasLock = Boolean(lock.pin || lock.passkeyId);
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_MAX);

  const reset = () => {
    setMode('idle');
    setPin('');
    setPin2('');
    setCurrent('');
    setError(null);
  };

  const checkCurrent = async (): Promise<boolean> => {
    if (!lock.pin) return true;
    const ok = await verifyPin(current, lock.pin).catch(() => false);
    if (!ok) setError('The current passcode is wrong.');
    return ok;
  };

  const savePin = async () => {
    setError(null);
    if (pin.length < PIN_MIN) return setError(`Use ${PIN_MIN} to ${PIN_MAX} digits.`);
    if (pin !== pin2) return setError('The two passcodes do not match.');
    setBusy(true);
    try {
      if (!(await checkCurrent())) return;
      setLock({ ...lock, pin: await hashPin(pin) });
      notify('Passcode set');
      reset();
    } finally {
      setBusy(false);
    }
  };

  const removePin = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!(await checkCurrent())) return;
      setLock({ ...lock, pin: undefined });
      notify('Passcode removed');
      reset();
    } finally {
      setBusy(false);
    }
  };

  const addPasskey = async () => {
    setError(null);
    if (!(await passkeyAvailable())) return setError('This device or browser has no platform passkey support. Passkeys also need HTTPS.');
    try {
      setLock({ ...lock, passkeyId: await registerPasskey() });
      notify('Passkey unlock enabled');
    } catch {
      setError('The passkey was not created.');
    }
  };

  return (
    <Group title="App lock" note="The lock gates the screen. It does not encrypt stored data. See the privacy panel for the full picture.">
      <div className="grid gap-2 py-2">
        {mode === 'idle' && (
          <>
            <Button icon={KeyRound} className="w-full" onClick={() => setMode('set')}>
              {lock.pin ? 'Change passcode' : 'Set a passcode'}
            </Button>
            {lock.pin && (
              <Button icon={KeyRound} className="w-full" onClick={() => setMode('remove')}>
                Remove passcode
              </Button>
            )}
          </>
        )}
        {mode !== 'idle' && (
          <form
            className="rounded-2xl border border-line bg-raised px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              void (mode === 'set' ? savePin() : removePin());
            }}
          >
            {lock.pin && <TextField label="Current passcode" type="password" inputMode="numeric" autoComplete="off" value={current} onChange={(v) => setCurrent(digits(v))} />}
            {mode === 'set' && (
              <>
                <TextField label={`New passcode, ${PIN_MIN} to ${PIN_MAX} digits`} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(v) => setPin(digits(v))} />
                <TextField label="Repeat new passcode" type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(v) => setPin2(digits(v))} />
              </>
            )}
            <div className="flex gap-2 py-1">
              <Button className="flex-1" onClick={reset}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" variant={mode === 'set' ? 'primary' : 'danger'} disabled={busy}>
                {mode === 'set' ? 'Save passcode' : 'Remove'}
              </Button>
            </div>
          </form>
        )}
        {lock.passkeyId ? (
          <Button
            icon={Fingerprint}
            className="w-full"
            onClick={() => {
              setLock({ ...lock, passkeyId: undefined });
              notify('Passkey unlock removed');
            }}
          >
            Remove passkey unlock
          </Button>
        ) : (
          <Button icon={Fingerprint} className="w-full" onClick={() => void addPasskey()}>
            Enable Face ID / passkey unlock
          </Button>
        )}
        {error && <Note tone="critical">{error}</Note>}
      </div>
      {hasLock && (
        <>
          <Toggle label="Lock when left in the background" hint="After 30 seconds away" checked={lock.autoLock} onChange={(v) => setLock({ ...lock, autoLock: v })} />
          <div className="py-2">
            <Button icon={Lock} className="w-full" onClick={() => setLocked(true)}>
              Lock now
            </Button>
          </div>
        </>
      )}
    </Group>
  );
}

export function VaultView() {
  const { settings, setSettings, notify } = useApp();
  const nav = useDetailNav();
  return (
    <div className="anim-rise">
      <Card onClick={() => nav.open('about')} selected={nav.split && nav.active === 'about'} className="!p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-raised text-fg2">
            <Info size={19} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-fg">Privacy and how it works</span>
            <span className="mt-0.5 block truncate text-[13px] text-fg3">On-device only. No network, no tracking.</span>
          </span>
          <Chevron />
        </div>
      </Card>

      <DataSection />
      <SecuritySection />

      <Group title="Display">
        <div className="py-2">
          <Segmented<ThemeChoice>
            label="Theme"
            value={settings.theme}
            onChange={(v) => setSettings({ theme: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <Toggle label="Privacy blur" hint="Blur every monetary value. Same as the eye in the top bar." checked={settings.privacy} onChange={(v) => setSettings({ privacy: v })} />
        <Toggle label="Today’s dollars" hint="Show inflation-adjusted values instead of nominal." checked={settings.real} onChange={(v) => setSettings({ real: v })} />
      </Group>

      <Group title="Storage">
        <div className="py-2">
          <Button
            className="w-full"
            onClick={() =>
              void (navigator.storage?.persist ? navigator.storage.persist() : Promise.resolve(false)).then((ok) => notify(ok ? 'Storage is protected from eviction' : 'The browser declined. Install to the Home Screen first.'))
            }
          >
            Ask the browser to protect stored data
          </Button>
        </div>
      </Group>
    </div>
  );
}
