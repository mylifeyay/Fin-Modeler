import { fromBase64, toBase64 } from './crypto';

/**
 * Optional biometric unlock through a device-bound WebAuthn passkey.
 *
 * There is no server. The credential is created and asserted on this device,
 * with user verification (Face ID / Touch ID / device passcode) required. A
 * resolved assertion is treated as proof that the device owner is present.
 */

export async function passkeyAvailable(): Promise<boolean> {
  try {
    return (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

/** Creates a platform passkey and returns its credential id (base64). */
export async function registerPasskey(): Promise<string> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Fin Modeler', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'local-user', displayName: 'Local User' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      attestation: 'none',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error('Passkey creation was cancelled.');
  return toBase64(new Uint8Array(credential.rawId));
}

/** Resolves true when the device verifies the user against the stored passkey. */
export async function verifyPasskey(credentialId: string): Promise<boolean> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromBase64(credentialId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return assertion !== null;
  } catch {
    return false;
  }
}
