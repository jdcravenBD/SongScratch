/**
 * A unique id for a song or a recording.
 *
 * Not `crypto.randomUUID()` on its own: that one is marked `[SecureContext]`,
 * so it simply isn't there on a plain `http://192.168.x.x` origin — which is
 * exactly how the app is opened on a phone over the LAN. Calling it there
 * throws, and every "new song" quietly does nothing.
 *
 * `crypto.getRandomValues` carries no such restriction, so the fallback is a
 * hand-assembled v4 UUID with the same randomness behind it.
 */
export function newId(): string {
  const c = globalThis.crypto;

  if (typeof c?.randomUUID === 'function') return c.randomUUID();

  if (typeof c?.getRandomValues === 'function') {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Nothing cryptographic available at all. Uniqueness is all that's needed
  // here — these are local record keys, not secrets.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}
