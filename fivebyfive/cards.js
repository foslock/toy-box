// Playing cards, and what a line of them makes. No DOM: the page and the Node balance runs share it.
//
// A card is { id, r, s, e }: rank 2..14 (11 Jack, 12 Queen, 13 King, 14 Ace), suit 0..3 (spades, hearts, diamonds,
// clubs) and an optional mark from the bar's tricks ('wild' counts as every suit, 'bonus' +30 chips, 'mult' +4 mult,
// 'glass' ×1.5 mult).

export const SUIT_NAME = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
export const SUIT_ONE = ['Spade', 'Heart', 'Diamond', 'Club'];
export const isRed = s => s === 1 || s === 2;
export const rankLabel = r => r <= 10 ? String(r) : 'JQKA'[r - 11];
export const rankName = r => ({ 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' })[r] || String(r);
export const isFace = r => r >= 11 && r <= 13;
export const cardChips = r => r === 14 ? 11 : Math.min(r, 10);
export const cardName = c => `${rankName(c.r)} of ${SUIT_NAME[c.s]}`;

// The hands, weakest first. Each pays chips × mult; a tip sheet from the bar adds `up` to a hand for good.
export const HANDS = [
  { id: 'high', name: 'High Card', short: 'High card', chips: 5, mult: 1, up: [10, 1] },
  { id: 'pair', name: 'Pair', short: 'Pair', chips: 10, mult: 2, up: [15, 1] },
  { id: 'twopair', name: 'Two Pair', short: 'Two pair', chips: 20, mult: 2, up: [20, 1] },
  { id: 'trips', name: 'Three of a Kind', short: 'Trips', chips: 30, mult: 3, up: [20, 2] },
  { id: 'straight', name: 'Straight', short: 'Straight', chips: 30, mult: 4, up: [30, 3] },
  { id: 'flush', name: 'Flush', short: 'Flush', chips: 35, mult: 4, up: [15, 2] },
  { id: 'full', name: 'Full House', short: 'Full house', chips: 40, mult: 4, up: [25, 2] },
  { id: 'quads', name: 'Four of a Kind', short: 'Quads', chips: 60, mult: 7, up: [30, 3] },
  { id: 'sflush', name: 'Straight Flush', short: 'Str. flush', chips: 100, mult: 8, up: [40, 4] },
  { id: 'five', name: 'Five of a Kind', short: 'Five kind', chips: 120, mult: 12, up: [35, 3] },
];
export const H = Object.fromEntries(HANDS.map((h, i) => [h.id, i]));

// What a hand has in it, for the regulars who pay on a kind of hand: a full house has a pair, two pair and trips in it.
const HAS = {
  pair: [H.pair, H.twopair, H.trips, H.full, H.quads, H.five],
  twopair: [H.twopair, H.full, H.quads],
  trips: [H.trips, H.full, H.quads, H.five],
  straight: [H.straight, H.sflush],
  flush: [H.flush, H.sflush],
  quads: [H.quads, H.five],
};
export const contains = (h, kind) => HAS[kind].includes(h);

export function freshDeck() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ id: s * 13 + r - 2, r, s, e: null });
  return d;
}

// Straight windows: runs of n rank positions (2 is position 0, the Ace is 12, and also -1 at the bottom of A-2-3-4-5).
// Turning the corner (The Professor) makes the ranks a circle instead, so Q-K-A-2-3 counts.
const windows = {};
function runs(n, wrap) {
  const key = n + (wrap ? 'w' : '');
  if (windows[key]) return windows[key];
  const out = [];
  if (wrap) for (let a = 0; a < 13; a++) out.push(Array.from({ length: n }, (_, i) => (a + i) % 13));
  else for (let a = -1; a <= 13 - n; a++) out.push(Array.from({ length: n }, (_, i) => a + i));
  return (windows[key] = out);
}
const covers = (r, p) => r - 2 === p || (r === 14 && p === -1);
const suits = (c, s) => c.s === s || c.ws;

// The run of `need` cards inside these slots, as slot indices of the real cards in it, or null. With `suit` set it
// has to be all one suit too (a straight flush). When the run uses every slot, every real card has to be in it.
function runIn(slots, reals, k, need, wrap, suit) {
  const L = slots.length;
  for (const w of runs(need, wrap)) {
    const used = [];
    for (const p of w) {
      const i = reals.find(i => !used.includes(i) && covers(slots[i].r, p) && (suit < 0 || suits(slots[i], suit)));
      if (i !== undefined) used.push(i);
    }
    if (used.length + k < need) continue;
    if (L === need && used.length !== reals.length) continue;
    return used;
  }
  return null;
}

// What these cards make. `slots` holds four or five cards (a bricked-up square is simply left out); a slot with
// `w` is fully wild (The Hole, or a face card in a column with Uncle Moe sitting in), one with `ws` is every suit.
// `opts.four`: flushes and straights need four cards (Four-Finger Lou). `opts.wrap`: straights turn the corner.
// `opts.partial`: the line isn't full yet, so only pairs, trips and the like count.
// Returns { h, scoring }: the hand and the slot indices of the cards that score in it.
export function evaluate(slots, opts = {}) {
  const L = slots.length, need = opts.four ? 4 : 5, runsOk = !opts.partial && L >= need;
  const reals = [], wilds = [];
  slots.forEach((c, i) => (c.w ? wilds : reals).push(i));
  const k = wilds.length;
  const by = new Map();
  for (const i of reals) { const r = slots[i].r; if (!by.has(r)) by.set(r, []); by.get(r).push(i); }
  const groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]).map(g => g[1]);
  const c1 = groups[0]?.length || 0, c2 = groups[1]?.length || 0;
  const all = slots.map((_, i) => i);
  const plus = idx => [...idx, ...wilds].sort((a, b) => a - b);

  if (!opts.partial && L === 5 && c1 + k >= 5) return { h: H.five, scoring: all };
  if (runsOk) {
    for (let s = 0; s < 4; s++) {
      const run = runIn(slots, reals, k, need, opts.wrap, s);
      if (run) return { h: H.sflush, scoring: plus(run) };
    }
  }
  if (c1 + k >= 4) return { h: H.quads, scoring: plus(groups[0] || []) };
  if (!opts.partial && L === 5 && Math.max(0, 3 - c1) + Math.max(0, 2 - c2) <= k) return { h: H.full, scoring: all };
  if (runsOk) {
    let best = null;
    for (let s = 0; s < 4; s++) {
      const idx = reals.filter(i => suits(slots[i], s));
      if (idx.length + k >= need && (!best || idx.length > best.length)) best = idx;
    }
    if (best) return { h: H.flush, scoring: plus(best) };
    const run = runIn(slots, reals, k, need, opts.wrap, -1);
    if (run) return { h: H.straight, scoring: plus(run) };
  }
  if (c1 + k >= 3) return { h: H.trips, scoring: plus(groups[0] || []) };
  if (c1 >= 2 && c2 >= 2) return { h: H.twopair, scoring: [...groups[0], ...groups[1]].sort((a, b) => a - b) };
  if (c1 + k >= 2) return { h: H.pair, scoring: plus(groups[0] || []) };
  if (!reals.length) return { h: H.high, scoring: [] };
  const top = reals.reduce((b, i) => slots[i].r > slots[b].r ? i : b, reals[0]);
  return { h: H.high, scoring: [top] };
}

// What a line that isn't full yet has going for it: the pairs and such already down, and whether a flush or a
// straight is still on. `slots` has null for an empty square; bricks are left out.
export function outlook(slots, opts = {}) {
  const down = slots.filter(Boolean), L = slots.length, need = opts.four ? 4 : 5;
  if (!down.length) return { made: -1, flush: -1, straight: false, full: false, n: 0 };
  if (down.length === L) return { made: evaluate(down, opts).h, flush: -1, straight: false, full: true, n: L };
  const made = evaluate(down, { ...opts, partial: true }).h;
  // a flush is still on while no more cards are off-suit than the line can spare (none, or one with four fingers)
  let flush = -1, most = 0;
  if (L >= need && down.length >= 2) {
    for (let s = 0; s < 4; s++) {
      const n = down.filter(c => c.w || suits(c, s)).length;
      if (down.length - n <= L - need && n > most) { flush = s; most = n; }
    }
  }
  let straight = false;
  if (L >= need && down.length >= 2) {
    const reals = [], k = down.filter(c => c.w).length;
    down.forEach((c, i) => { if (!c.w) reals.push(i); });
    const free = L - down.length;
    for (const w of runs(need, opts.wrap)) {
      const used = [];
      for (const p of w) { const i = reals.find(i => !used.includes(i) && covers(down[i].r, p)); if (i !== undefined) used.push(i); }
      const spare = L - need;   // cards that can sit outside the run (four fingers)
      if (reals.length - used.length <= spare && used.length + k + free >= need) { straight = true; break; }
    }
  }
  return { made, flush, straight, full: false, n: down.length };
}
