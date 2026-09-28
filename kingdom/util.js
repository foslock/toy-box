// Small shared helpers: seeded random numbers (whose state can be saved and restored), and a few maths bits.
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);

// mulberry32. f.state() and f.state(n) read and restore where it's up to, so a saved life carries on the same way.
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  const f = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.state = v => { if (v !== undefined) s = v | 0; return s; };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.chance = p => f() < p;
  f.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  f.weighted = pairs => { let tot = 0; for (const [, w] of pairs) tot += w; let r = f() * tot; for (const [v, w] of pairs) if ((r -= w) <= 0) return v; return pairs[pairs.length - 1][0]; };
  return f;
}
// A stable pseudo-random number in [0, 1) for a pair of integers (and an optional salt), for things drawn the same every time.
export function hash2(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const randomSeed = () => 1 + Math.floor(Math.random() * 2147483000);
