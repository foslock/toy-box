// Little 16×16 pictures for the page: stats, relics, blessings and curses, allies, arms and armour. Painted with the
// same pixel painter as the map, and handed out as canvases (scaled up with CSS, never smoothed).
import { Px, ramp } from './paint.js';

const INK = '#1c1622';
const G = ramp('#f2c24c'), S = ramp('#c8ccd4'), W = ramp('#8a5a36'), R = ramp('#c8302a');
const px = (p, pts, c) => { for (const [x, y] of pts) p.put(x, y, c); };
const sword = (p, blade = S, hilt = G.base, x = 8) => { p.rect(x - 1, 2, 2, 9, blade.lit); p.vline(x, 2, 10, blade.dim); p.put(x - 1, 1, blade.hi); p.rect(x - 3, 11, 6, 1, hilt); p.rect(x - 1, 12, 2, 3, W.dim); p.put(x - 1, 15, hilt); };

const DRAW = {
  /* stats */
  hp(p) { p.disc(5.5, 6, 3.3, R.base); p.disc(10.5, 6, 3.3, R.base); p.poly([[2.3, 7], [13.7, 7], [8, 14]], R.base); px(p, [[4, 4], [5, 4], [4, 5]], '#ff9a8a'); p.put(11, 5, R.lit); },
  food(p) { p.ellipse(8, 9, 6.5, 4.5, (x, y, nx, ny) => ny < -.3 ? '#e8b060' : '#c88a3a'); for (const x of [5, 8, 11]) p.line(x - 1, 6, x + 1, 8, '#a86a2a'); },
  gold(p) { p.disc(8, 8, 5.6, G.base); p.disc(8, 8, 4.3, G.lit); p.rect(7, 5, 2, 6, G.dim); px(p, [[6, 5], [5, 6]], G.hi); },
  power(p) { sword(p); },
  renown(p) { p.poly([[8, 1], [10, 6], [15, 6], [11, 9], [13, 15], [8, 11], [3, 15], [5, 9], [1, 6], [6, 6]], G.base); p.poly([[8, 3], [9.5, 7], [6.5, 7]], G.hi); },
  sight(p) { p.ellipse(8, 8, 6.5, 4, '#e8e4f4'); p.disc(8, 8, 2.8, '#6a5ab8'); p.disc(8, 8, 1.3, INK); p.put(7, 7, '#ffffff'); },
  claim(p) { p.rect(3, 8, 10, 5, G.base); p.poly([[3, 8], [3, 3], [6, 6]], G.base); p.poly([[13, 8], [13, 3], [10, 6]], G.base); p.poly([[6, 8], [8, 2], [10, 8]], G.lit); p.rect(3, 12, 10, 1, G.dim); p.put(8, 10, R.base); p.put(5, 10, '#4a8ae0'); p.put(11, 10, '#4a8ae0'); },
  skull(p) { p.disc(8, 7, 5, '#e8e0cc'); p.rect(5, 10, 6, 4, '#e8e0cc'); p.rect(5, 6, 2, 3, INK); p.rect(9, 6, 2, 3, INK); p.put(7, 11, INK); p.put(9, 11, INK); },
  /* relics */
  horseshoe(p) { for (let a = 0; a <= Math.PI; a += .08) { const x = 8 + Math.cos(a) * 5, y = 7 - Math.sin(a) * 5; p.rect(Math.round(x) - 1, Math.round(y), 2, 2, S.base); } p.rect(2, 7, 2, 6, S.base); p.rect(12, 7, 2, 6, S.base); px(p, [[3, 9], [12, 9], [6, 3], [10, 3]], INK); },
  wolf_tooth(p) { p.line(3, 3, 13, 3, W.base); p.poly([[6, 4], [10, 4], [8, 14]], '#f0e8d4'); p.vline(9, 5, 11, '#c8bca4'); },
  satchel(p) { p.rect(3, 6, 10, 8, W.base); p.rect(3, 6, 10, 3, W.lit); p.line(4, 6, 8, 2, W.dim); p.line(12, 6, 8, 2, W.dim); p.rect(7, 8, 2, 2, G.base); },
  merchant_seal(p) { p.disc(8, 8, 6, '#b8302a'); p.disc(8, 8, 4.5, '#d8483a'); p.rect(6, 5, 4, 6, '#8a1a1a'); p.rect(5, 7, 6, 2, '#8a1a1a'); },
  moss(p) { p.rect(4, 7, 8, 7, '#b89a6a'); p.rect(4, 5, 8, 2, '#8a7048'); for (const [x, y] of [[5, 3], [8, 2], [11, 4], [6, 4], [10, 3]]) p.disc(x, y + 1, 1.6, '#6ac85a'); },
  pilgrim_badge(p) { p.poly([[8, 14], [2, 6], [4, 3], [8, 2], [12, 3], [14, 6]], '#f0e0c0'); for (const x of [5, 8, 11]) p.line(8, 13, x, 3, '#c8a878'); },
  salt(p) { p.rect(4, 6, 8, 8, '#e8e4dc'); p.rect(5, 4, 6, 2, '#c8c0b4'); p.rect(7, 7, 2, 6, '#4a6ab8'); p.rect(5, 9, 6, 2, '#4a6ab8'); },
  snare(p) { for (let a = 0; a < Math.PI * 2; a += .15) p.put(Math.round(8 + Math.cos(a) * 4), Math.round(7 + Math.sin(a) * 4), '#c8a878'); p.line(8, 11, 8, 15, '#c8a878'); p.line(4, 7, 1, 4, '#c8a878'); },
  glove(p) { p.rect(4, 7, 8, 7, '#5a4a4a'); for (const x of [4, 6, 8, 10]) p.rect(x, 3, 2, 5, '#6a5a5a'); p.rect(12, 8, 2, 3, '#6a5a5a'); p.rect(4, 12, 8, 2, '#3a2a2a'); },
  candle(p) { p.rect(6, 6, 4, 9, '#f0e8d0'); p.rect(9, 6, 1, 9, '#c8c0a8'); p.vline(8, 4, 5, INK); p.disc(8, 3, 1.6, '#ffd24a'); p.put(8, 2, '#fff4c0'); },
  rabbit_foot(p) { p.ellipse(8, 9, 3.5, 5, '#e8dcc8'); p.rect(6, 2, 4, 3, G.base); p.put(6, 13, '#c8b8a0'); p.put(9, 13, '#c8b8a0'); },
  tinker_coin(p) { p.disc(8, 8, 6, S.base); p.disc(8, 8, 4.5, S.lit); p.rect(6, 6, 4, 4, S.dim); p.put(7, 7, S.hi); },
  phoenix(p) { p.line(4, 14, 11, 2, '#8a5a2a'); for (let i = 0; i < 9; i++) { p.line(5 + i * .8, 13 - i * 1.3, 2 + i, 11 - i * 1.6, i < 4 ? '#ff6a2a' : '#ffb03a'); p.line(6 + i * .8, 13 - i * 1.3, 11 + i * .3, 12 - i * 1.4, i < 4 ? '#e03a1a' : '#ffd24a'); } },
  dragon_scale(p) { p.poly([[8, 1], [14, 6], [12, 13], [8, 15], [4, 13], [2, 6]], '#c8302a'); p.poly([[8, 3], [12, 7], [8, 12], [4, 7]], '#e85a3a'); p.line(8, 3, 8, 12, '#8a1a1a'); },
  chalice(p) { p.poly([[3, 2], [13, 2], [10, 8], [6, 8]], '#8a1a2a'); p.rect(3, 2, 10, 1, S.lit); p.rect(7, 8, 2, 4, S.base); p.rect(4, 12, 8, 2, S.base); p.rect(5, 3, 6, 2, '#c8203a'); },
  crystal_ball(p) { p.rect(4, 12, 8, 3, W.base); p.disc(8, 7, 5.5, '#8ab8f0'); p.disc(8, 7, 4, '#b8d8ff'); p.put(6, 5, '#ffffff'); p.put(7, 5, '#ffffff'); p.put(9, 9, '#6a5ab8'); },
  fox_ring(p) { for (let a = 0; a < Math.PI * 2; a += .12) p.put(Math.round(8 + Math.cos(a) * 4.5), Math.round(9 + Math.sin(a) * 4.5), G.base); p.disc(8, 4, 2.6, '#ff7a2a'); p.put(7, 3, '#ffd0a0'); },
  dawnblade(p) { sword(p, ramp('#ffe8a0'), G.base); p.put(4, 3, '#fff4c0'); p.put(12, 5, '#fff4c0'); p.put(3, 8, '#fff4c0'); },
  aegis(p) { p.line(4, 1, 8, 5, G.base); p.line(12, 1, 8, 5, G.base); p.poly([[3, 5], [13, 5], [13, 10], [8, 15], [3, 10]], G.base); p.poly([[5, 6], [11, 6], [11, 10], [8, 13], [5, 10]], '#4a6ab8'); p.put(8, 9, G.hi); },
  golden_goose(p) { p.ellipse(7, 10, 5, 3.5, G.base); p.rect(10, 3, 2, 7, G.base); p.disc(11, 3, 1.8, G.base); p.rect(13, 3, 2, 1, '#e08a2a'); p.put(11, 2, INK); p.ellipse(4, 13, 2, 1.5, '#fff4e0'); },
  gorgon_eye(p) { DRAW.sight(p); for (const [x, y] of [[2, 3], [4, 1], [12, 1], [14, 3], [1, 12], [15, 12]]) p.put(x, y, '#4a8a4a'); p.disc(8, 8, 2.8, '#4a8a4a'); p.rect(8, 6, 1, 5, INK); },
  hourglass(p) { p.rect(3, 1, 10, 2, W.base); p.rect(3, 13, 10, 2, W.base); p.poly([[4, 3], [12, 3], [8, 8]], '#d8e4f0'); p.poly([[8, 8], [12, 13], [4, 13]], '#d8e4f0'); p.poly([[6, 4], [10, 4], [8, 7]], '#e8c870'); p.poly([[8, 10], [11, 13], [5, 13]], '#e8c870'); },
  boots(p) { p.rect(3, 3, 4, 8, '#6a4a30'); p.rect(3, 11, 7, 3, '#6a4a30'); p.rect(9, 3, 4, 8, '#7a5a3a'); p.rect(9, 11, 6, 3, '#7a5a3a'); p.put(1, 12, '#b8e0ff'); p.put(0, 10, '#b8e0ff'); },
  grail(p) { p.poly([[3, 2], [13, 2], [10, 8], [6, 8]], G.base); p.rect(3, 2, 10, 1, G.hi); p.rect(7, 8, 2, 4, G.base); p.rect(4, 12, 8, 2, G.dim); p.rect(5, 3, 6, 2, '#ffe8a0'); for (const [x, y] of [[1, 5], [15, 4], [8, 0]]) p.put(x, y, '#fff4c0'); },
  kingsblade(p) { sword(p, ramp('#e8ecf8'), G.hi); p.rect(5, 0, 6, 1, G.base); px(p, [[5, 1], [8, 1], [10, 1]], G.base); },
  dragon_egg(p) { p.ellipse(8, 8.5, 5, 6.5, (x, y, nx, ny) => ny < -.3 ? '#6aa04a' : '#4a803a'); for (const [x, y] of [[6, 5], [10, 7], [7, 10], [10, 11]]) p.put(x, y, '#f2c24c'); },
  old_banner(p) { p.vline(3, 1, 15, W.dim); p.rect(4, 2, 9, 9, '#2f55a8'); p.poly([[4, 11], [13, 11], [8.5, 14]], '#2f55a8'); p.rect(7, 4, 3, 4, G.base); p.put(8, 3, G.base); },
  /* blessings and curses */
  second_sight(p) { DRAW.sight(p); for (const [x, y] of [[8, 1], [2, 3], [14, 3], [8, 14]]) p.put(x, y, G.hi); },
  dragonblood(p) { p.poly([[8, 1], [13, 9], [8, 15], [3, 9]], '#c8302a'); p.disc(8, 10, 4.6, '#c8302a'); p.put(6, 8, '#ff8a6a'); },
  silver_tongue(p) { p.poly([[2, 3], [14, 3], [14, 10], [8, 10], [5, 13], [5, 10], [2, 10]], S.lit); for (const x of [5, 8, 11]) p.put(x, 6, INK); },
  beloved(p) { DRAW.hp(p); p.put(13, 2, G.hi); p.put(2, 13, G.hi); p.put(14, 12, G.hi); },
  iron_stomach(p) { p.ellipse(8, 10, 6, 4, '#6a6e78'); p.rect(2, 7, 12, 2, '#8a8e98'); p.rect(4, 5, 8, 2, '#c88a3a'); },
  lucky(p) { for (const [x, y] of [[5, 5], [11, 5], [5, 10], [11, 10]]) p.disc(x, y, 3, '#4aa84a'); p.line(8, 8, 11, 15, '#3a7a3a'); p.put(8, 8, '#8ae07a'); },
  beast_tongue(p) { p.disc(8, 10, 3.6, '#8a6a4a'); for (const [x, y] of [[3, 5], [6, 3], [10, 3], [13, 5]]) p.disc(x, y, 1.6, '#8a6a4a'); },
  knighted(p) { p.poly([[3, 3], [13, 3], [13, 9], [8, 14], [3, 9]], '#2f55a8'); p.line(2, 14, 14, 1, S.lit); p.line(2, 13, 13, 1, S.base); p.rect(3, 12, 3, 1, G.base); },
  saints_ward(p) { for (let a = 0; a < Math.PI * 2; a += .1) p.put(Math.round(8 + Math.cos(a) * 6), Math.round(5 + Math.sin(a) * 2.2), G.hi); p.disc(8, 11, 3, '#f0d0b0'); },
  stout_heart(p) { DRAW.hp(p); p.rect(11, 9, 5, 1, '#ffffff'); p.rect(13, 7, 1, 5, '#ffffff'); },
  royal_blood(p) { DRAW.claim(p); p.disc(8, 14, 1.4, R.base); },
  wolfblood(p) { p.disc(8, 8, 6.5, '#e8e4c8'); p.disc(10, 7, 5.5, '#2a2a3a'); p.poly([[3, 12], [6, 9], [9, 12]], '#4a4a54'); },
  midas(p) { p.rect(4, 7, 8, 7, G.base); for (const x of [4, 6, 8, 10]) p.rect(x, 3, 2, 5, G.lit); p.rect(12, 8, 2, 3, G.lit); p.put(5, 9, G.hi); },
  twin_step(p) { for (const [x, y] of [[4, 3], [10, 8]]) { p.ellipse(x + 1, y + 3, 2, 3, '#b87aff'); p.rect(x, y, 3, 1, '#b87aff'); } },
  weathervane(p) { p.vline(8, 4, 15, '#5a5a62'); p.line(2, 4, 14, 4, '#8a8a92'); p.poly([[14, 4], [11, 2], [11, 6]], '#8a8a92'); p.poly([[2, 2], [4, 4], [2, 6]], '#8a8a92'); p.put(8, 3, '#b87aff'); },
  wendigo(p) { DRAW.skull(p); p.line(4, 4, 1, 0, '#c8b890'); p.line(12, 4, 15, 0, '#c8b890'); p.line(2, 2, 0, 2, '#c8b890'); p.line(14, 2, 15, 3, '#c8b890'); },
  leaden_purse(p) { p.ellipse(8, 10, 5.5, 4.5, '#6a6a72'); p.rect(6, 4, 4, 3, '#6a6a72'); p.rect(7, 9, 3, 3, '#3a3a42'); p.put(8, 8, '#b87aff'); },
  veil(p) { p.ellipse(8, 8, 6.5, 4, '#e8e4f4'); p.rect(1, 5, 15, 4, '#6a5a7a'); for (let x = 1; x < 16; x += 2) p.put(x, 9, '#6a5a7a'); },
  glass_bones(p) { p.line(3, 13, 13, 3, '#e8e0cc'); p.line(4, 13, 13, 4, '#e8e0cc'); p.disc(3, 13, 2, '#e8e0cc'); p.disc(13, 3, 2, '#e8e0cc'); px(p, [[8, 7], [7, 8], [9, 8], [8, 9]], '#b87aff'); },
  ill_luck(p) { p.ellipse(8, 11, 4.5, 4, '#1e1a26'); p.disc(8, 6, 3.3, '#1e1a26'); p.poly([[5, 4], [6, 1], [7, 4]], '#1e1a26'); p.poly([[9, 4], [10, 1], [11, 4]], '#1e1a26'); p.put(7, 6, '#ffd24a'); p.put(9, 6, '#ffd24a'); p.line(12, 13, 15, 8, '#1e1a26'); },
  reaper(p) { p.line(4, 15, 11, 2, W.dim); for (let a = 0; a < 1.8; a += .1) p.put(Math.round(11 - Math.cos(a) * 8), Math.round(2 + Math.sin(a) * 3), S.lit); },
  oathbreaker(p) { p.rect(7, 1, 2, 5, S.lit); p.rect(8, 8, 2, 4, S.lit); p.put(9, 7, S.base); p.rect(5, 11, 6, 1, G.base); p.rect(7, 12, 2, 3, W.dim); },
  toad(p) { p.ellipse(8, 10, 6, 4, '#5a9a3a'); p.disc(5, 6, 2, '#6aaa4a'); p.disc(11, 6, 2, '#6aaa4a'); p.put(5, 6, INK); p.put(11, 6, INK); p.hline(4, 12, 11, '#3a6a2a'); },
  /* allies */
  rebels(p) { p.poly([[8, 1], [14, 12], [2, 12]], '#3a7a3a'); p.poly([[8, 4], [11, 11], [5, 11]], '#2a2a22'); p.disc(8, 9, 2, '#e0b48e'); p.line(1, 15, 15, 3, W.base); },
  guild(p) { p.line(3, 13, 12, 4, S.lit); p.put(13, 3, S.hi); p.rect(2, 12, 3, 3, W.dim); p.disc(11, 11, 2.6, G.base); p.put(11, 11, INK); p.rect(8, 11, 1, 3, G.base); },
  knights(p) { p.disc(8, 7, 4.5, '#c8203a'); p.disc(8, 7, 2.5, '#e8506a'); p.put(8, 7, G.hi); p.line(8, 11, 8, 15, '#3a7a3a'); p.put(6, 13, '#3a7a3a'); },
  church(p) { p.disc(8, 8, 4, G.lit); for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) p.line(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, G.base); },
  merchants(p) { p.vline(8, 2, 14, W.dim); p.hline(2, 14, 4, W.base); p.line(2, 4, 2, 8, S.base); p.line(14, 4, 14, 8, S.base); p.ellipse(3, 9, 2.4, 1.2, G.base); p.ellipse(13, 9, 2.4, 1.2, G.base); p.rect(5, 14, 7, 1, W.dim); },
  mages(p) { p.poly([[8, 0], [13, 12], [3, 12]], '#3a3a8a'); p.rect(1, 12, 14, 2, '#3a3a8a'); p.put(8, 5, '#f2e25a'); p.put(6, 9, '#f2e25a'); p.put(10, 8, '#f2e25a'); },
  fey(p) { p.ellipse(4, 6, 3, 4, '#c89aff'); p.ellipse(12, 6, 3, 4, '#c89aff'); p.ellipse(4, 12, 2.5, 2.5, '#9ae0ff'); p.ellipse(12, 12, 2.5, 2.5, '#9ae0ff'); p.vline(8, 3, 14, INK); },
  dwarves(p) { p.rect(4, 2, 8, 4, S.base); p.rect(7, 6, 2, 9, W.base); p.disc(8, 12, 3, '#c88a4a'); p.rect(4, 11, 8, 2, '#c88a4a'); },
  lords(p) { p.rect(2, 7, 12, 8, '#a8a296'); for (const x of [2, 6, 10]) p.rect(x, 5, 3, 2, '#a8a296'); p.rect(7, 10, 2, 5, INK); p.vline(8, 0, 5, W.dim); p.rect(9, 0, 4, 3, '#c0302a'); },
  /* gear */
  staff(p) { p.line(3, 15, 12, 1, W.base); p.line(4, 15, 13, 1, W.dim); },
  dagger(p) { p.line(4, 12, 12, 4, S.lit); p.put(13, 3, S.hi); p.line(2, 11, 5, 14, G.base); p.line(2, 14, 4, 12, W.dim); },
  axe(p) { p.line(4, 15, 11, 2, W.base); p.poly([[9, 2], [15, 4], [13, 9], [11, 5]], S.lit); },
  spear(p) { p.line(2, 15, 12, 3, W.base); p.poly([[12, 1], [15, 1], [13, 5]], S.lit); },
  bow(p) { for (let a = -1.2; a < 1.2; a += .08) p.put(Math.round(5 + Math.cos(a) * 7), Math.round(8 + Math.sin(a) * 7), W.base); p.vline(7, 1, 15, '#e8e0d0'); },
  mace(p) { p.line(3, 15, 10, 6, W.base); p.disc(11, 5, 3.4, S.base); for (const [x, y] of [[11, 0], [15, 5], [6, 5], [11, 10]]) p.put(x, y, S.dim); },
  hammer(p) { p.line(3, 15, 10, 6, W.base); p.poly([[6, 3], [11, 0], [15, 5], [10, 8]], S.base); },
  sword(p) { sword(p); },
  great(p) { sword(p, ramp('#b8c0d8'), G.base); p.rect(6, 3, 1, 7, '#e8ecf8'); },
  armor(p, id) {
    const col = { rags: '#6a5a4a', jerkin: '#b89a6a', leather: '#8a5a36', chain: '#9aa0aa', scale: '#7a8aa0', plate: '#c8ccd4', mithril: '#dfe8f4' }[id] || '#8a5a36';
    const A = ramp(col);
    p.rect(3, 3, 10, 11, A.base); p.rect(3, 3, 3, 11, A.lit); p.rect(11, 3, 2, 11, A.dim); p.rect(6, 2, 4, 2, INK);
    p.rect(1, 3, 2, 5, A.dim); p.rect(13, 3, 2, 5, A.dim);
    if (id === 'chain' || id === 'scale') for (let y = 5; y < 13; y += 2) for (let x = 4 + (y >> 1) % 2; x < 12; x += 2) p.put(x, y, A.dim);
    if (id === 'plate' || id === 'mithril') { p.hline(3, 12, 8, A.dim); p.put(5, 5, A.hi); }
  },
};
const WEAPON_ICON = { staff: 'staff', dagger: 'dagger', heirloom1: 'sword', heirloom2: 'sword', heirloom3: 'great', axe: 'axe', spear: 'spear', bow: 'bow', mace: 'mace', longsword: 'sword', warhammer: 'hammer', lance: 'spear', elvenblade: 'sword', runeblade: 'great', dragonbone: 'great' };
const ARMOR_IDS = ['rags', 'jerkin', 'leather', 'chain', 'scale', 'plate', 'mithril'];

const CACHE = new Map();
function art(id) {
  if (CACHE.has(id)) return CACHE.get(id);
  const p = new Px(16, 16);
  if (ARMOR_IDS.includes(id)) DRAW.armor(p, id);
  else (DRAW[id] || DRAW[WEAPON_ICON[id]] || DRAW.skull)(p);
  p.outline(INK);
  CACHE.set(id, p);
  return p;
}
// A canvas showing an icon, scale × its size on the page.
export function icon(id, scale = 2, cls = '') {
  const c = art(id).canvas();
  const out = document.createElement('canvas');
  out.width = 16; out.height = 16;
  out.getContext('2d').drawImage(c, 0, 0);
  out.className = 'ico' + (cls ? ' ' + cls : '');
  out.style.width = out.style.height = 16 * scale + 'px';
  out.setAttribute('aria-hidden', 'true');
  return out;
}
export const iconURL = id => { const c = art(id).canvas(); return c.toDataURL ? c.toDataURL() : ''; };
export const hasIcon = id => !!(DRAW[id] || WEAPON_ICON[id] || ARMOR_IDS.includes(id));
