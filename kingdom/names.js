// Names: for the kingdom and its royal city, the house your line belongs to (and its coat of arms), each heir, the
// rulers and rivals of each age, and the name a life earns by the way it ends.
import { VIRTUES } from './rules.js';

export const NAMES = {
  m: ['Aldric', 'Edric', 'Osric', 'Wulfric', 'Godric', 'Alaric', 'Cedric', 'Leofric', 'Hugh', 'Roland', 'Tristan', 'Gawain', 'Percival',
    'Bertram', 'Oswin', 'Eadric', 'Wystan', 'Tobias', 'Anselm', 'Benedict', 'Corwin', 'Dunstan', 'Emrys', 'Fenwick', 'Garrick', 'Hadrian',
    'Ivo', 'Jasper', 'Kenric', 'Lucan', 'Merric', 'Orrin', 'Piers', 'Quentin', 'Rowan', 'Simon', 'Thaddeus', 'Ulric', 'Valen', 'Warrick',
    'Yorick', 'Aldous', 'Bede', 'Cuthbert', 'Drogo', 'Ewan', 'Faramund', 'Gilbert', 'Hamon', 'Idris', 'Jory', 'Lambert', 'Matthias', 'Ned',
    'Odo', 'Ranulf', 'Stephen', 'Tancred', 'Walter', 'Wat'],
  f: ['Isolde', 'Elaine', 'Gwendolyn', 'Rowena', 'Matilda', 'Edith', 'Aveline', 'Brynn', 'Cressida', 'Elspeth', 'Guinevere', 'Hildegard',
    'Ingrid', 'Juliana', 'Katrin', 'Lunet', 'Nimue', 'Odette', 'Philippa', 'Rosalind', 'Sabine', 'Talia', 'Ursula', 'Vivienne', 'Wynne',
    'Aldith', 'Beatrix', 'Cecily', 'Elowen', 'Maud', 'Agnes', 'Alys', 'Emmeline', 'Seraphina', 'Adela', 'Blanche', 'Clemence', 'Dervla',
    'Eluned', 'Fern', 'Gisela', 'Hawise', 'Ida', 'Joan', 'Leofrun', 'Mabel', 'Nest', 'Orabel', 'Petronel', 'Rohese', 'Sibyl', 'Tamsin',
    'Wenna', 'Yseult', 'Avice', 'Bronwen', 'Ermina', 'Godiva', 'Linnet', 'Morwenna'],
};
const HOUSES = ['Wren', 'Ashford', 'Thornwood', 'Blackmere', 'Greymantle', 'Oakheart', 'Falconer', 'Hollowell', 'Stormcrow', 'Marrow',
  'Brightwater', 'Fenwick', 'Harrowgate', 'Ravensworth', 'Dunmore', 'Whitlock', 'Coldbrook', 'Ironside', 'Larkspur', 'Mossgrave', 'Quillon',
  'Redthorn', 'Sallow', 'Tarrant', 'Underhill', 'Vane', 'Wyvernhall', 'Ember', 'Holloway', 'Lindqvist', 'Merriwether', 'Nettlebed'];
const K1 = ['Ald', 'Ever', 'Varr', 'Thorn', 'Wyv', 'Dusk', 'Bright', 'Elder', 'Glen', 'Ash', 'Mor', 'Hollow', 'Raven', 'Stone', 'Gold',
  'Silver', 'Frost', 'Wind', 'Lark', 'Summer', 'Oak', 'Harrow', 'Myr', 'Eld', 'Caer', 'Dun', 'Gal', 'Tam'];
const K2 = ['mere', 'hollow', 'dale', 'mark', 'hold', 'moor', 'water', 'reach', 'fell', 'march', 'shire', 'wood', 'haven', 'vale', 'gard',
  'wyn', 'lond', 'ria', 'mor', 'weald'];
const C1 = ['King’s', 'Crown', 'High', 'Royal', 'Stag', 'Sun', 'Swan', 'Lion', 'Eagle', 'White', 'Gold', 'Queen’s'];
const C2 = ['holm', 'hold', 'gate', 'bury', 'mont', 'haven', 'minster', 'spire', 'bridge', 'ford'];
const OLD_EP = ['the Old', 'the Grey', 'the Venerable', 'the Weary', 'the Last', 'the Kind', 'the Long-Lived', 'the Patient'];
const TYRANT_EP = ['the Cruel', 'the Black', 'the Red', 'the Hangman', 'the Iron-Fisted', 'the Usurper', 'the Mad', 'the Grim', 'the Wolf',
  'the Poisoner', 'the Pitiless'];
const RULER = { m: ['Morcant', 'Eadwig', 'Sigeric', 'Isembard', 'Grimbald', 'Hrothmar', 'Ulfgar', 'Aldhelm', 'Cenred', 'Osgar', 'Maelgwn', 'Theobald', 'Wigmund', 'Radulf'],
  f: ['Morwen', 'Ravenna', 'Ermengarde', 'Hildith', 'Aethra', 'Sunniva', 'Wulfrun', 'Brangwen', 'Ysmay', 'Gundrada', 'Melisende', 'Orabilis'] };
const DUKES = ['Duke Ormond of Harrowgate', 'Duchess Aveline of the Tarns', 'Lord Seward of Coldbrook', 'Lady Hesk of the Marches',
  'Duke Radulf the Fair', 'Countess Ysolde of Ember Vale', 'Lord Castellan Brand', 'Duke Aldo of the Seven Bridges'];
const WARLORDS = ['the Red Duke', 'the Iron Baron', 'Lady Hesk of the Marches', 'the Hound of Dunmore', 'Black Aldo', 'the Widow of Coldbrook',
  'the Boy-Earl', 'Grimbold Half-Hand', 'the Lady of Crows', 'the Salt King'];

// Tinctures for coats of arms: metals and colours (a metal never sits on a metal, a colour never on a colour).
export const METALS = { or: '#f2c24c', argent: '#e9e6dc' };
export const COLOURS = { gules: '#b8322f', azure: '#2f55a8', vert: '#2f7d47', sable: '#27242a', purpure: '#6d3a8f', tenne: '#b0642a' };
const DIVISIONS = ['plain', 'plain', 'pale', 'fess', 'bend', 'quarterly', 'chevron', 'chief', 'saltire', 'bordure'];
export const CHARGES = ['lion', 'eagle', 'stag', 'tower', 'rose', 'star', 'moon', 'key', 'sword', 'boar', 'fish', 'wolf', 'tree', 'bell', 'wren', 'crown'];

export function makeKingdom(r) {
  const kingdom = r.pick(K1) + r.pick(K2);
  const c1 = r.pick(C1), c2 = r.pick(C2);
  const capital = c1.endsWith('’s') ? `${c1} ${c2[0].toUpperCase()}${c2.slice(1)}` : c1 + c2;   // King’s Haven, but Crownhold
  const house = r.pick(HOUSES);
  return { kingdom, capital, house, arms: makeArms(r) };
}

export function makeArms(r) {
  const metal = r.pick(Object.keys(METALS)), colour = r.pick(Object.keys(COLOURS)), colour2 = r.pick(Object.keys(COLOURS).filter(c => c !== colour));
  const metalField = r.chance(.4);
  return {
    field: metalField ? metal : colour,
    second: metalField ? colour : (r.chance(.5) ? metal : colour2),
    division: r.pick(DIVISIONS),
    charge: r.pick(CHARGES),
    tincture: metalField ? colour2 : metal,   // the charge stands out against the field
  };
}

export function makeHeir(r, parent) {
  const sex = r.chance(.5) ? 'm' : 'f';
  const avoid = new Set(parent ? [parent.name] : []);
  let name;
  do name = r.pick(NAMES[sex]); while (avoid.has(name));
  const skins = ['#f1d0b0', '#e0b48e', '#c68d64', '#9a6644', '#6e4630'];
  const hairs = ['#2a1c14', '#4a2f1e', '#7a4a26', '#a8552a', '#d9a65a', '#e8d49a', '#3a3a3a'];
  const look = parent?.look ? {
    skin: r.chance(.8) ? parent.look.skin : r.pick(skins),
    hair: r.chance(.6) ? parent.look.hair : r.pick(hairs),
    style: hairFor(r, sex),
  } : { skin: r.pick(skins), hair: r.pick(hairs), style: hairFor(r, sex) };
  return { name, sex, look, age: r.int(16, 19) };
}

// Hair: 0 short, 1 long, 2 tied back, 3 long and loose. Most sons wear it short, most daughters long.
const hairFor = (r, sex) => sex === 'f' ? r.pick([1, 1, 3, 3, 2, 0]) : r.pick([0, 0, 2, 2, 1, 3]);

export function makeRuler(r, type) {
  const sex = r.chance(.5) ? 'm' : 'f';
  const title = sex === 'm' ? 'King' : 'Queen';
  const name = r.pick(RULER[sex]);
  const ep = type === 'old' ? r.pick(OLD_EP) : r.pick(TYRANT_EP);
  return { sex, title, name, epithet: ep, full: `${title} ${name} ${ep}` };
}
export const pickRival = r => r.pick(DUKES);
export const pickWarlords = r => r.shuffle(WARLORDS.slice()).slice(0, 3);

export const title = (sex, kind) => ({
  ruler: sex === 'f' ? 'Queen' : 'King', child: sex === 'f' ? 'daughter' : 'son', knight: sex === 'f' ? 'Dame' : 'Sir',
  royal: sex === 'f' ? 'Princess' : 'Prince', sir: sex === 'f' ? 'my lady' : 'sir', lad: sex === 'f' ? 'lass' : 'lad',
})[kind];

// The name a life earns. Checked in order; the first that fits wins.
export function epithetFor(life, r) {
  const f = life.fate || {}, st = life.stats || {};
  if (f.kind === 'crowned') {
    // named for the virtue shown most on the way to the throne (a tie goes to how the crown was won)
    const v = Object.entries(life.virtues || {}).sort((a, b) => b[1] - a[1]);
    if (v.length && (v.length === 1 || v[0][1] > v[1][1])) return VIRTUES[v[0][0]].epithet;
    if (life.sp === 'rebellion') return 'the Liberator';
    if (life.sp === 'blade' || st.won >= 6) return 'the Conqueror';
    if (v.length) return VIRTUES[r.pick(v.filter(x => x[1] === v[0][1]))[0]].epithet;
    return r.pick(['the Great', 'the Wise', 'the Bold', 'the Fair']);
  }
  if (f.kind === 'starved') return r.pick(['the Hungry', 'the Lean', 'the Hollow']);
  if (f.kind === 'broke') return r.pick(['the Penniless', 'the Debtor', 'Empty-Purse']);
  if (life.traits?.includes('toad')) return 'the Toad';
  if (f.kind === 'reaper') return 'the Doomed';
  if (st.dragon) return 'Dragonsbane';
  if (f.kind === 'lost') return r.pick(['the Pretender', 'the Almost-King', 'the Uncrowned']);
  if (life.traits?.some(t => ['twin_step', 'veil', 'wendigo', 'ill_luck', 'glass_bones', 'weathervane', 'leaden_purse'].includes(t))) return r.pick(['the Hexed', 'the Accursed']);
  if (st.won >= 4) return r.pick(['the Bold', 'the Brave', 'the Fierce']);
  if (life.relics?.length >= 4) return 'the Seeker';
  if (life.step <= 3) return r.pick(['the Unlucky', 'the Brief', 'the Short-Lived']);
  if (life.renown >= 8) return 'the Renowned';
  return r.pick(['the Wanderer', 'the Steadfast', 'the Unlucky', 'the Quiet', 'the Hopeful', 'the Luckless']);
}
