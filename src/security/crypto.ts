/**
 * Web Crypto helpers. Everything runs on-device.
 *  - PIN: salted PBKDF2 with SHA-256, stored as a hash, never in the clear.
 *  - Backups: AES-256-GCM with a PBKDF2-SHA-256 key derived from a password.
 */

const PIN_ITERATIONS = 150_000;
const BACKUP_ITERATIONS = 310_000;
export const BACKUP_FORMAT = 'fin-modeler-backup';

export interface PinRecord {
  algo: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  hash: string;
}

export interface EncryptedBackup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  encrypted: true;
  cipher: 'AES-256-GCM';
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  iv: string;
  data: string;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function pbkdf2Bits(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256);
  return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<PinRecord> {
  const salt = randomBytes(16);
  const hash = await pbkdf2Bits(pin, salt, PIN_ITERATIONS);
  return { algo: 'PBKDF2-SHA-256', iterations: PIN_ITERATIONS, salt: toBase64(salt), hash: toBase64(hash) };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const hash = await pbkdf2Bits(pin, fromBase64(record.salt), record.iterations);
  const expected = fromBase64(record.hash);
  if (hash.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i];
  return diff === 0;
}

async function backupKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptBackup(payload: unknown, password: string): Promise<EncryptedBackup> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await backupKey(password, salt, BACKUP_ITERATIONS);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return {
    format: BACKUP_FORMAT,
    version: 1,
    encrypted: true,
    cipher: 'AES-256-GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: BACKUP_ITERATIONS, salt: toBase64(salt) },
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  };
}

/** Throws when the password is wrong or the file was altered (GCM authenticates both). */
export async function decryptBackup(backup: EncryptedBackup, password: string): Promise<unknown> {
  const key = await backupKey(password, fromBase64(backup.kdf.salt), backup.kdf.iterations);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(backup.iv) }, key, fromBase64(backup.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

export function isEncryptedBackup(v: unknown): v is EncryptedBackup {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const kdf = o.kdf as Record<string, unknown> | undefined;
  return (
    o.format === BACKUP_FORMAT &&
    o.encrypted === true &&
    typeof o.iv === 'string' &&
    typeof o.data === 'string' &&
    typeof kdf === 'object' &&
    kdf !== null &&
    typeof kdf.salt === 'string' &&
    typeof kdf.iterations === 'number' &&
    kdf.iterations > 0 &&
    kdf.iterations <= 5_000_000
  );
}
