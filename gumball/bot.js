// A simple player for the balance sim and the demo: picks gumballs by rough synergy.
import { KINDS } from './symbols.js';

// who helps whom, and by roughly how much per touch
const PARTNERS = {
  cherry: { cherry: 2 },
  bee: { flower: 2, cherry: 2, sunflower: 2, clover: 2, hive: 2 },
  flower: { bee: 2 }, sunflower: { bee: 2 }, clover: { bee: 2 },
  mouse: { cheese: 3, cat: 3 }, cheese: { mouse: 3 },
  cat: { fish: 6, mouse: 5, milk: 3 }, fish: { cat: 6 }, milk: { cat: 3 },
  magnet: { coin: 1, gold: 3 }, coin: { magnet: 1 }, gold: { magnet: 3 },
  hen: { egg: 2, chick: 2 }, egg: { hen: 2 }, chick: { hen: 2 },
  hive: { bee: 4 },
};
const SOLO = { seed: 1.4, egg: 1.6, dice: 3.5, balloon: 2, superball: 3, clover: 2, jawbreaker: 5, rainbow: 5, bomb: 1, diamond: 7, gold: 3 };

export function estimate(g, kind) {
  const n = g.items.length + 1, d = Math.min(g.dispense, n);
  const near = (d - 1) / n * 0.45;     // chance a given machine-mate lands touching it
  let v = SOLO[kind] ?? KINDS[kind].base;
  const P = PARTNERS[kind] || {};
  for (const it of g.items) v += (P[it.kind] || 0) * near * (kind === 'hive' ? 2 : 1);
  return v;
}

export function botPick(g, offers) {
  let avg = 0;
  for (const it of g.items) avg += estimate(g, it.kind);
  avg /= Math.max(1, g.items.length);
  let best = null, bv = avg * 0.8;
  for (const k of offers) { const v = estimate(g, k); if (v > bv) { bv = v; best = k; } }
  return best;
}

export function botNudge(g) {
  if (g.money < 15 + g.nudgeCost * 3 || g.nudges >= 2) return false;
  const s = g.score();
  const lonely = s.adj.filter((a) => !a.length).length;
  const eggs = g.tray.some((b) => b.kind === 'egg');
  if (lonely < 2 && !eggs) return false;
  return g.nudge(g.rand() < 0.5 ? -1 : 1);
}
