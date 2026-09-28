// Headless balance runs: many lives played by the stand-in player (autoplay.js), with no page, printing how often a
// life ends on the throne and how the rest end. For tuning rules.js and the events.
//
//   node kingdom/balance.mjs                            → skills 0, .35, .55 and .8, no bloodline powers, every realm
//   node kingdom/balance.mjs --lives 4000 --legacy full --realm chaos
//   node kingdom/balance.mjs --dynasty 60 --houses 40   (whole houses: lives in a row, spending what each leaves)
//   node kingdom/balance.mjs --events                    (which events are chosen, and how each side turns out)
import { newHouse, beginLife, endLife, inheritanceOf } from './dynasty.js';
import { makePlayer, playLife, spendVault } from './autoplay.js';
import { rng } from './util.js';
import { LEGACY } from './rules.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const LIVES = +arg('lives', 3000);
const SKILLS = String(arg('skills', arg('skill', '0,.35,.55,.8'))).split(',').map(Number);
const LEG = arg('legacy', 'none');
const REALM = arg('realm', 'mix');
const pct = (n, d) => (100 * n / Math.max(1, d)).toFixed(1).padStart(5) + '%';

const LEGACIES = {
  none: {},
  some: { blade: 1, larder: 1, coffers: 1, seer: 1 },
  full: Object.fromEntries(LEGACY.map(l => [l.id, l.costs.length])),
};

function oneLife(k, skill, realmType, legacy) {
  const house = newHouse(1000 + k * 7919);
  if (realmType !== 'mix') {
    house.realm = { ...house.realm, type: realmType };
    if (realmType === 'chaos') { house.realm.ruler = null; house.realm.warlords = ['the Red Duke', 'the Iron Baron', 'Lady Hesk']; }
    else if (!house.realm.ruler) house.realm.ruler = { sex: 'm', title: 'King', name: 'Aldric', epithet: 'the Old', full: 'King Aldric the Old' };
    if (realmType === 'old') house.realm.rival = house.realm.rival || 'Duke Ormond';
  } else {
    const types = ['old', 'tyrant', 'chaos'];
    const t = types[k % 3];
    house.realm = { ...house.realm, type: t, ruler: t === 'chaos' ? null : { sex: 'f', title: 'Queen', name: 'Morwen', epithet: 'the Cruel', full: 'Queen Morwen the Cruel' },
      rival: 'Duke Ormond', warlords: ['the Red Duke', 'the Iron Baron', 'Lady Hesk'] };
  }
  house.legacy = { ...legacy };
  const life = beginLife(house);
  playLife(life, makePlayer(skill, rng(k * 13 + 1)));
  return life;
}

function report(label, lives) {
  const n = lives.length, by = {};
  let reached = 0, steps = 0, inh = 0, relics = 0, fights = 0, won = 0, gold = 0, claimAt = 0, claimN = 0;
  for (const l of lives) {
    const k = l.fate.kind; by[k] = (by[k] || 0) + 1;
    if (l.row >= 12 && (l.phase === 'succession' || k === 'crowned' || k === 'lost')) { reached++; claimAt += l.startClaim || 0; claimN++; }
    steps += l.step; inh += inheritanceOf(l); relics += l.relics.length; fights += l.stats.fights; won += l.stats.won; gold += l.stats.goldFound;
  }
  const crowned = by.crowned || 0;
  console.log(`${label.padEnd(26)} crowned ${pct(crowned, n)}  reached ${pct(reached, n)} (won ${pct(crowned, reached)} of those, claim ${(claimAt / Math.max(1, claimN)).toFixed(1)})  ` +
    `killed ${pct(by.killed || 0, n)} starved ${pct(by.starved || 0, n)} broke ${pct(by.broke || 0, n)} reaper ${pct(by.reaper || 0, n)} lost ${pct(by.lost || 0, n)}  ` +
    `steps ${(steps / n).toFixed(1)}  leaves ${(inh / n).toFixed(0)}g  relics ${(relics / n).toFixed(1)}  fights ${(fights / n).toFixed(1)} (won ${pct(won, fights)})  gold found ${(gold / n).toFixed(0)}`);
}

if (process.argv.includes('--dynasty')) {
  const G = +arg('dynasty', 40), H = +arg('houses', 30), skill = +arg('skill', .55);
  const windows = {};
  const W = 10;
  let full = 0, fullAt = 0;
  for (let h = 0; h < H; h++) {
    const house = newHouse(5000 + h * 104729);
    const player = makePlayer(skill, rng(h * 17 + 5));
    let reachedFull = false;
    for (let g = 0; g < G; g++) {
      const life = beginLife(house);
      playLife(life, player);
      endLife(house, life);
      spendVault(house);
      const w = Math.floor(g / W);
      windows[w] = windows[w] || { n: 0, c: 0, legacy: 0 };
      windows[w].n++; if (life.fate.kind === 'crowned') windows[w].c++;
      windows[w].legacy += Object.values(house.legacy).reduce((a, b) => a + b, 0);
      if (!reachedFull && LEGACY.every(l => (house.legacy[l.id] || 0) >= l.costs.length)) { reachedFull = true; full++; fullAt += g + 1; }
    }
  }
  const maxLv = LEGACY.reduce((a, l) => a + l.costs.length, 0);
  console.log(`${H} houses × ${G} generations, skill ${skill}`);
  for (const [w, d] of Object.entries(windows)) console.log(`  gens ${String(w * W + 1).padStart(3)}-${String((+w + 1) * W).padEnd(3)} crowned ${pct(d.c, d.n)}   bloodline ${(d.legacy / d.n).toFixed(1)}/${maxLv} levels`);
  console.log(`  every power bought: ${full}/${H} houses${full ? `, after ${(fullAt / full).toFixed(0)} generations on average` : ''}`);
} else if (process.argv.includes('--events')) {
  const stats = {};
  for (let k = 0; k < LIVES; k++) {
    const life = oneLife(k, .55, REALM, LEGACIES[LEG] || {});
    for (const l of life.log) { const s = stats[l.id] = stats[l.id] || { n: 0, fx: 0 }; s.n++; }
  }
  const rows = Object.entries(stats).sort((a, b) => b[1].n - a[1].n);
  for (const [id, s] of rows) console.log(`${id.padEnd(28)} ${String(s.n).padStart(5)}`);
} else {
  console.log(`${LIVES} lives each, bloodline: ${LEG}, realm: ${REALM}`);
  for (const skill of SKILLS) {
    const lives = [];
    for (let k = 0; k < LIVES; k++) lives.push(oneLife(k, skill, REALM, LEGACIES[LEG] || {}));
    report(`skill ${skill}`, lives);
  }
}
