// The house: the kingdom it lives in, its name and coat of arms, the gold its lives have left behind, the bloodline
// powers bought with that gold, the graves of those who fell on the road and the throne rooms of those who were
// crowned, what a crowned parent left the next heir, and the chronicle of every life (the Tome).
// Each life starts here (beginLife) and hands back here when it ends (endLife): the heir inherits the purse, the
// realm moves on a generation, and the next heir sets out from the crossroads.
import { LEGACY_BY_ID, DEEDS_PER_STEP, ROYAL_TREASURY, PURSE_SHARE, AFTER_REIGN } from './rules.js';
import { rng, randomSeed } from './util.js';
import { makeKingdom, makeHeir, makeRuler, pickRival, pickWarlords, epithetFor } from './names.js';
import { makeWorld } from './world.js';
import { Life } from './game.js';

const WORLDS = new Map();
export const worldOf = house => { if (!WORLDS.has(house.seed)) WORLDS.set(house.seed, makeWorld(house.seed)); return WORLDS.get(house.seed); };
const biomes = house => { const w = worldOf(house); return (row, col) => w.at(row, col)?.biome ?? null; };
const houseRand = (house, salt) => rng((house.seed ^ Math.imul(house.gen + 1, 2654435761) ^ salt) >>> 0);

export function newHouse(seed = randomSeed()) {
  const r = rng(seed);
  const names = makeKingdom(r);
  const house = { v: 1, seed, names, vault: 0, legacy: {}, gen: 1, lineage: [], crowns: 0, graves: [], thrones: [], gifts: null, heir: makeHeir(r, null), realm: null };
  house.realm = drawRealm(r, house, null);
  return house;
}

// The state of the kingdom for the next life, given how the last one went.
function drawRealm(r, house, prev) {
  let type, ruler = null, since = house.gen, story = '';
  const last = house.lineage[house.lineage.length - 1];
  if (!prev) type = 'old';
  else if (last?.crowned) {
    const w = { ...AFTER_REIGN };
    for (const [k, v] of Object.entries(last.afterRealm || {})) w[k] = Math.max(0, (w[k] || 0) + v);
    type = r.weighted(Object.entries(w).filter(([, v]) => v > 0));
    story = type === 'tyrant' ? 'usurped' : type === 'chaos' ? 'civil war' : 'peace';
  } else if (prev.type === 'tyrant' && r.chance(.45)) { type = 'tyrant'; ruler = prev.ruler; since = prev.since; story = 'still'; }
  else type = r.weighted([['old', 34], ['tyrant', 36], ['chaos', 30]]);
  if (!ruler && type !== 'chaos') {
    ruler = makeRuler(r, type);
    if (story === 'usurped') { ruler.epithet = 'the Usurper'; ruler.full = `${ruler.title} ${ruler.name} the Usurper`; }
  }
  return { type, ruler, since, story, rival: type === 'old' ? pickRival(r) : null, warlords: type === 'chaos' ? pickWarlords(r) : null };
}

export function beginLife(house) {
  return new Life({ seed: (house.seed * 31 + house.gen * 7919) >>> 0, gen: house.gen, heir: house.heir, realm: house.realm, names: house.names,
    legacy: { ...house.legacy }, gifts: house.gifts, biomeAt: biomes(house) });
}
export function resumeLife(house, saved) { house.thrones ??= []; return new Life({ biomeAt: biomes(house) }, saved); }

// What the heir inherits: half the purse (nothing, if creditors emptied it), something for every step of the road,
// and, if the crown was won, the royal treasury, fuller or thinner for what was done on the way to the throne.
export function inheritanceOf(life) {
  const f = life.fate;
  return (f.kind === 'broke' ? 0 : Math.round(Math.max(0, life.gold) * PURSE_SHARE)) + DEEDS_PER_STEP * life.step
    + (f.kind === 'crowned' ? Math.max(60, ROYAL_TREASURY + (life.treasury || 0)) : 0);
}
// How long a reign lasts: chance, lengthened by the people's love and good government, shortened by the sword.
function reignOf(r, v = {}) {
  const k = 2 * (v.love || 0) + 2 * (v.justice || 0) + (v.mercy || 0) + (v.piety || 0) - 2 * (v.might || 0);
  return Math.max(4, Math.min(52, r.int(10, 34) + k * 2));
}

export function endLife(house, life) {
  const r = houseRand(house, 0x7e11);
  const f = life.fate, crowned = f.kind === 'crowned';
  const epithet = epithetFor(life, r);
  const inheritance = inheritanceOf(life);
  const entry = {
    gen: house.gen, name: life.heir.name, sex: life.heir.sex, look: life.heir.look, royal: !!life.heir.royal, epithet,
    realm: { type: house.realm.type, ruler: house.realm.ruler?.full || null, story: house.realm.story, rival: house.realm.rival, warlords: house.realm.warlords },
    age: life.heir.age, fate: { ...f }, crowned, reign: crowned ? reignOf(r, life.virtues) : 0, sp: life.sp,
    virtues: { ...(life.virtues || {}) }, gifts: crowned ? life.gifts : null, afterRealm: crowned ? { ...(life.afterRealm || {}) } : null,
    path: life.path.join(''), steps: life.step, renown: life.renown, gold: life.gold, inheritance,
    relics: life.relics.map(x => x.id), traits: life.traits.slice(), allies: life.allies.slice(),
    weapon: life.weapon, armor: life.armor, won: life.stats.won, fights: life.stats.fights,
    log: life.log.map(l => ({ row: l.row, title: l.title, label: l.label, text: l.text, intro: l.intro, fight: l.fight,
      fx: l.fx.filter(x => ['relic', 'trait', 'ally', 'item', 'lift', 'virtue'].includes(x.k)).map(x => ({ k: x.k, id: x.id, sold: x.sold ? 1 : 0 })) })),
  };
  house.lineage.push(entry);
  house.vault += inheritance;
  if (crowned) { house.crowns++; (house.thrones = house.thrones || []).push({ row: f.row, col: f.col, name: `${entry.name} ${epithet}`, gen: house.gen }); }
  else house.graves.push({ row: f.row, col: f.col, name: `${entry.name} ${epithet}`, gen: house.gen });
  house.gifts = crowned ? life.gifts : null;
  const prev = house.realm;
  house.gen++;
  house.heir = makeHeir(r, life.heir);
  if (crowned) house.heir.royal = true;
  house.realm = drawRealm(r, house, prev);
  return entry;
}

export function legacyLevel(house, id) { return house.legacy[id] || 0; }
export function legacyCost(house, id) { const L = LEGACY_BY_ID[id]; const lvl = legacyLevel(house, id); return lvl < L.costs.length ? L.costs[lvl] : null; }
export function buyLegacy(house, id) {
  const cost = legacyCost(house, id);
  if (cost == null || house.vault < cost) return false;
  house.vault -= cost;
  house.legacy[id] = legacyLevel(house, id) + 1;
  return true;
}
