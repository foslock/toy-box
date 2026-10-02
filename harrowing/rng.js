// Seeded randomness. A run keeps one generator per purpose (map, fights, rewards, shops), so a shuffle in one fight
// never changes which cards a later shop offers, and a saved run picks up exactly where it was.
export function mulberry(seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.state = () => a;
  r.set = s => { a = s >>> 0; };
  return r;
}
export const hashString = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export class Rng {
  constructor(seed) { this.r = mulberry(seed); }
  next() { return this.r(); }
  int(n) { return Math.floor(this.r() * n); }
  range(a, b) { return a + Math.floor(this.r() * (b - a + 1)); }
  chance(p) { return this.r() < p; }
  pick(a) { return a[Math.floor(this.r() * a.length)]; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // weighted pick from [[item, weight], ...]
  weighted(list) {
    let t = 0; for (const [, w] of list) t += w;
    let x = this.r() * t;
    for (const [it, w] of list) { if ((x -= w) < 0) return it; }
    return list[list.length - 1][0];
  }
  // n distinct items
  sample(a, n) { return this.shuffle(a.slice()).slice(0, n); }
  get state() { return this.r.state(); }
  set state(s) { this.r.set(s); }
}
