// Judging footage: which creature a clip is really about, what it was doing,
// how well it was framed, and which clips make the cut.
import { SPECIES, behInfo } from './creatures.js';
import { SNAP_HZ } from './world.js';
import { clamp } from './paper.js';

export const RARITY_PTS = { 1: 100, 2: 250, 3: 500 };
const DT = 1 / SNAP_HZ;

export function quality(s) {
  const b = s.beh && behInfo(s.sp, s.beh);
  const visQ = clamp((s.vis - 0.45) / 0.45, 0, 1);
  const sizeQ = clamp(s.size / ((b && b.sz) || 0.13), 0, 1) ** 0.8;
  const cenQ = 0.5 + 0.5 * s.cen;
  return visQ * sizeQ * cenQ;
}

export function analyseClip(clip) {
  const groups = new Map();
  const snaps = clip.snaps;
  for (let i = 0; i < snaps.length; i++) {
    const sn = snaps[i];
    for (const s of sn.sc) {
      if (!s.beh || !behInfo(s.sp, s.beh)) continue;
      const key = s.id + ':' + s.beh;
      let g = groups.get(key);
      if (!g) { g = { id: s.id, sp: s.sp, beh: s.beh, n: 0, q: 0, vis: 0, size: 0, shake: 0, first: i, last: i, lastC: null, bestI: i, bestQ: -1 }; groups.set(key, g); }
      const q = quality(s);
      if (s.vis < 0.3) continue;
      g.n++; g.q += q; g.vis += s.vis; g.size += s.size; g.last = i;
      if (q > g.bestQ) { g.bestQ = q; g.bestI = i; }
      // shake: how fast the subject slides across the frame
      const rx = (s.cx - sn.F.x) / sn.F.w, ry = (s.cy - sn.F.y) / sn.F.h;
      if (g.lastC && g.lastC.i === i - 1) g.shake += Math.hypot(rx - g.lastC.rx, ry - g.lastC.ry) / DT;
      g.lastC = { i, rx, ry };
    }
  }
  let best = null;
  for (const g of groups.values()) {
    if (g.n < 2) continue;
    const dur = g.n * DT;
    g.vis /= g.n; g.size /= g.n; g.q /= g.n; g.shake /= Math.max(1, g.n - 1);
    const shakeQ = clamp(1 - (g.shake - 0.35) / 1.4, 0.45, 1);
    g.dur = dur; g.shakeQ = shakeQ;
    g.qual = g.q * shakeQ;
    const r = behInfo(g.sp, g.beh).r;
    g.r = r;
    g.score = Math.round(RARITY_PTS[r] * (0.15 + 0.85 * g.qual) * clamp(dur / 2, 0, 1) * (dur >= 0.9 ? 1 : 0.4));
    g.tier = g.dur < 0.9 ? 0 : g.qual >= 0.62 ? 3 : g.qual >= 0.34 ? 2 : 1;
    g.defect = g.vis < 0.8 ? 'cut' : g.size < 0.06 ? 'far' : g.shakeQ < 0.7 ? 'shaky' : 'meh';
    if (!best || g.score > best.score) best = g;
  }
  clip.subject = best;
  clip.score = best ? best.score : 0;
  clip.tier = best ? best.tier : 0;
  // also note every behaviour seen well enough to go in the field guide
  clip.seen = [...groups.values()].filter((g) => g.dur >= 0.9 && g.qual > 0.08).map((g) => ({ sp: g.sp, beh: g.beh, tier: g.tier }));
  return clip;
}

// pick up to five, preferring different behaviours, then put them in order
export function autoCut(clips, n = 5) {
  const sorted = [...clips].filter((c) => c.snaps.length > 4).sort((a, b) => b.score - a.score);
  const pick = [], seen = new Set();
  for (const c of sorted) {
    if (pick.length >= n) break;
    const key = c.subject ? c.subject.sp + ':' + c.subject.beh : 'none';
    if (c.subject && seen.has(key)) continue;
    if (!c.subject && pick.some((p) => !p.subject)) continue;
    pick.push(c); seen.add(key);
  }
  for (const c of sorted) { if (pick.length >= n) break; if (!pick.includes(c) && c.subject) pick.push(c); }
  return pick.sort((a, b) => a.start - b.start);
}

export function episodeScore(cut) {
  let s = 0; const kinds = new Set();
  for (const c of cut) { s += c.score; if (c.subject) kinds.add(c.subject.sp); }
  const variety = Math.max(0, kinds.size - 1) * 60;
  return { clips: s, variety, total: s + variety };
}
export function stars(total) { return total >= 1900 ? 5 : total >= 1250 ? 4 : total >= 700 ? 3 : total >= 280 ? 2 : 1; }

// the playable window of a clip in the screening: around the subject's moment
export function clipWindow(clip, maxLen = 6.5) {
  const n = clip.snaps.length; const L = Math.round(maxLen * SNAP_HZ);
  if (n <= L) return [0, n - 1];
  const g = clip.subject;
  let mid = g ? Math.round((g.first + g.last) / 2) : Math.round(n / 2);
  if (g && g.last - g.first + 1 > L) mid = g.bestI;
  let a = clamp(mid - (L >> 1), 0, n - L);
  return [a, a + L - 1];
}
export function speciesName(sp) { return SPECIES[sp].name; }
