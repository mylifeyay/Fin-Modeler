import { useEffect, useState } from 'react';
import { Group, Note, Row } from '../components/ui';
import { storageBackend } from '../lib/storage';
import { useApp } from '../store/context';

export function AboutDetail() {
  const { lock, startYear } = useApp();
  const [backend, setBackend] = useState('…');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void storageBackend().then((b) => alive && setBackend(b));
    void navigator.storage?.persisted?.().then((p) => alive && setPersisted(p));
    return () => {
      alive = false;
    };
  }, []);
  const standalone = typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;

  return (
    <div>
      <Note tone="good">This app makes no network requests after it loads. No analytics, no telemetry, no accounts, no third-party code at runtime. A Content-Security-Policy blocks every origin but its own.</Note>
      <Group title="Where your data lives">
        <Row label="Plan storage" hint="On this device only">
          {backend}
        </Row>
        <Row label="Protected from eviction" hint="Granted by the browser, usually once installed">
          {persisted === null ? 'Unknown' : persisted ? 'Yes' : 'Not yet'}
        </Row>
        <Row label="Installed to Home Screen">{standalone ? 'Yes' : 'No'}</Row>
        <Row label="Passcode lock">{lock.pin ? 'On' : 'Off'}</Row>
        <Row label="Passkey unlock">{lock.passkeyId ? 'On' : 'Off'}</Row>
      </Group>
      <Group title="What the lock does and does not do">
        <p className="py-2 text-[13px] leading-relaxed text-fg2">
          The passcode is stored as a salted PBKDF2-SHA-256 hash and gates the screen. It keeps a casual onlooker out. It does not encrypt the plan at rest: anyone with the unlocked device and developer tools could read browser storage. For
          a copy that is safe to store elsewhere, use the encrypted backup. It is AES-256-GCM under a key derived from your password.
        </p>
      </Group>
      <Group title="Model notes">
        <ul className="list-disc space-y-1.5 py-2 pl-4 text-[13px] leading-relaxed text-fg2">
          <li>One step per year, from {startYear} to the plan’s end age. Returns and interest accrue on opening balances. The year’s net cash flow is saved or drawn at year end.</li>
          <li>Expected returns are compound rates. Monte Carlo draws lognormal returns whose median equals that rate.</li>
          <li>Statutory rules follow a CPF-style template and every rate, cap and age is editable. A single contribution rate and allocation applies for all working years.</li>
          <li>The lifetime payout is level in nominal terms. Tax brackets are not indexed to inflation.</li>
          <li>Dividends and coupons are treated as untaxed. Rental income is taxed after mortgage interest.</li>
          <li>Illustrative only. Not financial, tax or legal advice.</li>
        </ul>
      </Group>
    </div>
  );
}
