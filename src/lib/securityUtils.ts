// Security and crypto utilities for folder/table passwords and lookup

// Simple SHA-256 string hash helper
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`mad_vault_${password.trim()}_salt_miyawa3a`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Obfuscation helper for authorized manager password lookup
export function encodePasswordVault(password: string): string {
  try {
    const raw = `MAD:${Date.now()}:${password.trim()}`;
    return btoa(unescape(encodeURIComponent(raw)));
  } catch (e) {
    return btoa(password);
  }
}

export function decodePasswordVault(encoded: string): string | null {
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    const parts = decoded.split(':');
    if (parts.length >= 3 && parts[0] === 'MAD') {
      return parts.slice(2).join(':');
    }
    return decoded;
  } catch (e) {
    try {
      return atob(encoded);
    } catch {
      return null;
    }
  }
}
