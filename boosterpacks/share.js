// Share links: a card sealed into an opaque token (?card=…), so a link can't be guessed or edited by hand. The card's
// set, item and finish are scrambled with a keystream drawn from a secret and a random salt (so the same card shares as a
// different link every time), and a 48-bit check is added: change any character and the link stops working.
// The game has no server, so this is a lock against guessing, not against someone who reads this code.
const SECRET = new TextEncoder().encode('odds&ends · shared pull · 7f3c9a1e5b · keep it to yourself');
const VERSION = 1, SALT = 3, CHECK = 6;

// 32-bit FNV-1a over the secret and the given bytes, from a seed, with a final avalanche so every bit counts
function hash32(seed, ...parts) {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (const bytes of [SECRET, ...parts]) for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
function keystream(salt, n) {   // splitmix32, seeded from the secret and the salt
  let s = hash32(0x9e3779b9, salt);
  return Uint8Array.from({ length: n }, () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); z ^= z >>> 16;
    return z & 255;
  });
}
function check(salt, text) {
  const a = hash32(0x5bd1e995, salt, text), b = hash32(0x27d4eb2f, text, salt);
  return Uint8Array.of(a >>> 24, a >>> 16, a >>> 8, a, b >>> 24, b >>> 16).map(x => x & 255);
}
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));

// A card ({ set, id, v }) → a token for a link.
export function seal(c) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT));
  const text = new TextEncoder().encode(`${c.set}:${c.id}:${c.v}`), ks = keystream(salt, text.length);   // (a misprint's own offset too)
  return b64([VERSION, ...salt, ...text.map((x, i) => x ^ ks[i]), ...check(salt, text)]);
}
// A token → the card, or null if it isn't one of ours (mistyped, edited or made up).
export function unseal(token) {
  try {
    if (!/^[\w-]{12,200}$/.test(token)) return null;
    const b = unb64(token);
    if (b[0] !== VERSION || b.length <= 1 + SALT + CHECK + 4) return null;
    const salt = b.slice(1, 1 + SALT), body = b.slice(1 + SALT, -CHECK), mac = b.slice(-CHECK), ks = keystream(salt, body.length);
    const text = body.map((x, i) => x ^ ks[i]);
    if (check(salt, text).some((x, i) => x !== mac[i])) return null;
    const [set, id, v, ...rest] = new TextDecoder().decode(text).split(':');
    const n = +v;   // a finish (0–3), or a misprint with its offset (bit 4 set, below 2048)
    return rest.length || !/^\d{1,4}$/.test(v) || n >= 2048 || (n > 3 && !(n & 4)) ? null : { set, id, v: n };
  } catch { return null; }
}
