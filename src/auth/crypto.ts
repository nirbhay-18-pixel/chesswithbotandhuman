/**
 * Password hashing — PBKDF2-HMAC-SHA256 via the WebCrypto API.
 * Passwords are never stored or transmitted in plain text; only a
 * salted, iterated digest is persisted.
 */

export interface PasswordDigest {
  hash: string; // hex
  salt: string; // hex
  iterations: number;
}

/** OWASP-recommended order of magnitude for client-side PBKDF2-SHA256. */
export const PBKDF2_ITERATIONS = 310_000;
const KEY_LENGTH_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function assertWebCrypto() {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error(
      "Secure crypto is unavailable — authentication requires HTTPS or localhost.",
    );
  }
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  assertWebCrypto();
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
    material,
    KEY_LENGTH_BITS,
  );
  return toHex(new Uint8Array(bits));
}

/** Hash a password with a fresh random salt. */
export async function hashPassword(password: string): Promise<PasswordDigest> {
  assertWebCrypto();
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return { hash, salt: toHex(salt), iterations: PBKDF2_ITERATIONS };
}

/** Constant-time-ish verification of a password against a stored digest. */
export async function verifyPassword(
  password: string,
  digest: PasswordDigest,
): Promise<boolean> {
  try {
    const candidate = await derive(password, fromHex(digest.salt), digest.iterations);
    if (candidate.length !== digest.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
      diff |= candidate.charCodeAt(i) ^ digest.hash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/** Cryptographically random session token. */
export function makeSessionToken(): string {
  assertWebCrypto();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function makeUserId(): string {
  return crypto.randomUUID();
}
