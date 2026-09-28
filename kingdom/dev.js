// A sprite sheet for working on the art: every ground, feature, structure and figure at a readable size.
// Open kingdom/dev.html (it isn't linked from anywhere). ?s=4 sets the scale.
import { landSprite, fogSprite, SPRITE } from './terrain.js';

const S = +(new URLSearchParams(location.search).get('s') || 3);
const out = document.getElementById('out');
function sheet(title, sprites, cols = 12) {
  const h2 = document.createElement('h2'); h2.textContent = title; out.append(h2);
  const rows = Math.ceil(sprites.length / cols);
  const c = document.createElement('canvas');
  c.width = cols * (SPRITE.w + 8) * S; c.height = rows * (SPRITE.h + 14) * S;
  c.style.width = c.width + 'px';
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.font = `${10 * S / 3 * 1.2}px system-ui`; g.fillStyle = '#aaa';
  sprites.forEach(([name, px], i) => {
    const x = (i % cols) * (SPRITE.w + 8) * S, y = Math.floor(i / cols) * (SPRITE.h + 14) * S;
    g.drawImage(px.canvas(), x, y, px.w * S, px.h * S);
    g.fillText(name, x + 2, y + (SPRITE.h + 10) * S);
  });
  out.append(c);
}
const feats = { farm: ['', 'field', 'tree', 'cottage', 'hedge'], wood: ['trees', 'tree', ''], fen: ['pool', 'reeds', 'deadtree', ''], hills: ['rocks', 'peak', 'tree', ''],
  moor: ['heather', 'stone', 'rocks'], lake: ['water', 'reeds', 'tree'], waste: ['ash', 'stump', 'bones', 'crack', 'peak'], snow: ['pines', 'rocks', 'peak', ''],
  crown: ['flowers', 'hedge', 'tree', 'statue', 'field', 'orchard', 'manor', 'avenue'], city: ['house', 'tower', 'plaza', 'fountain', 'cathedral', 'wall', 'walltower', 'hall', 'keep', 'garden'] };
const land = [];
let k = 0;
for (const [biome, fs] of Object.entries(feats)) for (const feat of fs) for (const h of biome === 'hills' || biome === 'snow' ? [0, 1] : [0]) {
  k++;
  land.push([`${biome} ${feat}${h ? ' h' + h : ''}`, landSprite({ biome, feat, h, gx: k, gy: k * 3, v: .5, v2: (k * .37) % 1, row: biome === 'city' ? 20 : 5 }, 1)]);
}
land.push(['crossroads', landSprite({ biome: 'farm', feat: 'crossroads', h: 0, gx: 0, gy: 0, v: .5, v2: .5, row: 0 }, 1)]);
for (let i = 0; i < 4; i++) land.push(['fog ' + i, fogSprite(i)]);
land.push(['path', landSprite({ biome: 'farm', feat: '', h: 0, gx: 3, gy: 3, v: .5, v2: .5, row: 3 }, 1, { in: 'L', out: 'R' })]);
land.push(['grey', landSprite({ biome: 'wood', feat: 'trees', h: 0, gx: 3, gy: 3, v: .5, v2: .5, row: 3 }, 1).fogged()]);
sheet('Land', land);
window.sheet = sheet;

import { STRUCTURES, structureSprite } from './structures.js';
const only = new URLSearchParams(location.search).get('only');
const structs = Object.keys(STRUCTURES).map((k, i) => [k, structureSprite(k, { biome: ['farm', 'wood', 'fen', 'hills', 'moor', 'snow', 'waste', 'crown'][i % 8] })]);
sheet('Structures', structs, 10);
if (only === 'structures') document.querySelectorAll('h2, canvas').forEach((el, i) => { if (i < 2) el.remove(); });

import { hero, foe, peasant } from './figures.js';
import { FOES } from './rules.js';
function figSheet(title, list, S2 = 4) {
  const h2 = document.createElement('h2'); h2.textContent = title; out.append(h2);
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:0 12px';
  for (const [name, px] of list) {
    const c = px.canvas(); c.style.width = px.w * S2 + 'px'; c.style.height = px.h * S2 + 'px';
    const d = document.createElement('div'); d.append(c); const l = document.createElement('div'); l.textContent = name; l.style.fontSize = '11px'; d.append(l); wrap.append(d);
  }
  out.append(wrap);
}
const heroes = [];
for (const armor of ['rags', 'jerkin', 'leather', 'chain', 'scale', 'plate', 'mithril']) for (const pose of ['front', 'back']) heroes.push([`${armor} ${pose}`, hero({ armor, weapon: ['staff', 'longsword', 'axe', 'spear', 'bow', 'warhammer', 'runeblade'][heroes.length % 7], colour: '#2f55a8', look: { skin: '#e0b48e', hair: '#7a4a26', style: heroes.length % 4 } }, pose)]);
heroes.push(['walk1', hero({ armor: 'chain', weapon: 'longsword', colour: '#8a2a2a' }, 'back', 1)], ['walk3', hero({ armor: 'chain', weapon: 'longsword', colour: '#8a2a2a' }, 'back', 3)]);
heroes.push(['crowned', hero({ armor: 'plate', weapon: 'longsword', colour: '#8a2a2a', crowned: true }, 'front')], ['toad', hero({ toad: true })]);
figSheet('Heroes', heroes, 5);
figSheet('Foes', Object.keys(FOES).map(id => [id, foe(id)]), 3);
figSheet('Crowd', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => ['p' + k, peasant(k * 5, k % 2)]), 5);
