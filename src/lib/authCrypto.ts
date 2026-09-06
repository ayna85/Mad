/**
 * Cryptographic utilities for secure client-side password hashing and authentication
 * Uses native Web Crypto API (SHA-256 with per-user cryptographic salt)
 */

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`salt_${salt}__pw_${password}__mad_miyawa_secure_key_2026`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPasswordSecondary(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`salt_${salt}__pass_${password}__mad_sec_2026`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  try {
    if (!storedHash) return false;
    const candidates = [password, password.trim()];
    for (const p of candidates) {
      const computed1 = await hashPassword(p, salt);
      if (computed1 === storedHash) return true;
      const computed2 = await hashPasswordSecondary(p, salt);
      if (computed2 === storedHash) return true;
      
      // Direct raw SHA-256 fallback
      const enc = new TextEncoder();
      const rawBuf = await window.crypto.subtle.digest('SHA-256', enc.encode(p));
      const rawHex = Array.from(new Uint8Array(rawBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      if (rawHex === storedHash) return true;

      const vaultBuf = await window.crypto.subtle.digest('SHA-256', enc.encode(`mad_vault_${p}_salt_miyawa3a`));
      const vaultHex = Array.from(new Uint8Array(vaultBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      if (vaultHex === storedHash) return true;
    }
    return false;
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

export async function hashPinCode(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`pin_salt_${salt}__pin_${pin}__mad_pin_security_2026`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPinCode(pin: string, storedHash: string, salt: string): Promise<boolean> {
  try {
    const computedHash = await hashPinCode(pin, salt);
    return computedHash === storedHash;
  } catch (err) {
    console.error('PIN verification error:', err);
    return false;
  }
}
