// The rules of the game and the player's save. Everything the player owns lives in one object that's kept in
// localStorage and can be exported to a file or a code and imported back.
import { SETS, SET_BY_ID } from './sets/index.js';

export const HOLO = 1, FULL = 2;
export const MULT = [1, 5, 2, 50];                                  // value by variant: plain, holo, full art, holo full art
export const VARIANT_NAME = ['', 'Holo', 'Full Art', 'Holo Full Art'];
export const HOLO_RATE = 1 / 40, FULL_RATE = 1 / 20;                // per card; a pack never has more than one of each
export const SLOTS = [['C', 5], ['U', 3], ['R', 1]];               // 9 cards: 5 common, 3 uncommon, 1 rare (the rare is last)
export const PACK_SIZE = 9;
export const BOX_PACKS = 10, BOX_PAYS_FOR = 9;                       // a box is 10 packs for the price of 9
export const RARITY = {
  C: { name: 'Common', symbol: '●', order: 0 },
  U: { name: 'Uncommon', symbol: '◆', order: 1 },
  R: { name: 'Rare', symbol: '★', order: 2 },
};
const KEY = 'boosterpacks.save';
const FORMAT = 2;          // 2: cards revalued (a pack went from $250 to $4.99)

/* ---------- cards ---------- */
// A card is { set, id, v }: set id, item id, variant bits. Its key is "set:item:v".
export const cardKey = c => `${c.set}:${c.id}:${c.v}`;
export function parseKey(key) {
  const [set, id, v] = String(key).split(':');
  return { set, id, v: +v || 0 };
}
export const itemOf = c => SET_BY_ID[c.set]?.itemById[c.id];
export const valueOf = c => { const it = itemOf(c); return it ? it.price * MULT[c.v & 3] : 0; };
export const knownCard = c => !!itemOf(c);

// Within a rarity, cheap cards turn up more often than dear ones: weight = (cheapest / value) ^ curve (curve 0 makes
// them all equal). An item can have its own weight, or fixed odds (one pack in `odds`); the rest share what's left.
for (const set of SETS) {
  set.itemById = Object.fromEntries(set.items.map(i => [i.id, i]));
  set.pools = {};
  for (const [r] of SLOTS) {
    const items = set.items.filter(i => i.rarity === r), min = Math.min(...items.map(i => i.price));
    const fixed = items.reduce((a, i) => a + (i.odds ? 1 / i.odds : 0), 0);
    const free = items.filter(i => !i.odds), w0 = free.map(i => i.weight ?? Math.pow(min / i.price, set.curve?.[r] ?? .5)), sum0 = w0.reduce((a, b) => a + b, 0);
    const p = items.map(i => i.odds ? 1 / i.odds : (w0[free.indexOf(i)] / sum0) * Math.max(0, 1 - fixed));
    const total = p.reduce((a, b) => a + b, 0);
    set.pools[r] = { items, cum: p.reduce((acc, x, i) => (acc.push((acc[i - 1] ?? 0) + x / total), acc), []) };
  }
}
export const packPrice = set => set.price;
export const boxPrice = set => set.price * BOX_PAYS_FOR;
export const boxUnlockAt = set => set.price * BOX_PACKS;

// What's in a pack: no item twice, the rare last, and at most one holo and one full art (they can land on the same card).
export function rollPack(set, rand = Math.random) {
  const cards = [], taken = new Set();
  for (const [r, n] of SLOTS) {
    const { items, cum } = set.pools[r];
    for (let k = 0; k < n; k++) {
      let item, guard = 0;
      do { const x = rand(); item = items[Math.min(items.length - 1, cum.findIndex(c => x <= c))] ?? items[0]; } while (taken.has(item.id) && ++guard < 200);
      taken.add(item.id);
      cards.push({ set: set.id, id: item.id, v: 0 });
    }
  }
  if (rand() < HOLO_RATE * PACK_SIZE) cards[Math.floor(rand() * PACK_SIZE)].v |= HOLO;
  if (rand() < FULL_RATE * PACK_SIZE) cards[Math.floor(rand() * PACK_SIZE)].v |= FULL;
  return cards;
}

/* ---------- money ---------- */
export function money(cents, o = {}) {
  const neg = cents < 0, c = Math.abs(Math.round(cents));
  const dollars = Math.floor(c / 100), rest = c % 100;
  const s = dollars.toLocaleString('en-US') + (o.short && rest === 0 && dollars >= 100 ? '' : '.' + String(rest).padStart(2, '0'));
  return (neg ? '−' : '') + '$' + s;
}

/* ---------- the save ---------- */
function fresh() {
  return {
    format: FORMAT, created: Date.now(), money: 0,
    packs: { [SETS[0].id]: 1 },           // the first pack is on the house
    cards: [],                            // card keys in the order they were collected
    opened: 0, boxesOpened: 0, boxUnlocked: {},
    settings: { autoSell: false, sound: true, tilt: true, sort: 'set' },
    stats: { earned: 0, spent: 0, sold: 0, donated: 0, best: null, bestValue: 0, tipAutoSell: 0 },
    seen: {},                              // item keys ("set:item") ever pulled, for the checklist
  };
}
export let S = fresh();
const owned = new Map();                   // card key → copies in the collection
const rebuild = () => { owned.clear(); for (const k of S.cards) owned.set(k, (owned.get(k) || 0) + 1); };
export const copies = key => owned.get(key) || 0;
export const ownsItem = (set, id) => { for (let v = 0; v < 4; v++) if (owned.get(`${set}:${id}:${v}`)) return true; return false; };

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('That isn’t a Booster Packs save.');
  const s = fresh();
  s.created = Number.isFinite(raw.created) ? raw.created : s.created;
  s.money = Math.max(0, Math.round(Number(raw.money) || 0));
  // Format 1 saves were priced for $250 packs: scale their money so it buys as many packs as it did.
  const old = (Number(raw.format) || 1) < 2, rescale = c => Math.round(c * 499 / 25000);
  if (old) s.money = rescale(s.money);
  s.packs = {};
  if (raw.packs && typeof raw.packs === 'object') for (const [k, n] of Object.entries(raw.packs)) if (SET_BY_ID[k] && n > 0) s.packs[k] = Math.min(9999, Math.floor(n));
  if (!Array.isArray(raw.cards)) throw new Error('That save has no collection in it.');
  s.cards = raw.cards.filter(k => typeof k === 'string' && /^[\w-]+:[\w-]+:[0-3]$/.test(k));
  s.opened = Math.max(0, Math.floor(raw.opened) || 0);
  s.boxesOpened = Math.max(0, Math.floor(raw.boxesOpened) || 0);
  s.boxUnlocked = raw.boxUnlocked && typeof raw.boxUnlocked === 'object' ? { ...raw.boxUnlocked } : {};
  s.settings = { ...s.settings, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) };
  s.settings.autoSell = !!s.settings.autoSell; s.settings.sound = s.settings.sound !== false; s.settings.tilt = s.settings.tilt !== false;
  if (!['set', 'value', 'new'].includes(s.settings.sort)) s.settings.sort = 'set';
  if (raw.stats && typeof raw.stats === 'object') for (const k of Object.keys(s.stats)) if (raw.stats[k] != null) s.stats[k] = raw.stats[k];
  if (old) { s.stats.earned = rescale(s.stats.earned || 0); s.stats.spent = rescale(s.stats.spent || 0); }
  if (s.stats.best) { const c = parseKey(s.stats.best); s.stats.bestValue = knownCard(c) ? valueOf(c) : 0; }
  s.seen = raw.seen && typeof raw.seen === 'object' ? { ...raw.seen } : {};
  for (const k of s.cards) { const c = parseKey(k); s.seen[`${c.set}:${c.id}`] = 1; }
  return s;
}

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) S = sanitize(JSON.parse(raw)); } catch (e) { console.warn('Starting a new save:', e.message); S = fresh(); }
  rebuild();
  return S;
}
let saveTimer = 0, noSave = false;
export function setNoSave(v) { noSave = v; }
export function save(now = false) {
  if (noSave) return;
  clearTimeout(saveTimer);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('Could not save:', e.message); } };
  if (now) write(); else saveTimer = setTimeout(write, 250);
}
export function reset() { S = fresh(); rebuild(); save(true); return S; }
export function replaceWith(raw) { S = sanitize(raw); rebuild(); save(true); return S; }
export function useState(s) { S = s; rebuild(); }

/* ---------- actions ---------- */
export const packsInHand = () => Object.values(S.packs).reduce((a, b) => a + b, 0);
export function takePack(setId) { if (!(S.packs[setId] > 0)) return false; S.packs[setId]--; if (!S.packs[setId]) delete S.packs[setId]; save(); return true; }
export function givePack(setId, n = 1) { S.packs[setId] = (S.packs[setId] || 0) + n; save(); }
export function canAfford(cents) { return S.money >= cents; }
export function spend(cents) { if (S.money < cents) return false; S.money -= cents; S.stats.spent += cents; save(); return true; }
export function earn(cents) { S.money += cents; S.stats.earned += cents; save(); }
export function buyPack(set) { if (!spend(packPrice(set))) return false; givePack(set.id); return true; }
export function checkBoxUnlock(set) { if (!S.boxUnlocked[set.id] && S.money >= boxUnlockAt(set)) { S.boxUnlocked[set.id] = true; save(); return true; } return false; }
export function donate(set) { S.stats.donated++; givePack(set.id); }
export const needsDonation = () => packsInHand() === 0 && SETS.every(set => S.money < packPrice(set));

// Put freshly pulled cards in the collection. Returns, for each card, whether it was new and whether it was a duplicate
// (a copy of the same card was already there — counting earlier cards in the same batch).
export function collect(cards) {
  const out = [];
  for (const c of cards) {
    const key = cardKey(c), had = copies(key) > 0, newItem = !S.seen[`${c.set}:${c.id}`];
    S.cards.push(key); owned.set(key, copies(key) + 1);
    S.seen[`${c.set}:${c.id}`] = 1;
    const value = valueOf(c);
    if (value > S.stats.bestValue) { S.stats.bestValue = value; S.stats.best = key; }
    out.push({ card: c, key, isNew: !had, newItem, dupe: had, value });
  }
  save();
  return out;
}
// Sell one copy of a card (the newest copy, or the one at a given position in S.cards).
export function sell(key, at = -1) {
  let i = at >= 0 && S.cards[at] === key ? at : S.cards.lastIndexOf(key);
  if (i < 0) return 0;
  S.cards.splice(i, 1);
  const n = copies(key) - 1; n > 0 ? owned.set(key, n) : owned.delete(key);
  const v = valueOf(parseKey(key));
  S.money += v; S.stats.earned += v; S.stats.sold++;
  save();
  return v;
}
// Every extra copy beyond the first of each exact card (same item, same variant).
export function duplicates() {
  const seen = new Set(), list = [];
  S.cards.forEach((k, i) => { if (seen.has(k)) list.push({ key: k, at: i }); else seen.add(k); });
  return list;
}
export function sellMany(list) {
  // highest positions first so earlier positions stay valid
  let total = 0;
  for (const { key, at } of [...list].sort((a, b) => b.at - a.at)) total += sell(key, at);
  return total;
}

/* ---------- the collection, for the binder ---------- */
export function sortedCollection(sort = S.settings.sort, filterSet = null) {
  const list = S.cards.map((key, at) => ({ key, at, card: parseKey(key) })).filter(e => knownCard(e.card) && (!filterSet || e.card.set === filterSet));
  const setOrder = Object.fromEntries(SETS.map((s, i) => [s.id, i]));
  for (const e of list) { e.item = itemOf(e.card); e.value = valueOf(e.card); }
  if (sort === 'value') list.sort((a, b) => b.value - a.value || a.at - b.at);
  else if (sort === 'new') list.sort((a, b) => b.at - a.at);
  else list.sort((a, b) => setOrder[a.card.set] - setOrder[b.card.set] || a.item.no - b.item.no || a.card.v - b.card.v || a.at - b.at);
  return list;
}
export function collectionStats() {
  const perSet = SETS.map(set => {
    const found = new Set(), variants = new Set();
    for (const k of owned.keys()) { const c = parseKey(k); if (c.set !== set.id || !set.itemById[c.id]) continue; found.add(c.id); variants.add(k); }
    return { set, found: found.size, total: set.items.length, variants: variants.size, totalVariants: set.items.length * 4 };
  });
  let value = 0, count = 0;
  for (const k of S.cards) { const c = parseKey(k); if (!knownCard(c)) continue; value += valueOf(c); count++; }
  return { perSet, value, count };
}

/* ---------- export and import ---------- */
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
export const exportJSON = () => JSON.stringify({ game: 'booster-packs', exported: new Date().toISOString(), ...S }, null, 1);
export async function exportCode() {
  const json = new TextEncoder().encode(JSON.stringify(S));
  if ('CompressionStream' in window) return 'BP1z.' + b64(await pipe(json, new CompressionStream('deflate-raw')));
  return 'BP1.' + b64(json);
}
export async function parseImport(text) {
  const t = String(text || '').trim();
  if (!t) throw new Error('Paste a save code or open a save file first.');
  let raw;
  if (t.startsWith('{')) raw = JSON.parse(t);
  else if (t.startsWith('BP1z.')) {
    if (!('DecompressionStream' in window)) throw new Error('This browser can’t read compressed codes. Try the save file instead.');
    raw = JSON.parse(new TextDecoder().decode(await pipe(unb64(t.slice(5)), new DecompressionStream('deflate-raw'))));
  } else if (t.startsWith('BP1.')) raw = JSON.parse(new TextDecoder().decode(unb64(t.slice(4))));
  else throw new Error('That doesn’t look like a Booster Packs save code.');
  return sanitize(raw);
}
