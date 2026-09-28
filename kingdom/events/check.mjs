// Checks event files: every field and id is one the game knows, text fits the page, and the two sides of each choice
// are close enough in worth (worth.js) that neither is obviously right. Prints a line per event.
//
//   node kingdom/events/check.mjs kingdom/events/wilds.js [more files…]    (no files: every file in this folder)
//   add --quiet to print only problems
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { TILES, FOES, RELICS, TRAITS, ALLIES, ITEMS, BIOMES, REALMS, VIRTUES } from '../rules.js';
import { optionWorth, TYPICAL } from '../worth.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const QUIET = process.argv.includes('--quiet');
const files = args.length ? args.map(a => resolve(a)) : readdirSync(here).filter(f => f.endsWith('.js') && f !== 'index.js').map(f => join(here, f));

const OUT_KEYS = new Set(['w', 'text', 'gold', 'pay', 'food', 'hp', 'maxhp', 'renown', 'claim', 'sight', 'item', 'relic', 'trait', 'lift', 'ally', 'flag', 'unflag', 'fight', 'die', 'crown', 'path', 'virtue', 'treasury', 'heir', 'after']);
const OPT_KEYS = new Set(['label', 'tile', 'cost', 'poor', 'fight', 'shop', 'out', 'odds', 'win', 'lose', 'path', 'needs']);
const EVENT_KEYS = new Set(['id', 'tier', 'realm', 'biome', 'needs', 'unless', 'hasTrait', 'w', 'title', 'text', 'left', 'right', 'stage', 'path', 'final']);
const SHOPS = new Set(['market', 'smith', 'temple', 'witch', 'fence']);
const LIMIT = { title: 34, text: 280, label: 32, out: 220 };

let problems = 0, total = 0;
const seen = new Map(), flagsSet = new Map(), flagsNeeded = new Map();
const tierCount = { 1: 0, 2: 0, 3: 0 };
const say = s => console.log(s);

function checkOutcome(o, where, err) {
  if (!o || typeof o !== 'object') return err(`${where}: missing outcome`);
  for (const k of Object.keys(o)) if (!OUT_KEYS.has(k)) err(`${where}: unknown key "${k}"`);
  if (typeof o.text !== 'string' || !o.text) err(`${where}: no text`);
  else if (o.text.length > LIMIT.out) err(`${where}: text is ${o.text.length} chars (max ${LIMIT.out})`);
  for (const k of ['gold', 'pay', 'food', 'hp', 'maxhp', 'renown', 'claim', 'sight']) if (k in o && !Number.isInteger(o[k])) err(`${where}: ${k} should be a whole number`);
  if (o.pay != null && o.pay <= 0) err(`${where}: pay should be positive (it's a demand you must meet)`);
  if (o.item && !ITEMS[o.item]) err(`${where}: unknown item "${o.item}"`);
  if (o.relic && !RELICS[o.relic] && o.relic !== 'random' && o.relic !== 'rare') err(`${where}: unknown relic "${o.relic}"`);
  if (o.trait && !TRAITS[o.trait]) err(`${where}: unknown trait "${o.trait}"`);
  if (o.lift && o.lift !== true && !TRAITS[o.lift]) err(`${where}: lift should be true or a trait id`);
  if (o.ally && !ALLIES[o.ally]) err(`${where}: unknown ally "${o.ally}"`);
  if (o.flag) { if (!flagsSet.has(o.flag)) flagsSet.set(o.flag, where); }
  if (o.fight) checkFight(o.fight, where + '.fight', err);
  for (const v of [].concat(o.virtue ?? [])) if (!VIRTUES[v]) err(`${where}: unknown virtue "${v}"`);
  if (o.treasury != null && !Number.isInteger(o.treasury)) err(`${where}: treasury should be a whole number`);
  if (o.heir) for (const [k, v] of Object.entries(o.heir)) {
    if (k === 'ally' ? !ALLIES[v] : !['renown', 'gold'].includes(k) || !Number.isInteger(v)) err(`${where}: heir.${k} should be an ally id, or renown / gold as a whole number`);
  }
  if (o.after) for (const [k, v] of Object.entries(o.after)) if (!REALMS[k] || !Number.isInteger(v)) err(`${where}: after.${k} should be a realm with a whole-number weight`);
}
function checkFight(f, where, err) {
  if (!FOES[f.foe]) err(`${where}: unknown foe "${f.foe}"`);
  if (typeof f.name !== 'string' || !f.name) err(`${where}: no name`);
  if (!Number.isInteger(f.power) || f.power < 1 || f.power > 20) err(`${where}: power should be 1-20`);
  if (f.dmg != null && (!Number.isInteger(f.dmg) || f.dmg < 0 || f.dmg > 6)) err(`${where}: dmg should be 0-6`);
  for (const k of Object.keys(f)) if (!['foe', 'name', 'power', 'dmg', 'elite', 'win', 'lose'].includes(k)) err(`${where}: unknown key "${k}"`);
  checkOutcome(f.win, where + '.win', err); checkOutcome(f.lose, where + '.lose', err);
}
function checkOption(opt, where, err, succession) {
  if (!opt || typeof opt !== 'object') return err(`${where}: missing`);
  for (const k of Object.keys(opt)) if (!OPT_KEYS.has(k)) err(`${where}: unknown key "${k}"`);
  if (typeof opt.label !== 'string' || !opt.label) err(`${where}: no label`);
  else if (opt.label.length > LIMIT.label) err(`${where}: label is ${opt.label.length} chars (max ${LIMIT.label})`);
  if (!TILES.includes(opt.tile)) err(`${where}: unknown tile "${opt.tile}"`);
  if (opt.tile === 'throne') err(`${where}: the throne room is only ever where a crowned heir's road ends; pick another tile`);
  const kinds = ['fight', 'out', 'odds'].filter(k => opt[k]);
  if (kinds.length !== 1) err(`${where}: needs exactly one of fight / out / odds (has ${kinds.join(', ') || 'none'})`);
  if (opt.cost != null && (!Number.isInteger(opt.cost) || opt.cost <= 0)) err(`${where}: cost should be a positive whole number`);
  if (opt.poor) checkOutcome(opt.poor, where + '.poor', err);
  if (opt.shop && !SHOPS.has(opt.shop)) err(`${where}: unknown shop "${opt.shop}"`);
  if (opt.shop && !opt.out) err(`${where}: a shop option needs an out with the arrival text`);
  if (opt.fight) checkFight(opt.fight, where + '.fight', err);
  if (opt.out) {
    if (!Array.isArray(opt.out) || !opt.out.length) err(`${where}: out should be a non-empty array`);
    else opt.out.forEach((o, i) => checkOutcome(o, `${where}.out[${i}]`, err));
  }
  if (opt.odds) {
    if (!succession) err(`${where}: odds are only for succession choices`);
    checkOutcome(opt.win, where + '.win', err); checkOutcome(opt.lose, where + '.lose', err);
  }
}

for (const file of files) {
  let list;
  try { list = (await import(pathToFileURL(file).href)).default; } catch (e) { console.log(`✗ ${file}: can't load: ${e.message}`); problems++; continue; }
  if (!Array.isArray(list)) { console.log(`✗ ${file}: default export should be an array`); problems++; continue; }
  const name = file.split('/').pop();
  if (!QUIET) say(`\n== ${name}: ${list.length} events`);
  for (const ev of list) {
    total++;
    const errs = [], err = m => errs.push(m);
    const id = ev?.id || '(no id)';
    for (const k of Object.keys(ev || {})) if (!EVENT_KEYS.has(k)) err(`unknown key "${k}"`);
    if (!/^[a-z][a-z0-9_]*$/.test(id)) err('id should be snake_case');
    if (seen.has(id)) err(`duplicate id (also in ${seen.get(id)})`); else seen.set(id, name);
    const succession = ev.stage != null;
    const tiers = [].concat(ev.tier ?? []);
    if (!succession && (!tiers.length || tiers.some(t => ![1, 2, 3].includes(t)))) err('tier should be 1, 2, 3 or a list of them');
    for (const t of tiers) tierCount[t] = (tierCount[t] || 0) + 1 / tiers.length;
    if (ev.realm && !REALMS[ev.realm]) err(`unknown realm "${ev.realm}"`);
    for (const b of [].concat(ev.biome ?? [])) if (!BIOMES.includes(b)) err(`unknown biome "${b}"`);
    if (ev.needs) flagsNeeded.set(ev.needs, id);
    if (ev.hasTrait && !TRAITS[ev.hasTrait]) err(`unknown trait "${ev.hasTrait}" in hasTrait`);
    if (typeof ev.title !== 'string' || !ev.title) err('no title'); else if (ev.title.length > LIMIT.title) err(`title is ${ev.title.length} chars (max ${LIMIT.title})`);
    if (typeof ev.text !== 'string' || !ev.text) err('no text'); else if (ev.text.length > LIMIT.text) err(`text is ${ev.text.length} chars (max ${LIMIT.text})`);
    checkOption(ev.left, 'left', err, succession); checkOption(ev.right, 'right', err, succession);
    // Worth of each side for a typical character at this tier.
    let line = '';
    if (!errs.length) {
      const t = succession ? 3 : tiers[0];
      const s = { ...TYPICAL[t], realm: ev.realm || 'old', traits: new Set(), relics: new Set(), allies: new Set(), claim: 3 };
      const L = optionWorth(ev.left, s), R = optionWorth(ev.right, s), gap = Math.abs(L - R);
      const flags = [];
      if (gap > 30) flags.push('lopsided');
      if (Math.max(L, R) < -12) flags.push('both harsh');
      if (Math.min(L, R) > 40) flags.push('both generous');
      line = `L ${L.toFixed(0).padStart(4)}  R ${R.toFixed(0).padStart(4)}  ${flags.join(' ')}`;
      if (flags.length && QUIET) say(`  ? ${id.padEnd(26)} ${line}`);
    }
    if (errs.length) { problems += errs.length; say(`  ✗ ${id}: ${errs.join('; ')}`); }
    else if (!QUIET) say(`  ✓ ${id.padEnd(26)} t${tiers.join('')}${ev.realm ? ' ' + ev.realm : ''}  ${line}`);
  }
}
for (const [flag, id] of flagsNeeded) if (!flagsSet.has(flag)) { problems++; say(`  ✗ ${id} needs flag "${flag}", which nothing sets`); }
say(`\n${total} events, ${problems} problem${problems === 1 ? '' : 's'}. By tier: ${Object.entries(tierCount).map(([t, n]) => `${t}: ${Math.round(n)}`).join(', ')}`);
process.exitCode = problems ? 1 : 0;
