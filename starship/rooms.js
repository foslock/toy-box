// Every kind of room on the ship: how big it is, where on the ship it likes to be, and how to build it:
// its back wall and furniture (painted once), the stations where crew work, eat, sleep or play, and the
// widgets that animate (screens, fans, the reactor, treadmills...). Rooms face the viewer; forward is +x.
import { shade, drawText, textWidth, bayer } from './util.js';

/* ---------- palettes ---------- */
export const WALLS = {
  hall:    { b: '#2e3544', d: '#262c38', l: '#3a4356', t: '#4d586e', f: '#454c5c' },
  command: { b: '#232b40', d: '#1c2234', l: '#2d3752', t: '#46557a', f: '#3a4256' },
  eng:     { b: '#3b3029', d: '#2f2620', l: '#4a3c32', t: '#665240', f: '#4a4640' },
  med:     { b: '#a9b9c1', d: '#95a7b0', l: '#c0d0d7', t: '#dfe9ec', f: '#8d9ea6' },
  sci:     { b: '#213b40', d: '#1b3035', l: '#2a4b51', t: '#3d6972', f: '#3a4a4e' },
  living:  { b: '#3e3548', d: '#332b3c', l: '#4b4057', t: '#62536f', f: '#5a4640' },
  warm:    { b: '#4b3b2d', d: '#3e3125', l: '#5b4836', t: '#7a6048', f: '#6a4a30' },
  gym:     { b: '#2f3e48', d: '#27343d', l: '#394c58', t: '#4e6676', f: '#3e5244' },
  sec:     { b: '#402e30', d: '#342527', l: '#4d383b', t: '#6a4a4e', f: '#3e3e44' },
  cargo:   { b: '#3a3729', d: '#302d21', l: '#464332', t: '#6a6448', f: '#4a4a40' },
  green:   { b: '#27381f', d: '#202e19', l: '#304528', t: '#4a6a3a', f: '#4a3a28' },
  fun:     { b: '#312d4c', d: '#29253f', l: '#3b365a', t: '#56508a', f: '#48365a' },
  dark:    { b: '#24272f', d: '#1d2027', l: '#2c3039', t: '#3f4552', f: '#363a44' },
};

/* ---------- pixel helpers ---------- */
const R_ = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const PX = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
const HL = (g, x0, x1, y, c) => R_(g, x0, y, x1 - x0 + 1, 1, c);
const VL = (g, x, y0, y1, c) => R_(g, x, y0, 1, y1 - y0 + 1, c);
function BOX(g, x, y, w, h, fill, edge, hi) {
  R_(g, x, y, w, h, edge); R_(g, x + 1, y + 1, w - 2, h - 2, fill);
  if (hi) HL(g, x + 1, x + w - 2, y + 1, hi);
}
const METAL = '#5a6272', METAL_D = '#3b414d', METAL_L = '#8a94a6', DARK = '#15181f', GLASS = '#0f1622';

/* ---------- furniture ---------- */
// a chair facing dir, for someone sitting at x (the sit sprite's thighs rest on row fl - 3)
function chair(g, x, fl, dir, col = '#4a5060') {
  const d = shade(col, -.3);
  for (let i = -2; i <= 1; i++) PX(g, x + i * dir, fl - 2, col);
  VL(g, x - 3 * dir, fl - 8, fl - 2, d); PX(g, x - 3 * dir, fl - 9, d);
  PX(g, x - 2 * dir, fl - 1, d); PX(g, x + 1 * dir, fl - 1, d);
}
function stool(g, x, fl, col = '#6a5a4a') { HL(g, x - 2, x + 1, fl - 2, col); VL(g, x, fl - 1, fl - 1, shade(col, -.35)); VL(g, x - 1, fl - 1, fl - 1, shade(col, -.35)); }
function table(g, x0, x1, fl, h, col) {
  HL(g, x0, x1, fl - h, shade(col, .15)); HL(g, x0, x1, fl - h + 1, col);
  VL(g, x0 + 1, fl - h + 2, fl - 1, shade(col, -.35)); VL(g, x1 - 1, fl - h + 2, fl - 1, shade(col, -.35));
}
// a desk console: a body, a sloped top and a screen facing the operator
function console_(g, x, fl, w, h, col, dir = 1) {
  const d = shade(col, -.35), l = shade(col, .2);
  R_(g, x, fl - h, w, h, col); HL(g, x, x + w - 1, fl - h, l); VL(g, dir > 0 ? x + w - 1 : x, fl - h, fl - 1, d);
  HL(g, x, x + w - 1, fl - 1, d);
  return { x: x + 1, y: fl - h + 2, w: w - 2, h: Math.max(1, h - 5) };
}
function locker(g, x, fl, w, h, col) {
  BOX(g, x, fl - h, w, h, col, shade(col, -.45), shade(col, .15));
  for (let i = x + 3; i < x + w - 1; i += 4) VL(g, i, fl - h + 1, fl - 2, shade(col, -.25));
  for (let i = x + 1; i < x + w - 1; i += 4) PX(g, i + 1, fl - Math.round(h * .55), '#c9c2a8');
}
function crate(g, x, y, w, h, col) {
  BOX(g, x, y, w, h, col, shade(col, -.5), shade(col, .2));
  if (w > 5 && h > 4) { g.fillStyle = shade(col, -.25); g.fillRect(x + 1, y + Math.floor(h / 2), w - 2, 1); }
}
function plant(g, x, fl, R, big) {
  const pot = R.pick(['#b8653a', '#d8d0c0', '#3a4a6a', '#6a8a5a']);
  R_(g, x - 2, fl - 4, 5, 4, pot); HL(g, x - 2, x + 2, fl - 4, shade(pot, .2));
  const leaves = ['#3f7d3a', '#5aa04a', '#2e5e2c', '#7ac05a'], n = big ? 14 : 8;
  for (let i = 0; i < n; i++) { const a = R.range(-2.6, -.5), r = R.range(2, big ? 9 : 5); PX(g, x + Math.round(Math.cos(a) * r * .7), fl - 5 + Math.round(Math.sin(a) * r), R.pick(leaves)); }
  VL(g, x, fl - (big ? 9 : 6), fl - 5, '#2e5e2c');
}
function shelf(g, x0, x1, y, R, items = 'box') {
  HL(g, x0, x1, y, METAL_L); HL(g, x0, x1, y + 1, METAL_D);
  for (let x = x0 + 1; x < x1 - 1;) {
    const w = R.int(2, 4), h = R.int(2, 5);
    if (items === 'book') { const c = R.pick(['#b8453a', '#3a6ab8', '#d8b04a', '#4a9a5a', '#8a4ab0', '#e0d8c0', '#5a3a2a']); R_(g, x, y - h, w - 1, h, c); PX(g, x, y - h, shade(c, .3)); }
    else if (items === 'bottle') { const c = R.pick(['#5ad06a', '#e0a040', '#c04a6a', '#6ab0e0', '#e8e0c0', '#9a5ad0']); R_(g, x, y - 4, 1, 4, c); PX(g, x, y - 5, shade(c, -.3)); x += 2; continue; }
    else { const c = R.pick(['#8a6a4a', '#9a8a6a', '#6a7a8a', '#aa9a7a', '#5a6a5a']); crate(g, x, y - h, w, h, c); }
    x += w + R.int(0, 1);
  }
}
// a window through the back wall: those pixels are left clear so the starfield behind the ship shows
function windowCut(k, x, y, w, h, frame = METAL) {
  const g = k.g;
  R_(g, x - 1, y - 1, w + 2, h + 2, frame); g.clearRect(x, y, w, h);
  HL(g, x - 1, x + w, y - 1, shade(frame, .25));
  k.windows.push({ x, y, w, h });
}
function stripes(g, x, y, w, h, a = '#d8b030', b = '#2a2a2a') {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) PX(g, x + i, y + j, ((i + j) >> 1) % 2 ? a : b);
}
function sign(k, text, x, y, fg = '#e8e4d8', bg) {
  const w = textWidth(text) + 4;
  if (bg) BOX(k.g, x, y, w, 9, bg, shade(bg, -.4));
  drawText(k.g, text, x + 2, y + 2, fg);
  return w;
}
// FTL-style system badge: a rounded square with a pictogram
const ICONS = {
  helm:   ['.###.', '#.#.#', '#####', '#.#.#', '.###.'],
  engine: ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'],
  shield: ['.###.', '#...#', '#...#', '.#.#.', '..#..'],
  o2:     ['###..', '#.#..', '###.#', '....#', '...##'],
  med:    ['..#..', '..#..', '#####', '..#..', '..#..'],
  eye:    ['.....', '.###.', '#.#.#', '.###.', '.....'],
  target: ['..#..', '.###.', '##.##', '.###.', '..#..'],
  tele:   ['#####', '..#..', '..#..', '..#..', '..#..'],
  chip:   ['#.#.#', '#####', '#...#', '#####', '#.#.#'],
  drone:  ['..#..', '.###.', '#####', '.#.#.', '#...#'],
  bolt:   ['...#.', '..#..', '.###.', '..#..', '.#...'],
  door:   ['#####', '#...#', '#..##', '#...#', '#####'],
  leaf:   ['...##', '..###', '.###.', '###..', '#....'],
  fork:   ['#.#.#', '#.#.#', '#####', '..#..', '..#..'],
  bunk:   ['#...#', '#####', '#...#', '#####', '#...#'],
  drop:   ['..#..', '.###.', '#####', '#####', '.###.'],
};
export const ICON_COL = { helm: '#6ab0ff', engine: '#ff9a3a', shield: '#5ae0ff', o2: '#9aff9a', med: '#ff6a6a', eye: '#c89aff', target: '#ff5a4a', tele: '#b0f0ff', chip: '#7ae0c0', drone: '#ffd24a', bolt: '#ffe45a', door: '#c8b89a', leaf: '#8ae07a', fork: '#ffcf8a', bunk: '#b8a8e0', drop: '#6ac8ff' };
export function iconPixels(name) { return ICONS[name]; }
function badge(k, icon, x, y) {
  const g = k.g, c = ICON_COL[icon];
  R_(g, x + 1, y, 7, 7, '#10131a'); R_(g, x, y + 1, 9, 5, '#10131a'); R_(g, x + 1, y + 1, 7, 5, '#1d222c');
  ICONS[icon].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') PX(g, x + 2 + i, y + 1 + j, c); }));
  k.r.badge = { x, y, icon };
}

/* ---------- back walls ---------- */
// Panel seams, a trim line, a baseboard, a shadow under the ceiling and dithered pools of lamplight.
function wall(k, pal, opts = {}) {
  const { g, x0, x1, top, fl } = k, h = fl - top, trim = top + Math.round(h * (opts.trim || .6));
  const lamps = opts.lamps || spread(x0, x1, opts.lampGap || 34);
  for (let y = top; y < fl; y++) for (let x = x0; x < x1; x++) {
    let c = pal.b;
    let lit = 0;
    for (const lx of lamps) { const dx = Math.abs(x - lx), dy = y - top; lit = Math.max(lit, 1 - (dx * .07 + dy * .03)); }
    if (lit > .35 + bayer(x, y) * .6) c = pal.l;
    if (y > trim) c = (x + y) & 1 && lit < .6 ? pal.d : c;
    if ((x - x0) % 16 === 15) c = pal.d;
    if (y === trim) c = pal.t;
    if (y < top + 2) c = pal.d;
    if (y >= fl - 2) c = y === fl - 2 ? pal.t : pal.d;
    g.fillStyle = c; g.fillRect(x, y, 1, 1);
  }
  // the floor
  HL(g, x0, x1 - 1, fl, pal.f); HL(g, x0, x1 - 1, fl + 1, shade(pal.f, -.3));
  for (const lx of lamps) lamp(k, lx, opts.lampCol);
  return lamps;
}
const spread = (x0, x1, gap) => { const n = Math.max(1, Math.round((x1 - x0) / gap)), o = []; for (let i = 0; i < n; i++) o.push(Math.round(x0 + (i + .5) * (x1 - x0) / n)); return o; };
function lamp(k, x, col = '#ffe9c0') {
  const g = k.g, y = k.top;
  HL(g, x - 2, x + 2, y, '#1a1d24'); HL(g, x - 1, x + 1, y + 1, col);
  k.lights.push({ x: x + .5, y: y + 2, r: 16, c: col === '#ffe9c0' ? '#ffd9a0' : col, a: .16, lamp: true });
}

/* ---------- room types ---------------------------------------------------------------------------
   w: width range in pixels (walls included). z: where it likes to be, fx 0 = aft … 1 = bow, fd 0 = top main
   deck … 1 = bottom (the tower is negative). need: how many the ship wants. tower/edge/near: bonuses. */
export const TYPES = {
  junction: { name: 'Lift junction', pal: 'hall', infra: true, build: buildJunction },
  bridge: { name: 'Bridge', pal: 'command', icon: 'helm', build: buildBridge },
  engine: { name: 'Engine Room', pal: 'eng', icon: 'engine', decks: 3, build: buildEngine },
  hangar: { name: 'Hangar Bay', pal: 'cargo', icon: 'drone', decks: 2, build: buildHangar },
  cargo: { name: 'Cargo Hold', pal: 'cargo', w: [100, 140], z: { fx: [.1, .6], fd: [.75, 1] }, filler: .5, build: buildCargo },
  hydro: { name: 'Hydroponics', pal: 'green', icon: 'leaf', w: [110, 140], z: { fx: [.2, .8], fd: [.2, .7] }, need: 1, build: buildHydro },
  ready: { name: "Captain's Ready Room", pal: 'command', w: [70, 86], z: { fx: [.1, .9], fd: [-1, .1] }, tower: 1.5, need: 1, build: buildReady },
  briefing: { name: 'Briefing Room', pal: 'command', w: [92, 112], z: { fx: [.1, .9], fd: [-1, .25] }, tower: 1, need: 1, build: buildBriefing },
  captain: { name: "Captain's Quarters", pal: 'living', w: [80, 96], z: { fx: [.1, .9], fd: [-1, .2] }, tower: .8, need: 1, build: buildCaptain },
  comms: { name: 'Sensors & Comms', pal: 'command', icon: 'eye', w: [80, 100], z: { fx: [.45, 1], fd: [-1, .35] }, tower: .4, need: 1, build: buildComms },
  astro: { name: 'Astrometrics', pal: 'sci', w: [88, 108], z: { fx: [.5, 1], fd: [-.5, .45] }, need: 1, build: buildAstro },
  officer: { name: "Officer's Cabin", pal: 'living', w: [60, 72], z: { fx: [.2, .9], fd: [-.5, .35] }, need: 4, filler: .2, build: buildOfficer },
  mess: { name: 'Mess Hall', pal: 'warm', icon: 'fork', w: [130, 156], z: { fx: [.35, .72], fd: [.3, .65] }, need: 1, build: buildMess },
  galley: { name: 'Galley', pal: 'warm', w: [66, 84], z: { fx: [.3, .75], fd: [.3, .7] }, near: 'mess', need: 1, build: buildGalley },
  bar: { name: 'The Airlock', pal: 'warm', w: [96, 120], z: { fx: [.4, .9], fd: [.2, .7] }, need: 1, build: buildBar },
  lounge: { name: 'Rec Lounge', pal: 'fun', w: [112, 136], z: { fx: [.2, .8], fd: [.2, .7] }, need: 1, filler: .05, build: buildLounge },
  observation: { name: 'Observation Lounge', pal: 'fun', w: [96, 124], z: { fx: [.6, 1], fd: [-.3, .35] }, edge: 1, need: 1, build: buildObservation },
  library: { name: 'Library', pal: 'warm', w: [80, 100], z: { fx: [.2, .8], fd: [0, .5] }, need: 1, build: buildLibrary },
  chapel: { name: 'Quiet Room', pal: 'fun', w: [58, 70], z: { fx: [.1, .9], fd: [.1, .9] }, need: 1, build: buildChapel },
  gym: { name: 'Gym', pal: 'gym', w: [128, 152], z: { fx: [.2, .75], fd: [.4, .85] }, need: 1, build: buildGym },
  armory: { name: 'Armory & Range', pal: 'sec', icon: 'target', w: [128, 150], z: { fx: [.2, .8], fd: [.45, .9] }, near: 'security', need: 1, build: buildArmory },
  security: { name: 'Security Office', pal: 'sec', icon: 'door', w: [70, 84], z: { fx: [.25, .75], fd: [.35, .75] }, need: 1, build: buildSecurity },
  brig: { name: 'Brig', pal: 'sec', w: [84, 100], z: { fx: [.2, .8], fd: [.4, .9] }, near: 'security', need: 1, build: buildBrig },
  medbay: { name: 'Medbay', pal: 'med', icon: 'med', w: [116, 140], z: { fx: [.35, .75], fd: [.25, .6] }, need: 1, build: buildMedbay },
  lab: { name: 'Science Lab', pal: 'sci', w: [92, 116], z: { fx: [.3, .95], fd: [.1, .55] }, need: 2, filler: .06, build: buildLab },
  workshop: { name: 'Engineering Workshop', pal: 'eng', w: [88, 110], z: { fx: [0, .45], fd: [.2, .9] }, need: 2, filler: .12, build: buildWorkshop },
  lifesupport: { name: 'Life Support', pal: 'eng', icon: 'o2', w: [84, 100], z: { fx: [.1, .6], fd: [.5, 1] }, need: 1, build: buildLifeSupport },
  water: { name: 'Water Reclamation', pal: 'sci', icon: 'drop', w: [80, 96], z: { fx: [0, .5], fd: [.6, 1] }, need: 1, build: buildWater },
  power: { name: 'Plasma Relay', pal: 'eng', icon: 'bolt', w: [62, 78], z: { fx: [0, .35], fd: [.1, .9] }, need: 1, build: buildPower },
  computer: { name: 'Computer Core', pal: 'dark', icon: 'chip', w: [74, 90], z: { fx: [.3, .7], fd: [.2, .6] }, need: 1, build: buildComputer },
  shields: { name: 'Shield Generator', pal: 'dark', icon: 'shield', w: [78, 96], z: { fx: [.3, .7], fd: [.3, .7] }, need: 1, build: buildShields },
  transporter: { name: 'Transporter Room', pal: 'command', icon: 'tele', w: [72, 86], z: { fx: [0, 1], fd: [.1, .8] }, need: 2, spread: 1, build: buildTransporter },
  torpedo: { name: 'Torpedo Bay', pal: 'sec', w: [92, 118], z: { fx: [.82, 1], fd: [.3, .8] }, edge: 1, need: 1, build: buildTorpedo },
  gunnery: { name: 'Gun Battery', pal: 'sec', w: [62, 72], z: { fx: [.25, .9], fd: [0, 1] }, hullEdge: 1, need: 2, build: buildGunnery },
  escape: { name: 'Escape Pods', pal: 'hall', w: [56, 66], z: { fx: [0, 1], fd: [0, 1] }, edge: 1.2, need: 2, spread: 1, build: buildEscape },
  laundry: { name: 'Laundry', pal: 'hall', w: [72, 90], z: { fx: [.1, .9], fd: [.45, 1] }, need: 1, build: buildLaundry },
  washroom: { name: 'Washroom', pal: 'med', w: [56, 68], z: { fx: [0, 1], fd: [0, 1] }, need: 3, spread: 1, filler: .1, build: buildWashroom },
  bunks: { name: 'Crew Quarters', pal: 'living', icon: 'bunk', w: [92, 110], z: { fx: [.1, .9], fd: [.2, .95] }, need: 9, spread: .4, filler: 2, build: buildBunks },
  storage: { name: 'Storage', pal: 'cargo', w: [50, 80], z: { fx: [0, 1], fd: [0, 1] }, filler: .3, build: buildStorage },
  passage: { name: 'Corridor', pal: 'hall', w: [48, 72], z: { fx: [0, 1], fd: [0, 1] }, filler: .45, build: buildPassage },
  maint: { name: 'Maintenance', pal: 'dark', w: [40, 54], z: { fx: [0, 1], fd: [0, 1] }, filler: .12, build: buildMaint },
};

/* ---------- builders ---------- */
function buildJunction(k) {
  const { g, x0, top, fl, r } = k;
  wall(k, { b: '#2a303c', d: '#222733', l: '#323a48', t: '#434d60', f: '#50586a' }, { lamps: [x0 + 20], trim: .99 });
  // the ladder on the left (up through the ceiling, or just a railed hatch down), the lift tube on the right
  const lx = x0 + 2;
  if (r.ladderUp) {
    VL(g, lx, top, fl - 1, METAL_L); VL(g, lx + 5, top, fl - 1, METAL_L);
    for (let y = top + 1; y < fl; y += 3) HL(g, lx + 1, lx + 4, y, METAL);
  } else if (r.ladderDown) {
    VL(g, lx - 1, fl - 6, fl - 1, '#c8a040'); VL(g, lx + 6, fl - 6, fl - 1, '#c8a040'); HL(g, lx - 1, lx + 6, fl - 6, '#e8c060');
  }
  if (r.ladderDown) R_(g, lx, fl, 6, 2, '#0d1016');
  r.ladderX = lx + 2.5;
  tube(k, x0 + 10);
  R_(g, x0 + 11, top + 2, 11, 7, '#0b0e14'); drawText(g, 'D' + (r.d0 + 1), x0 + 12, top + 3, '#e8c86a');
}
// a glass lift tube in the back wall, with the car drawn over it as it moves
function tube(k, x) {
  const { g, top, fl, r } = k;
  R_(g, x, top, 14, fl - top, '#11151d'); VL(g, x, top, fl - 1, METAL_D); VL(g, x + 13, top, fl - 1, METAL_D);
  VL(g, x + 1, top, fl - 1, METAL_L); VL(g, x + 12, top, fl - 1, METAL);
  R_(g, x + 2, top, 10, fl - top, GLASS); VL(g, x + 3, top, fl - 1, '#1b2636');
  R_(g, x - 1, fl - 17, 16, 1, METAL_L); PX(g, x - 1, fl - 16, METAL_L); PX(g, x + 14, fl - 16, METAL_L);
  r.liftX = x + 7; r.liftLamp = { x: x + 6, y: fl - 19 };
  k.wd({ kind: 'liftlamp', x: x + 6, y: fl - 19 });
}

function buildBridge(k) {
  const { g, f, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.command, { lampGap: 40, lampCol: '#cfe2ff' });
  badge(k, 'helm', x0 + 3, top + 3);
  let left = x0 + 2;
  if (r.shaftX !== undefined) { tube(k, r.shaftX + 11); left = r.shaftX + 28; }
  // forward windows, the lower console rail and a raised command deck
  const wx = x1 - 22;
  windowCut(k, wx, top + 3, 19, fl - top - 12, '#3d4a6a');
  R_(g, wx, fl - 9, 21, 9, '#2a3148'); HL(g, wx, x1 - 1, fl - 9, '#5a6a8a');
  const span = wx - left, helmX = wx - 8, navX = wx - 28, capX = left + Math.round(span * .55), tacX = capX - 22;
  // helm and nav consoles face forward
  for (const [cx, lbl, dept, w] of [[helmX, 'at the helm', 'command', [0, 1, 2]], [navX, 'plotting the course', 'command', [0, 1]]]) {
    const scr = console_(g, cx + 3, fl, 7, 7, '#3a4560');
    chair(g, cx, fl, 1, '#3a3f52');
    k.wd({ kind: 'screen', x: scr.x, y: scr.y, w: scr.w, h: 2, style: 'nav', col: '#57e3ff' });
    k.st({ x: cx, act: 'console', dir: 1, dept, watches: w, label: lbl, crit: lbl === 'at the helm' });
  }
  // captain's chair on a raised plinth
  R_(g, capX - 6, fl - 2, 12, 2, '#3a4260'); HL(g, capX - 6, capX + 5, fl - 2, '#5a6688');
  chair(g, capX, fl - 2, 1, '#8a3a3a'); VL(g, capX - 3, fl - 11, fl - 4, '#6a2a2a'); PX(g, capX + 2, fl - 5, '#ffcf6a');
  k.st({ x: capX, y: fl - 2, act: 'captain', dir: 1, dept: 'command', watches: [0, 1, 2], label: 'in command', rank: 0 });
  // tactical rail behind
  const tscr = console_(g, tacX + 2, fl, 6, 10, '#4a3a4a');
  k.wd({ kind: 'screen', x: tscr.x, y: tscr.y, w: tscr.w, h: 3, style: 'radar', col: '#ff6a5a' });
  k.st({ x: tacX, act: 'standConsole', dir: 1, dept: 'security', watches: [0, 1, 2], label: 'at tactical', crit: true });
  // science and ops along the back wall, facing aft
  const sx = left + 8;
  if (tacX - sx > 22) {
    const s1 = console_(g, sx - 6, fl, 6, 8, '#2e4a58', -1);
    chair(g, sx, fl, -1, '#3a3f52');
    k.wd({ kind: 'screen', x: s1.x, y: s1.y, w: s1.w, h: 3, style: 'graph', col: '#7affc0' });
    k.st({ x: sx, act: 'console', dir: -1, dept: 'science', watches: [0, 1], label: 'at the science station' });
  }
  if (tacX - sx > 44) {
    const ox = sx + 20, s2 = console_(g, ox - 6, fl, 6, 8, '#2e4a3a', -1);
    chair(g, ox, fl, -1, '#3a3f52');
    k.wd({ kind: 'screen', x: s2.x, y: s2.y, w: s2.w, h: 3, style: 'text', col: '#ffc15a' });
    k.st({ x: ox, act: 'console', dir: -1, dept: 'operations', watches: [0, 1, 2], label: 'running ship operations' });
  }
  // the big display over the rear consoles
  const vw = Math.min(40, tacX - left - 6);
  if (vw > 14) { const vx = left + 3; BOX(g, vx, top + 4, vw, 9, '#0c1420', '#3d4a6a'); k.wd({ kind: 'screen', x: vx + 1, y: top + 5, w: vw - 2, h: 7, style: 'map', col: '#57e3ff' }); }
  for (let i = 0; i < 4; i++) k.wd({ kind: 'blink', x: capX - 12 + i * 7, y: top + 6, c: R.pick(['#ff5a5a', '#5aff8a', '#ffd24a', '#5ac8ff']) });
  r.panel = { x: navX - 8, y: fl };
}

function buildEngine(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.eng, { lampGap: 44, lampCol: '#ffcf8a', trim: .9 });
  badge(k, 'engine', x0 + 3, top + 3);
  const cx = x0 + Math.round((x1 - x0) * .55), cw = 16;
  // catwalks at the decks in between
  for (const y of r.midFloors) {
    HL(g, x0, x1 - 1, y, '#6a6a6a'); for (let x = x0; x < x1; x += 2) PX(g, x, y + 1, '#3a3a3a');
    HL(g, x0, x1 - 1, y - 6, '#8a7a5a'); for (let x = x0 + 2; x < x1; x += 8) VL(g, x, y - 5, y - 1, '#6a5a3a');
  }
  // coolant pipes up the back wall
  for (const px of [x0 + 6, x0 + 10, x1 - 8]) { VL(g, px, top, fl - 1, '#3d7ea6'); VL(g, px + 1, top, fl - 1, '#5fb4d9'); }
  for (const px of [x0 + 14]) { VL(g, px, top, fl - 1, '#8a3a5a'); VL(g, px + 1, top, fl - 1, '#c45a82'); }
  // the core: a tall glass column in clamps, with a base and a cap
  R_(g, cx - 12, fl - 8, cw + 24, 8, '#4a4f5a'); HL(g, cx - 12, cx + cw + 11, fl - 8, '#7a8294'); stripes(g, cx - 12, fl - 3, cw + 24, 2);
  R_(g, cx - 8, top, cw + 16, 7, '#4a4f5a'); HL(g, cx - 8, cx + cw + 7, top + 6, '#2a2e36');
  R_(g, cx - 1, top + 7, cw + 2, fl - 8 - top - 7, '#1a2230');
  for (let y = top + 16; y < fl - 12; y += 14) { R_(g, cx - 3, y, cw + 6, 3, METAL); HL(g, cx - 3, cx + cw + 2, y, METAL_L); }
  k.wd({ kind: 'core', x: cx, y: top + 7, w: cw, h: fl - 8 - top - 7 });
  // conduits from the core out through the stern wall to the engines
  for (const y of [top + 12, fl - 20]) { R_(g, x0, y, cx - x0 - 1, 4, '#2a2230'); k.wd({ kind: 'conduit', x: x0, y: y + 1, w: cx - x0 - 1, dir: -1 }); }
  // consoles on the floor
  const c1 = console_(g, cx - 34, fl, 8, 11, '#5a4a3a');
  k.wd({ kind: 'screen', x: c1.x, y: c1.y, w: c1.w, h: 4, style: 'graph', col: '#ffb040' });
  k.st({ x: cx - 38, act: 'standConsole', dir: 1, dept: 'engineering', watches: [0, 1, 2], label: 'watching the plasma flow', crit: true });
  const c2 = console_(g, cx + cw + 14, fl, 8, 11, '#5a4a3a', -1);
  k.wd({ kind: 'screen', x: c2.x, y: c2.y, w: c2.w, h: 4, style: 'wave', col: '#7affc0' });
  k.st({ x: cx + cw + 26, act: 'standConsole', dir: -1, dept: 'engineering', watches: [0, 1, 2], label: 'balancing the injectors' });
  const dx = x0 + 22, c3 = console_(g, dx + 3, fl, 8, 7, '#4a4038');
  chair(g, dx, fl, 1, '#5a4a3a');
  k.wd({ kind: 'screen', x: c3.x, y: c3.y, w: c3.w, h: 2, style: 'text', col: '#ffc15a' });
  k.st({ x: dx, act: 'console', dir: 1, dept: 'engineering', watches: [0], label: "at the chief engineer's desk", rank: 1 });
  k.st({ x: cx - 10, act: 'clipboard', dir: 1, dept: 'engineering', watches: [0, 1], label: 'inspecting the core' });
  for (let i = 0; i < 6; i++) k.wd({ kind: 'blink', x: x0 + 20 + i * 5, y: fl - 16, c: R.pick(['#ff5a5a', '#5aff8a', '#ffd24a']) });
  r.panel = { x: cx - 20, y: fl };
  k.lights.push({ x: cx + cw / 2, y: (top + fl) / 2, r: 60, c: '#5ac8ff', a: .35, core: true });
}

function buildHangar(k) {
  const { g, f, x0, x1, top, fl, R, r } = k;
  wall(k, { b: '#33332c', d: '#2a2a24', l: '#3e3e35', t: '#5a5a48', f: '#4a4a44' }, { lampGap: 46, lampCol: '#fff0c8', trim: .95 });
  badge(k, 'drone', x0 + 3, top + 3);
  sign(k, 'BAY 1', x0 + 16, top + 3, '#e8c86a', '#2a2a24');
  for (const y of r.midFloors) { HL(g, x0, x0 + 30, y, '#6a6a6a'); HL(g, x0, x0 + 30, y - 6, '#8a7a5a'); for (let x = x0 + 2; x < x0 + 30; x += 7) VL(g, x, y - 5, y - 1, '#6a5a3a'); }
  stripes(g, x0 + 1, fl - 2, x1 - x0 - 2, 2);
  // the bay door in the floor: a hole down through the deck and hull, covered by sliding panels
  const bw = 34, bx = Math.round((x0 + x1) / 2 - bw / 2);
  r.bay = { x: bx, w: bw, y: fl, open: 0 };
  k.wd({ kind: 'baydoor', x: bx, y: fl, w: bw });
  // parked fighters
  const n = (x1 - x0) > 190 ? 3 : 2, spots = [];
  for (let i = 0; i < n; i++) spots.push(i === 0 ? x0 + 38 : i === 1 ? x1 - 44 : bx - 30);
  r.fighters = spots.map((x, i) => ({ home: x, x, y: fl, id: i, state: 'parked', col: R.pick(['#c8cdd8', '#d8c8a0', '#a8c8d8']) }));
  for (const fi of r.fighters) k.wd({ kind: 'fighter', ref: fi });
  // tool carts, fuel lines, a bench for pilots
  R_(g, x0 + 58, fl - 6, 8, 5, '#b83a2a'); HL(g, x0 + 58, x0 + 65, fl - 6, '#e05a3a'); PX(g, x0 + 59, fl - 1, DARK); PX(g, x0 + 64, fl - 1, DARK);
  VL(g, x1 - 6, top + 10, fl - 1, '#8a6a2a'); VL(g, x1 - 5, top + 10, fl - 1, '#c89a3a');
  const bench = x0 + 76;
  HL(g, bench - 5, bench + 5, fl - 3, '#5a5a6a'); VL(g, bench - 4, fl - 2, fl - 1, DARK); VL(g, bench + 4, fl - 2, fl - 1, DARK);
  const fc = console_(g, x1 - 20, fl, 7, 10, '#4a4a3a', -1);
  k.wd({ kind: 'screen', x: fc.x, y: fc.y, w: fc.w, h: 4, style: 'radar', col: '#7aff8a' });
  k.st({ x: x1 - 10, act: 'standConsole', dir: -1, dept: 'flight', watches: [0, 1, 2], label: 'running flight control' });
  r.fighters.forEach((fi, i) => {
    k.st({ x: fi.home + (i % 2 ? -17 : 17), act: 'mechanic', dir: i % 2 ? 1 : -1, dept: 'flight', watches: [0, 1], label: 'servicing a fighter', fighter: fi });
  });
  k.st({ x: bench - 2, act: 'sit', dir: 1, dept: 'flight', watches: [0, 1, 2], label: 'on standby for patrol', pilot: true, crit: true });
  k.st({ x: bench + 3, act: 'sit', dir: -1, dept: 'flight', watches: [0, 1], label: 'on standby for patrol', pilot: true });
  r.panel = { x: x0 + 50, y: fl };
}

function buildCargo(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.cargo, { lampGap: 42, trim: .92 });
  const tall = fl - top > 40;
  // crane rail across the top
  HL(g, x0, x1 - 1, top + 3, METAL_L); HL(g, x0, x1 - 1, top + 4, METAL_D);
  k.wd({ kind: 'crane', x0: x0 + 10, x1: x1 - 14, y: top + 5, fl });
  // stacks of crates
  const cols = ['#8a6a3a', '#6a7a4a', '#4a6a8a', '#9a4a3a', '#7a7a7a', '#b8904a'];
  let x = x0 + 4;
  while (x < x1 - 40) {
    const w = R.int(8, 14), stack = R.int(1, tall ? 5 : 3);
    let y = fl;
    for (let i = 0; i < stack; i++) { const h = R.int(5, 8); crate(g, x, y - h, w, h, R.pick(cols)); y -= h; }
    x += w + R.int(1, 6);
    if (R.chance(.25)) x += 16;
  }
  stripes(g, x1 - 36, fl - 2, 30, 2);
  k.wd({ kind: 'loader', x0: x0 + 10, x1: x1 - 12, fl });
  k.st({ x: x1 - 24, act: 'clipboard', dir: -1, dept: 'operations', watches: [0, 1], label: 'checking the manifest' });
  r.panel = { x: x1 - 10, y: fl };
}

function buildHydro(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.green, { lampGap: 30, lampCol: '#e0a0ff', trim: .95 });
  badge(k, 'leaf', x0 + 3, top + 3);
  const h = fl - top, tiers = h > 40 ? [fl - 3, fl - 18, fl - 33, fl - 48] : [fl - 3, fl - 14];
  const racks = [];
  for (let x = x0 + 14; x < x1 - 16; x += 30) racks.push(x);
  for (const rx of racks) {
    for (const ty of tiers) {
      if (ty < top + 8) continue;
      R_(g, rx, ty, 22, 2, '#5a4a3a'); HL(g, rx, rx + 21, ty, '#7a6048');
      for (let i = 1; i < 21; i += 2) { const hh = R.int(2, 5); VL(g, rx + i, ty - hh, ty - 1, R.pick(['#4a9a3a', '#6ac04a', '#3a7a2a'])); if (R.chance(.3)) PX(g, rx + i, ty - hh - 1, R.pick(['#e05a5a', '#ffd24a', '#e8e8e8'])); }
      HL(g, rx + 2, rx + 19, ty - 9, '#6a4a8a'); k.wd({ kind: 'grow', x: rx + 2, y: ty - 9, w: 18 });
    }
    VL(g, rx - 1, tiers[tiers.length - 1] - 10, fl - 1, METAL);
    k.st({ x: rx + 11, act: 'water', dir: R.chance(.5) ? 1 : -1, use: 'garden', dept: rx === racks[0] ? 'science' : null, watches: [0, 1], label: 'tending the tomatoes' });
  }
  if (h > 40) { // a little tree in the middle of the tall bay
    const tx = x1 - 12; R_(g, tx - 1, fl - 20, 3, 20, '#6a4a2a');
    for (let i = 0; i < 60; i++) { const a = R.range(0, 6.28), rr = R.range(0, 10); PX(g, tx + Math.round(Math.cos(a) * rr), fl - 28 + Math.round(Math.sin(a) * rr * .8), R.pick(['#3f7d3a', '#5aa04a', '#2e5e2c', '#7ac05a'])); }
  }
  VL(g, x0 + 8, top, fl - 1, '#3a7a5a'); VL(g, x0 + 9, top, fl - 1, '#57c49a');
  r.panel = { x: x0 + 8, y: fl };
}

function buildReady(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.command, { lampGap: 40 });
  if (r.edge) windowCut(k, r.edge > 0 ? x1 - 16 : x0 + 4, top + 4, 12, 10);
  const dx = x0 + Math.round((x1 - x0) * .5);
  table(g, dx, dx + 14, fl, 7, '#5a3a2a'); PX(g, dx + 3, fl - 8, '#e0d0a0'); PX(g, dx + 10, fl - 8, '#3fd6ff');
  chair(g, dx - 2, fl, 1, '#6a2a2a');
  k.st({ x: dx - 2, act: 'desk', dir: 1, dept: 'command', watches: [0], label: 'reviewing reports in the ready room', rank: 0, office: true });
  // fish tank
  const fx = x0 + 6; BOX(g, fx, fl - 16, 16, 9, '#123a5a', '#3a4a5a'); R_(g, fx, fl - 7, 16, 7, '#2a2a34');
  k.wd({ kind: 'fish', x: fx + 1, y: fl - 15, w: 14, h: 7 });
  shelf(g, x1 - 26, x1 - 6, top + 9, R, 'book');
  plant(g, x1 - 5, fl, R, true);
  k.st({ x: dx + 20, act: 'stand', dir: -1, use: 'visit', label: 'talking with the captain' });
}

function buildBriefing(k) {
  const { g, x0, x1, top, fl, R } = k;
  wall(k, WALLS.command, { lampGap: 36 });
  const tx0 = x0 + 14, tx1 = x1 - 14;
  table(g, tx0, tx1, fl, 7, '#3a4258'); HL(g, tx0 + 1, tx1 - 1, fl - 7, '#5a6a8a');
  k.wd({ kind: 'holo', x: Math.round((tx0 + tx1) / 2), y: fl - 8, style: 'ship' });
  BOX(g, x0 + 20, top + 3, x1 - x0 - 40, 8, '#0c1420', '#3d4a6a');
  k.wd({ kind: 'screen', x: x0 + 21, y: top + 4, w: x1 - x0 - 42, h: 6, style: 'map', col: '#7ab8ff' });
  const seats = [];
  for (let x = tx0 + 6; x <= tx1 - 6; x += 12) seats.push(x);
  seats.forEach((x, i) => { const d = i % 2 ? -1 : 1; chair(g, x - 3 * d, fl, d, '#3a3f52'); k.st({ x: x - 3 * d, act: 'meeting', dir: d, use: 'meeting', dept: i < 2 ? 'command' : null, watches: [0, 1], label: 'in a briefing' }); });
}

function buildCaptain(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.living, { lampGap: 40, lampCol: '#ffd9a0' });
  windowCut(k, x0 + Math.round((x1 - x0) / 2) - 9, top + 4, 18, 9);
  const bx = x1 - 26;
  bed(k, bx, fl, 20, '#7a2a3a', 'captain');
  const dx = x0 + 10;
  table(g, dx, dx + 12, fl, 7, '#5a3a2a'); PX(g, dx + 8, fl - 8, '#ffd24a'); chair(g, dx - 2, fl, 1, '#5a3a2a');
  k.st({ x: dx - 2, act: 'desk', dir: 1, use: 'desk', owner: 'captain', label: 'writing the log' });
  plant(g, x0 + 30, fl, R, true);
  BOX(g, x0 + 36, top + 5, 10, 7, '#7a5a3a', '#4a3020'); R_(g, x0 + 37, top + 6, 8, 5, '#3a6a8a'); PX(g, x0 + 41, top + 8, '#e8d8a0');
}

// a single bed with a blanket; the sleeper's station
function bed(k, x, fl, w, blanket, owner) {
  const { g } = k;
  R_(g, x, fl - 5, w, 2, '#e8e2d4'); R_(g, x, fl - 3, w, 3, '#4a3a2a'); VL(g, x - 1, fl - 9, fl - 1, '#3a2a1a');
  R_(g, x, fl - 6, 4, 1, '#f4f0e8');
  R_(g, x + 4, fl - 6, w - 4, 1, blanket); R_(g, x + 4, fl - 5, w - 4, 1, shade(blanket, -.2));
  return k.st({ x: x + w / 2 - 1, y: fl - 5, act: 'sleep', dir: -1, use: 'sleep', bed: true, owner, blanket, label: 'asleep' });
}

function buildOfficer(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.living, { lampGap: 40, lampCol: '#ffd9a0' });
  if (r.edge) windowCut(k, r.edge > 0 ? x1 - 14 : x0 + 3, top + 4, 10, 8);
  const flip = R.chance(.5), bx = flip ? x0 + 3 : x1 - 23;
  bed(k, bx, fl, 20, R.pick(['#3a5a8a', '#6a3a6a', '#3a6a5a', '#8a5a2a', '#5a5a6a']), 'officer');
  const dx = flip ? x1 - 22 : x0 + 8;
  table(g, dx, dx + 10, fl, 7, '#5a4a3a'); chair(g, dx - 2, fl, 1, '#4a4a5a'); PX(g, dx + 7, fl - 8, '#3fd6ff');
  k.st({ x: dx - 2, act: 'desk', dir: 1, use: 'desk', owner: 'officer', label: 'reading at their desk' });
  if (R.chance(.5)) { const gx = flip ? x1 - 6 : x0 + 3; R_(g, gx, top + 8, 2, 3, '#b8612a'); VL(g, gx, top + 3, top + 7, '#3a2418'); }
  else shelf(g, dx - 2, dx + 12, top + 9, R, 'book');
}

function buildBunks(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.living, { lampGap: 44, lampCol: '#ffd9a0' });
  badge(k, 'bunk', x0 + 3, top + 3);
  locker(g, x0 + 3, fl, 10, 12, '#5a6a7a');
  const frame = '#4a4a55', stacks = Math.floor((x1 - x0 - 34) / 18);
  const cols = ['#3a5a8a', '#6a3a4a', '#3a6a5a', '#8a6a3a', '#5a5a7a', '#7a4a6a', '#4a6a8a'];
  let x = x0 + 16;
  for (let s = 0; s < stacks; s++) {
    VL(g, x, top + 3, fl - 1, frame); VL(g, x + 15, top + 3, fl - 1, frame);
    for (const ty of [fl - 3, fl - 13]) {
      R_(g, x + 1, ty, 14, 2, '#3a3a44'); R_(g, x + 1, ty - 1, 14, 1, '#d8d2c4');
      const bl = R.pick(cols);
      R_(g, x + 4, ty - 2, 11, 1, bl); PX(g, x + 1, ty - 2, '#f0ece2'); PX(g, x + 2, ty - 2, '#f0ece2');
      k.f.fillStyle = frame; k.f.fillRect(x + 1, ty + 1, 14, 1);
      k.st({ x: x + 9, y: ty - 1, act: 'sleep', dir: -1, use: 'sleep', bed: true, owner: 'crew', blanket: bl, label: 'asleep', bunk: true, behind: true });
    }
    x += 18;
  }
  // a little table with a stool
  const tx = x + 3;
  if (x1 - tx > 12) { table(g, tx, tx + 8, fl, 6, '#6a5a4a'); stool(g, tx + 12, fl); k.st({ x: tx + 12, act: 'read', dir: -1, use: 'read', label: 'reading in quarters', home: true }); }
}

function buildMess(k) {
  const { g, f, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.warm, { lampGap: 32, lampCol: '#ffd59a' });
  badge(k, 'fork', x0 + 3, top + 3);
  if (r.edge) windowCut(k, r.edge > 0 ? x1 - 30 : x0 + 14, top + 4, 22, 8);
  // serving counter on the left (drawn in front of the server), a menu board and a coffee machine
  const cx = x0 + 4;
  R_(g, cx, fl - 20, 22, 5, '#6a5040'); for (let i = 0; i < 4; i++) R_(g, cx + 2 + i * 5, fl - 19, 3, 2, R.pick(['#e0a040', '#c05a3a', '#7ac05a', '#e8d8b0']));
  k.wd({ kind: 'steam', x: cx + 6, y: fl - 21, rate: .6 });
  R_(k.f, cx, fl - 9, 22, 9, '#7a5a40'); HL(k.f, cx, cx + 21, fl - 9, '#b8905a'); HL(k.f, cx, cx + 21, fl - 8, '#9a7048');
  k.st({ x: cx + 11, act: 'serve', dir: 1, dept: 'culinary', watches: [0, 1, 2], label: 'serving at the counter', crit: true, behind: true });
  r.counter = cx + 30;
  BOX(g, x0 + 30, top + 3, 24, 8, '#1a1410', '#4a3a2a'); drawText(g, 'MENU', x0 + 34, top + 5, '#ffcf6a');
  BOX(g, x1 - 10, fl - 14, 7, 14, '#3a3a44', '#1a1a20'); PX(g, x1 - 7, fl - 10, '#ff5a3a');
  k.st({ x: x1 - 14, act: 'stand', dir: 1, use: 'coffee', label: 'getting a coffee' });
  // tables with stools either side
  const tables = [];
  for (let x = x0 + 40; x < x1 - 30; x += 30) tables.push(x);
  for (const tx of tables) {
    table(g, tx, tx + 11, fl, 6, '#8a6a4a');
    for (const [sx, d] of [[tx - 3, 1], [tx + 14, -1]]) {
      stool(g, sx, fl, '#5a4a3a');
      k.st({ x: sx, act: 'eat', dir: d, use: 'eat', label: 'eating', tray: true });
    }
  }
}

function buildGalley(k) {
  const { g, x0, x1, top, fl, R } = k;
  wall(k, { b: '#8a8e94', d: '#7a7e84', l: '#9ca0a6', t: '#b8bcc2', f: '#6a6e74' }, { lampGap: 30 });
  // stove and oven
  const sx = x0 + 8;
  R_(g, sx, fl - 9, 18, 9, '#4a4f58'); HL(g, sx, sx + 17, fl - 9, '#8a92a0'); BOX(g, sx + 3, fl - 7, 12, 5, '#1a1c20', '#2a2c30');
  k.wd({ kind: 'oven', x: sx + 4, y: fl - 6, w: 10, h: 3 });
  for (const px of [sx + 2, sx + 10]) { R_(g, px, fl - 13, 6, 4, '#8a92a0'); HL(g, px - 1, px + 6, fl - 13, '#b8c0cc'); k.wd({ kind: 'steam', x: px + 3, y: fl - 14, rate: 1 }); }
  k.st({ x: sx + 8, act: 'cook', dir: -1, dept: 'culinary', watches: [0, 1], label: 'cooking dinner' });
  // chopping counter and fridge
  const cx = x1 - 30;
  R_(g, cx, fl - 8, 16, 8, '#6a6e78'); HL(g, cx, cx + 15, fl - 8, '#d8d0b8');
  PX(g, cx + 4, fl - 9, '#e05a3a'); PX(g, cx + 5, fl - 9, '#7ac05a'); PX(g, cx + 9, fl - 9, '#f0e0a0');
  k.st({ x: cx + 8, act: 'chop', dir: 1, dept: 'culinary', watches: [0, 1, 2], label: 'chopping vegetables' });
  BOX(g, x1 - 12, fl - 20, 10, 20, '#d8dce0', '#8a8e94'); HL(g, x1 - 11, x1 - 4, fl - 12, '#8a8e94'); PX(g, x1 - 10, fl - 16, '#5a5e64');
  for (let x = sx; x < sx + 18; x += 5) { VL(g, x, top + 2, top + 5, '#5a5e64'); R_(g, x - 1, top + 6, 3, 2, '#3a3e44'); }
}

function buildBar(k) {
  const { g, f, x0, x1, top, fl, R, r } = k;
  wall(k, { b: '#3a2a2a', d: '#2e2020', l: '#4a3432', t: '#6a4a3a', f: '#5a3a2a' }, { lampGap: 30, lampCol: '#ffb070' });
  // backlit bottle shelves behind the bar
  const bx0 = x0 + 6, bx1 = x0 + 50;
  R_(g, bx0, top + 3, bx1 - bx0, 14, '#2a1a14'); k.wd({ kind: 'glow', x: bx0, y: top + 3, w: bx1 - bx0, h: 14, c: '#ff9a4a' });
  shelf(g, bx0 + 1, bx1 - 2, top + 9, R, 'bottle'); shelf(g, bx0 + 1, bx1 - 2, top + 15, R, 'bottle');
  // the bar counter in front of the bartender
  R_(k.f, bx0, fl - 9, bx1 - bx0 + 4, 9, '#5a3420'); HL(k.f, bx0, bx1 + 3, fl - 9, '#b87a4a'); HL(k.f, bx0, bx1 + 3, fl - 8, '#8a5430');
  k.st({ x: bx0 + 14, act: 'bartend', dir: 1, dept: 'culinary', watches: [1, 2], label: 'tending bar', behind: true });
  for (let x = bx0 + 8; x <= bx1 + 6; x += 10) { stool(f, x + 4, fl, '#8a3a2a'); k.st({ x: x + 4, act: 'drink', dir: -1, use: 'drink', label: 'having a drink' }); }
  // a neon sign and a jukebox
  k.wd({ kind: 'neon', x: bx1 + 12, y: top + 4, text: 'OPEN' });
  const jx = x1 - 12; BOX(g, jx, fl - 15, 9, 15, '#6a2a4a', '#2a1020'); k.wd({ kind: 'jukebox', x: jx + 1, y: fl - 14 });
  if (x1 - bx1 > 50) { const tx = bx1 + 26; table(g, tx, tx + 8, fl, 6, '#6a4a2a'); for (const [sx, d] of [[tx - 3, 1], [tx + 11, -1]]) { chair(g, sx, fl, d, '#6a2a2a'); k.st({ x: sx, act: 'drink', dir: d, use: 'drink', label: 'chatting over a drink' }); } }
}

function buildLounge(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.fun, { lampGap: 36, lampCol: '#d8c0ff' });
  // couch facing a holo TV
  const cx = x0 + 6;
  R_(g, cx, fl - 7, 22, 5, '#6a3a5a'); R_(g, cx, fl - 11, 3, 9, '#5a2a4a'); R_(g, cx + 19, fl - 9, 3, 7, '#5a2a4a'); HL(g, cx + 3, cx + 18, fl - 7, '#8a5a7a');
  for (const sx of [cx + 7, cx + 14]) k.st({ x: sx, y: fl - 4, act: 'couch', dir: 1, use: 'tv', label: 'watching a holovid' });
  const tvx = cx + 28; BOX(g, tvx, top + 5, 16, 11, '#0c0c14', '#3a3a4a'); VL(g, tvx + 8, top + 16, fl - 1, METAL);
  k.wd({ kind: 'screen', x: tvx + 1, y: top + 6, w: 14, h: 9, style: 'tv', col: '#ff9ad0' });
  // pool table
  const px = tvx + 28;
  if (px + 30 < x1 - 20) {
    R_(g, px, fl - 7, 22, 2, '#2a7a4a'); R_(g, px - 1, fl - 5, 24, 1, '#5a3a2a'); VL(g, px + 1, fl - 4, fl - 1, '#3a2a1a'); VL(g, px + 20, fl - 4, fl - 1, '#3a2a1a');
    k.wd({ kind: 'pool', x: px + 2, y: fl - 8, w: 18 });
    k.st({ x: px - 3, act: 'pool', dir: 1, use: 'games', label: 'shooting pool' });
    k.st({ x: px + 25, act: 'pool', dir: -1, use: 'games', label: 'shooting pool' });
  }
  // arcade cabinet and a guitar corner
  const ax = x1 - 12;
  R_(g, ax, fl - 17, 8, 17, '#2a2a5a'); R_(g, ax + 1, fl - 16, 6, 5, '#0a0a14'); HL(g, ax, ax + 7, fl - 9, '#5a5a9a');
  k.wd({ kind: 'screen', x: ax + 1, y: fl - 16, w: 6, h: 5, style: 'game', col: '#7aff5a' });
  k.st({ x: ax - 3, act: 'arcade', dir: 1, use: 'games', label: 'playing Asteroid Miner' });
  if (x1 - x0 > 120) { stool(g, ax - 14, fl, '#5a4a6a'); k.st({ x: ax - 14, act: 'guitar', dir: -1, use: 'music', label: 'playing the guitar' }); }
  plant(g, tvx + 20, fl, R, true);
}

function buildObservation(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, { b: '#1c1a2c', d: '#161424', l: '#242038', t: '#3a3456', f: '#3a3050' }, { lampGap: 60, lampCol: '#b0a0ff' });
  // most of the back wall is window
  const wx0 = x0 + 6, wx1 = x1 - 6, n = Math.max(2, Math.round((wx1 - wx0) / 26));
  for (let i = 0; i < n; i++) { const a = Math.round(wx0 + i * (wx1 - wx0) / n), b = Math.round(wx0 + (i + 1) * (wx1 - wx0) / n); windowCut(k, a + 1, top + 3, b - a - 2, fl - top - 12, '#3a3456'); }
  for (let i = 0; i < n; i++) {
    const cx = Math.round(wx0 + (i + .5) * (wx1 - wx0) / n);
    if (i % 2) { R_(g, cx - 6, fl - 4, 12, 2, '#4a4060'); HL(g, cx - 6, cx + 5, fl - 4, '#6a5a8a'); VL(g, cx - 5, fl - 2, fl - 1, DARK); VL(g, cx + 4, fl - 2, fl - 1, DARK); k.st({ x: cx - 1, y: fl - 2, act: 'sitback', dir: 1, use: 'view', label: 'watching the stars' }); }
    else k.st({ x: cx, act: 'look', dir: 1, use: 'view', label: 'gazing out at the stars' });
  }
  plant(g, x0 + 3, fl, R, true); plant(g, x1 - 4, fl, R, true);
}

function buildLibrary(k) {
  const { g, x0, x1, top, fl, R } = k;
  wall(k, WALLS.warm, { lampGap: 30, lampCol: '#ffd59a' });
  for (let y = top + 7; y < fl - 4; y += 7) shelf(g, x0 + 4, x1 - 5, y, R, 'book');
  // reading chairs and a study desk in front of the shelves
  for (const [ax, d] of [[x0 + 14, 1], [x1 - 14, -1]]) {
    R_(g, ax - 3, fl - 4, 7, 3, '#7a3a2a'); VL(g, ax - 4 * d, fl - 9, fl - 2, '#6a2a1a'); VL(g, ax - 4 * d + d, fl - 9, fl - 5, '#6a2a1a');
    k.st({ x: ax, y: fl - 2, act: 'read', dir: d, use: 'read', label: 'reading a paper book' });
  }
  const dx = Math.round((x0 + x1) / 2);
  table(g, dx, dx + 10, fl, 7, '#5a3a2a'); PX(g, dx + 8, fl - 8, '#ffe07a'); VL(g, dx + 8, fl - 11, fl - 9, METAL_L); chair(g, dx - 2, fl, 1, '#4a3a2a');
  k.lights.push({ x: dx + 8, y: fl - 10, r: 8, c: '#ffe07a', a: .35 });
  k.st({ x: dx - 2, act: 'desk', dir: 1, use: 'read', label: 'studying' });
}

function buildChapel(k) {
  const { g, x0, x1, top, fl, R } = k;
  wall(k, { b: '#2a2438', d: '#221d2e', l: '#332c44', t: '#4a4060', f: '#4a3a5a' }, { lamps: [], trim: .99 });
  // a round window of coloured glass
  const cx = Math.round((x0 + x1) / 2), cy = top + 9;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const d = Math.hypot(i, j); if (d < 6.5) PX(g, cx + i, cy + j, d > 5.5 ? '#6a5a4a' : ['#c04a6a', '#4a6ac0', '#d8b04a', '#4ab07a'][((i > 0) + (j > 0) * 2)]); }
  k.lights.push({ x: cx, y: cy, r: 18, c: '#c8a0ff', a: .25 });
  R_(g, cx - 5, fl - 5, 10, 5, '#4a3a5a'); HL(g, cx - 5, cx + 4, fl - 5, '#7a6a8a');
  for (const x of [cx - 3, cx + 2]) k.wd({ kind: 'candle', x, y: fl - 6 });
  for (const [x, d] of [[x0 + 10, 1], [x1 - 10, -1]]) { R_(g, x - 3, fl - 1, 7, 1, '#7a4a8a'); k.st({ x, act: 'meditate', dir: d, use: 'quiet', label: 'meditating' }); }
}

function buildGym(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.gym, { lampGap: 34, lampCol: '#e8f4ff' });
  stripes(g, x0 + 1, top + 3, x1 - x0 - 2, 1, '#e8c83a', '#2f3e48');
  let x = x0 + 6;
  // two treadmills
  for (let i = 0; i < 2; i++) {
    R_(g, x, fl - 3, 16, 3, '#2a2e36'); VL(g, x + 15, fl - 12, fl - 3, METAL); R_(g, x + 13, fl - 13, 4, 2, '#3a4250'); PX(g, x + 14, fl - 13, '#5aff8a');
    k.wd({ kind: 'tread', x: x + 1, y: fl - 3, w: 13 });
    k.st({ x: x + 7, y: fl - 3, act: 'run', dir: 1, use: 'exercise', label: 'running on the treadmill', tread: true });
    x += 20;
  }
  // weight rack and bench
  R_(g, x + 2, fl - 4, 12, 2, '#3a3a44'); VL(g, x + 3, fl - 2, fl - 1, DARK); VL(g, x + 12, fl - 2, fl - 1, DARK);
  VL(g, x, fl - 14, fl - 1, METAL); VL(g, x + 14, fl - 14, fl - 1, METAL);
  k.st({ x: x + 7, act: 'lift', dir: 1, use: 'exercise', label: 'lifting weights' });
  x += 22;
  // punching bag
  VL(g, x + 4, top, top + 4, METAL);
  k.wd({ kind: 'bag', x: x + 4, y: top + 5 });
  k.st({ x: x - 1, act: 'punch', dir: 1, use: 'exercise', label: 'working the heavy bag', bag: true });
  x += 16;
  // pull-up bar
  if (x < x1 - 30) {
    HL(g, x, x + 10, fl - 16, METAL_L); VL(g, x, fl - 16, fl - 1, METAL); VL(g, x + 10, fl - 16, fl - 1, METAL);
    k.st({ x: x + 5, act: 'pullup', dir: 1, use: 'exercise', label: 'doing pull-ups' });
    x += 16;
  }
  // mats for stretching
  for (; x < x1 - 14; x += 16) { R_(g, x, fl - 1, 12, 1, R.pick(['#4a8a7a', '#8a4a6a', '#4a6a9a'])); k.st({ x: x + 6, act: 'stretch', dir: R.chance(.5) ? 1 : -1, use: 'exercise', label: 'stretching' }); }
  // water cooler
  BOX(g, x1 - 8, fl - 12, 6, 12, '#d8e0e8', '#8a929c'); R_(g, x1 - 7, fl - 16, 4, 4, '#6ac8ff');
}

function buildArmory(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.sec, { lampGap: 36, lampCol: '#ffe0c0' });
  badge(k, 'target', x0 + 3, top + 3);
  // weapon racks
  const rx = x0 + 4;
  R_(g, rx, top + 12, 26, 11, '#2a2024'); for (let i = 0; i < 6; i++) { VL(g, rx + 2 + i * 4, top + 13, top + 21, METAL_D); PX(g, rx + 2 + i * 4, top + 13, METAL_L); PX(g, rx + 3 + i * 4, top + 17, '#5a3a2a'); }
  // armorer's bench
  const bx = rx + 30;
  table(g, bx, bx + 12, fl, 7, '#4a4a52'); PX(g, bx + 4, fl - 8, METAL_L); PX(g, bx + 5, fl - 8, METAL_L); PX(g, bx + 6, fl - 8, METAL_D);
  k.st({ x: bx - 3, act: 'armorer', dir: 1, dept: 'security', watches: [0, 1], label: 'cleaning a rifle' });
  // the range: shooting lanes out to targets at the far wall
  const lane0 = bx + 20, tgt = x1 - 5;
  VL(g, lane0 + 4, fl - 10, fl - 1, '#6a5a3a'); HL(g, lane0 + 2, lane0 + 6, fl - 10, '#8a7a5a');
  stripes(g, lane0 + 8, fl - 1, tgt - lane0 - 10, 1, '#c83a2a', '#2a2a2a');
  r.targets = [];
  // two lanes, one behind the other: a standing shooter and a kneeling one further up the range
  for (let i = 0; i < 2; i++) {
    const ty = i ? fl - 6 : fl - 8, t = { x: tgt - (i ? 10 : 0), y: ty };
    r.targets.push(t);
    k.wd({ kind: 'target', x: t.x - 2, y: ty - 3, ref: t });
    k.st({ x: lane0 + i * 16, act: 'shoot', dir: 1, use: 'practice', dept: i === 0 ? 'security' : null, watches: [0, 1, 2], label: 'at target practice', target: t, lane: i, kneel: i === 1 });
  }
}

function buildSecurity(k) {
  const { g, x0, x1, top, fl, R } = k;
  wall(k, WALLS.sec, { lampGap: 36 });
  badge(k, 'door', x0 + 3, top + 3);
  // a wall of camera monitors
  const mx = x0 + 16;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { BOX(g, mx + i * 9, top + 4 + j * 7, 8, 6, '#0c1014', '#3a3a44'); k.wd({ kind: 'screen', x: mx + i * 9 + 1, y: top + 5 + j * 7, w: 6, h: 4, style: 'cam', col: '#9affb0' }); }
  const dx = mx + 6; table(g, dx, dx + 14, fl, 7, '#3a3a44'); chair(g, dx - 2, fl, 1, '#2a2a34');
  k.st({ x: dx - 2, act: 'console', dir: 1, dept: 'security', watches: [0, 1, 2], label: 'watching the monitors', crit: true });
  locker(g, x1 - 14, fl, 11, 18, '#5a4a4a');
}

function buildBrig(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.sec, { lampGap: 40 });
  // guard desk on the left, two cells on the right behind force fields
  const dx = x0 + 10; table(g, dx, dx + 10, fl, 7, '#3a3a44'); chair(g, dx - 2, fl, 1, '#2a2a34'); PX(g, dx + 6, fl - 8, '#3fd6ff');
  k.st({ x: dx - 2, act: 'console', dir: 1, dept: 'security', watches: [0, 1, 2], label: 'guarding the brig' });
  const cw = 24, c0 = x1 - cw * 2 - 2;
  r.cells = [];
  for (let i = 0; i < 2; i++) {
    const cx = c0 + i * cw;
    R_(g, cx, top, 2, fl - top, METAL_D); R_(g, cx, fl - 1, cw, 1, '#2a2a30');
    R_(g, cx + 6, fl - 4, 14, 2, '#4a4a52'); VL(g, cx + 7, fl - 2, fl - 1, DARK); VL(g, cx + 18, fl - 2, fl - 1, DARK);
    k.wd({ kind: 'field', x: cx + 2, y: top + 1, h: fl - top - 2 });
    r.cells.push({ x0: cx + 4, x1: cx + cw - 3, bench: cx + 13, y: fl - 4 });
  }
}

function buildMedbay(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.med, { lampGap: 30, lampCol: '#f0faff' });
  badge(k, 'med', x0 + 3, top + 3);
  // medicine cabinet
  BOX(g, x0 + 16, top + 4, 18, 9, '#c8e0e8', '#6a8a94'); for (let i = 0; i < 6; i++) { const c = ['#e05a5a', '#5a9ae0', '#e0c05a', '#7ac07a'][i % 4]; R_(g, x0 + 18 + i * 2 + (i > 2 ? 2 : 0), top + 6, 1, 2, c); R_(g, x0 + 18 + i * 2, top + 10, 1, 2, c); }
  const n = (x1 - x0) > 128 ? 3 : 2, bw = 20;
  for (let i = 0; i < n; i++) {
    const bx = x1 - 8 - (i + 1) * (bw + 12);
    R_(g, bx, fl - 7, bw, 2, '#e8eef0'); R_(g, bx, fl - 5, bw, 1, '#8a9aa4'); VL(g, bx + 2, fl - 4, fl - 1, METAL); VL(g, bx + bw - 3, fl - 4, fl - 1, METAL);
    R_(g, bx, fl - 8, 4, 1, '#ffffff');
    BOX(g, bx + 4, top + 4, 12, 7, '#0a1a14', '#6a8a94'); k.wd({ kind: 'heart', x: bx + 5, y: top + 5, w: 10, h: 5, bed: i });
    k.st({ x: bx + bw / 2, y: fl - 7, act: 'patient', dir: -1, use: 'checkup', bed: false, blanket: '#9ad0e0', label: 'getting a checkup', medbed: i });
    if (i === 0) k.st({ x: bx + bw + 4, act: 'scan', dir: -1, dept: 'medical', watches: [0, 1, 2], label: 'treating a patient', crit: true });
  }
  k.st({ x: x0 + 26, act: 'clipboard', dir: 1, dept: 'medical', watches: [0, 1], label: 'checking the medicine stores' });
  const lx = x1 - 8 - bw / 2 - 12; VL(g, lx, top, top + 3, METAL); R_(g, lx - 3, top + 4, 7, 2, '#dfe9ec');
}

function buildLab(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.sci, { lampGap: 32, lampCol: '#d0fff0' });
  // bench with glassware
  const bx = x0 + 8;
  R_(g, bx, fl - 8, 26, 8, '#3a4a50'); HL(g, bx, bx + 25, fl - 8, '#dfe9ec');
  for (let i = 0; i < 4; i++) { const c = R.pick(['#8ef0c8', '#f08ec8', '#c8f08e', '#8ec8f0']); R_(g, bx + 3 + i * 6, fl - 12, 2, 4, c); PX(g, bx + 3 + i * 6, fl - 13, '#dfe9ec'); k.wd({ kind: 'bubbles', x: bx + 3 + i * 6, y: fl - 12, c }); }
  k.st({ x: bx + 13, act: 'lab', dir: -1, dept: 'science', watches: [0, 1], label: 'running an experiment' });
  // specimen tank
  const tx = bx + 34; BOX(g, tx, fl - 20, 12, 20, '#1a4a3a', '#4a6a6a'); R_(g, tx + 1, fl - 19, 10, 17, '#2a8a6a');
  k.wd({ kind: 'specimen', x: tx + 1, y: fl - 19, w: 10, h: 17 });
  // microscope and a terminal
  const mx = tx + 20;
  table(g, mx, mx + 10, fl, 7, '#3a4a50'); VL(g, mx + 5, fl - 11, fl - 8, METAL); PX(g, mx + 6, fl - 11, METAL_L); PX(g, mx + 4, fl - 9, METAL_L);
  stool(g, mx - 3, fl, '#4a5a60');
  k.st({ x: mx - 3, act: 'micro', dir: 1, dept: 'science', watches: [0, 1], label: 'peering into a microscope' });
  if (x1 - mx > 34) { const c = console_(g, x1 - 16, fl, 8, 10, '#2e4a58'); k.wd({ kind: 'screen', x: c.x, y: c.y, w: c.w, h: 4, style: 'dna', col: '#7affc0' }); }
  r.panel = { x: x1 - 10, y: fl };
}

function buildAstro(k) {
  const { g, x0, x1, top, fl, R } = k;
  wall(k, { b: '#141c2a', d: '#101622', l: '#1a2436', t: '#2a3a56', f: '#2a3040' }, { lamps: [], trim: .99 });
  const cx = Math.round((x0 + x1) / 2);
  R_(g, cx - 8, fl - 3, 16, 3, '#2a3a56'); HL(g, cx - 8, cx + 7, fl - 3, '#5a8aba');
  k.wd({ kind: 'holo', x: cx, y: fl - 4, style: 'stars' });
  for (const [px, d] of [[x0 + 12, 1], [x1 - 12, -1]]) {
    const c = console_(g, d > 0 ? px + 3 : px - 10, fl, 7, 9, '#2a3a56', d);
    k.wd({ kind: 'screen', x: c.x, y: c.y, w: c.w, h: 3, style: 'graph', col: '#9ab8ff' });
    k.st({ x: px, act: 'standConsole', dir: d, dept: d > 0 ? 'science' : 'command', watches: d > 0 ? [0, 1] : [0], label: 'charting nearby stars' });
  }
}

function buildComms(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.command, { lampGap: 36 });
  badge(k, 'eye', x0 + 3, top + 3);
  const rx = x0 + 16; BOX(g, rx, top + 3, 16, 13, '#061008', '#3a4a3a'); k.wd({ kind: 'radar', x: rx + 8, y: top + 9, r: 5 });
  for (let i = 0; i < 2; i++) {
    const cx = x0 + 44 + i * 26;
    if (cx + 14 > x1) break;
    const c = console_(g, cx + 3, fl, 8, 8, '#2e3a58'); chair(g, cx, fl, 1, '#3a3f52');
    k.wd({ kind: 'screen', x: c.x, y: c.y, w: c.w, h: 3, style: i ? 'wave' : 'text', col: i ? '#ffc15a' : '#57e3ff' });
    k.st({ x: cx, act: 'console', dir: 1, dept: 'operations', watches: i ? [0, 1] : [0, 1, 2], label: i ? 'monitoring subspace chatter' : 'scanning the sector', headset: true });
  }
  for (let i = 0; i < 8; i++) k.wd({ kind: 'blink', x: x1 - 12 + (i % 2) * 3, y: top + 4 + (i >> 1) * 3, c: R.pick(['#5aff8a', '#ffd24a', '#5ac8ff']) });
  r.panel = { x: x1 - 10, y: fl };
}

function buildWorkshop(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.eng, { lampGap: 32 });
  // tool wall
  const tw = x0 + 4; R_(g, tw, top + 4, 26, 12, '#4a3a30');
  for (let i = 0; i < 9; i++) { const c = R.pick(['#c8c8c8', '#d84a3a', '#e8c83a', '#3a8ad8']); VL(g, tw + 2 + i * 3, top + 6, top + 6 + R.int(3, 7), c); }
  // welding bench
  const wb = x0 + 34;
  table(g, wb, wb + 14, fl, 7, '#5a5a62'); R_(g, wb + 3, fl - 10, 6, 3, '#8a6a4a');
  k.st({ x: wb - 3, act: 'weld', dir: 1, dept: 'engineering', watches: [0, 1], label: 'welding a bracket', sparks: { x: wb + 3, y: fl - 9 } });
  // lathe
  const lx = wb + 24;
  if (lx + 16 < x1 - 10) {
    R_(g, lx, fl - 9, 14, 9, '#3a5a4a'); HL(g, lx, lx + 13, fl - 9, '#5a8a6a'); k.wd({ kind: 'lathe', x: lx + 3, y: fl - 12, w: 8 });
    k.st({ x: lx - 3, act: 'standConsole', dir: 1, dept: 'engineering', watches: [0, 1], label: 'turning a part on the lathe' });
  }
  for (let x = lx + 20; x < x1 - 8; x += 9) crate(g, x, fl - 6, 7, 6, R.pick(['#6a5a3a', '#5a6a7a', '#8a4a3a']));
  r.panel = { x: x1 - 8, y: fl };
}

function buildLifeSupport(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.eng, { lampGap: 40, lampCol: '#c8ffd0' });
  badge(k, 'o2', x0 + 3, top + 3);
  // big fans in ducts
  for (let i = 0; i < 2; i++) { const fx = x0 + 24 + i * 22; BOX(g, fx - 9, top + 3, 19, 17, '#2a2e36', '#4a5060'); k.wd({ kind: 'fan', x: fx, y: top + 11, r: 7 }); }
  // oxygen tanks
  for (let x = x0 + 66; x < x1 - 20; x += 7) { R_(g, x, fl - 16, 5, 16, '#3a8a5a'); HL(g, x + 1, x + 3, fl - 16, '#8ae0a0'); VL(g, x + 1, fl - 15, fl - 2, '#5ab07a'); }
  const c = console_(g, x1 - 14, fl, 8, 10, '#3a4a3a', -1); k.wd({ kind: 'screen', x: c.x, y: c.y, w: c.w, h: 4, style: 'graph', col: '#9aff9a' });
  k.st({ x: x1 - 3 > c.x + 12 ? c.x + 12 : x1 - 4, act: 'standConsole', dir: -1, dept: 'operations', watches: [0, 1, 2], label: 'checking the air mix' });
  r.panel = { x: x0 + 18, y: fl };
}

function buildWater(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.sci, { lampGap: 40 });
  badge(k, 'drop', x0 + 3, top + 3);
  for (let i = 0; i < 2; i++) { const tx = x0 + 16 + i * 22; BOX(g, tx, fl - 20, 18, 20, '#10202a', '#5a6a74'); k.wd({ kind: 'tank', x: tx + 1, y: fl - 19, w: 16, h: 18, phase: i }); }
  const px = x0 + 64; R_(g, px, fl - 10, 8, 10, '#4a5a64'); k.wd({ kind: 'piston', x: px + 3, y: fl - 10 });
  HL(g, x0 + 2, x1 - 3, top + 3, '#3a8a6a'); HL(g, x0 + 2, x1 - 3, top + 4, '#57c49a');
  k.st({ x: px + 14, act: 'clipboard', dir: -1, dept: 'operations', watches: [0, 1], label: 'testing the water' });
  r.panel = { x: px - 4, y: fl };
}

function buildPower(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.eng, { lampGap: 40, lampCol: '#ffe8a0' });
  badge(k, 'bolt', x0 + 3, top + 3);
  for (let i = 0; i < 2; i++) { const cx = x0 + 18 + i * 16; R_(g, cx, fl - 18, 10, 18, '#3a3a44'); for (let y = fl - 16; y < fl - 2; y += 2) HL(g, cx + 1, cx + 8, y, '#b8804a'); k.wd({ kind: 'coil', x: cx + 5, y: fl - 20 }); }
  R_(g, x0, top + 8, x1 - x0, 3, '#2a2230'); k.wd({ kind: 'conduit', x: x0, y: top + 9, w: x1 - x0, dir: 1 });
  const c = console_(g, x1 - 14, fl, 8, 10, '#4a4038', -1); k.wd({ kind: 'screen', x: c.x, y: c.y, w: c.w, h: 4, style: 'wave', col: '#ffe45a' });
  k.st({ x: x1 - 4 > c.x + 12 ? c.x + 12 : x1 - 4, act: 'standConsole', dir: -1, dept: 'engineering', watches: [0, 1], label: 'rerouting plasma' });
  r.panel = { x: x0 + 14, y: fl };
}

function buildComputer(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.dark, { lampGap: 50, lampCol: '#a0e0ff' });
  badge(k, 'chip', x0 + 3, top + 3);
  const cx = Math.round((x0 + x1) / 2);
  for (let x = x0 + 4; x < x1 - 4; x += 10) {
    if (Math.abs(x + 3 - cx) < 9) continue;
    R_(g, x, top + 2, 7, fl - top - 2, '#1a1e26'); VL(g, x, top + 2, fl - 1, '#3a404c');
    k.wd({ kind: 'leds', x: x + 2, y: top + 4, w: 4, h: fl - top - 8 });
  }
  R_(g, cx - 4, top, 8, fl - top, '#10141c'); k.wd({ kind: 'pillar', x: cx - 3, y: top, w: 6, h: fl - top });
  k.st({ x: cx + 9, act: 'standConsole', dir: -1, dept: 'operations', watches: [0, 1, 2], label: 'defragmenting the core' });
  r.panel = { x: cx - 9, y: fl };
}

function buildShields(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.dark, { lampGap: 50 });
  badge(k, 'shield', x0 + 3, top + 3);
  const cx = Math.round((x0 + x1) / 2);
  R_(g, cx - 8, fl - 4, 16, 4, '#3a404c'); HL(g, cx - 8, cx + 7, fl - 4, '#6a7488');
  k.wd({ kind: 'orb', x: cx, y: fl - 13, r: 6 });
  for (const x of [x0 + 6, x1 - 13]) { R_(g, x, fl - 14, 7, 14, '#2a3a4a'); for (let y = fl - 12; y < fl - 1; y += 3) HL(g, x + 1, x + 5, y, '#5ae0ff'); }
  k.st({ x: cx - 16, act: 'clipboard', dir: 1, dept: 'engineering', watches: [0, 1], label: 'tuning the shield harmonics' });
  r.panel = { x: cx + 14, y: fl };
}

function buildTransporter(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.command, { lampGap: 40 });
  badge(k, 'tele', x0 + 3, top + 3);
  const px0 = x1 - 44;
  R_(g, px0 - 2, fl - 3, 42, 3, '#3a4258'); HL(g, px0 - 2, px0 + 39, fl - 3, '#6a7a9a');
  r.pads = [];
  for (let i = 0; i < 3; i++) {
    const cx = px0 + 6 + i * 13;
    HL(g, cx - 4, cx + 4, fl - 3, '#b0f0ff'); HL(g, cx - 4, cx + 4, top + 1, '#b0f0ff'); R_(g, cx - 5, top, 11, 2, '#3a4258');
    r.pads.push({ x: cx, y: fl - 3, beam: 0 });
  }
  k.wd({ kind: 'pads', ref: r.pads, top });
  const c = console_(g, x0 + 16, fl, 8, 10, '#3a4560'); k.wd({ kind: 'screen', x: c.x, y: c.y, w: c.w, h: 4, style: 'graph', col: '#b0f0ff' });
  k.st({ x: x0 + 12, act: 'standConsole', dir: 1, dept: 'operations', watches: [0, 1, 2], label: 'at the transporter controls', transporter: true });
  r.panel = { x: x0 + 30, y: fl };
}

function buildTorpedo(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.sec, { lampGap: 40 });
  // tubes in the forward wall, a rack of torpedoes and a loading cart
  const tx = r.edge > 0 ? x1 - 16 : x0 + 2;
  for (let i = 0; i < 2; i++) { const y = top + 5 + i * 9; BOX(g, tx, y, 14, 6, '#1a1c22', '#6a7280'); HL(g, tx + 1, tx + 12, y + 2, '#2a2e36'); }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) { const x = x0 + 8 + i * 18, y = fl - 5 - j * 6; R_(g, x, y, 14, 3, '#6a7280'); PX(g, x + 13, y + 1, '#ff5a3a'); HL(g, x, x + 13, y, '#9aa4b4'); }
  R_(g, x0 + 44, fl - 4, 16, 2, '#5a5a44'); PX(g, x0 + 45, fl - 1, DARK); PX(g, x0 + 58, fl - 1, DARK);
  k.st({ x: x0 + 40, act: 'clipboard', dir: 1, dept: 'security', watches: [0, 1], label: 'checking the torpedo tubes' });
  r.panel = { x: x0 + 64, y: fl };
}

function buildGunnery(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.sec, { lampGap: 60 });
  const cx = Math.round((x0 + x1) / 2);
  R_(g, cx - 1, top, 3, fl - top - 12, METAL_D);
  BOX(g, cx - 8, top + 4, 16, 9, '#081008', '#4a3a3a'); k.wd({ kind: 'screen', x: cx - 7, y: top + 5, w: 14, h: 7, style: 'aim', col: '#ff6a5a' });
  chair(g, cx - 4, fl, 1, '#4a2a2a');
  k.st({ x: cx - 4, act: 'gunner', dir: 1, dept: 'security', watches: [0, 1], label: 'manning the gun battery' });
}

function buildEscape(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.hall, { lampGap: 40, lampCol: '#ffb0a0' });
  sign(k, 'ESCAPE', x0 + 4, top + 3, '#ff8a6a');
  for (let i = 0; i < 2; i++) {
    const px = x0 + 10 + i * 22;
    R_(g, px, fl - 18, 16, 18, '#2a2e36'); R_(g, px + 2, fl - 16, 12, 14, '#e8e2d0'); R_(g, px + 3, fl - 17, 10, 1, '#e8e2d0');
    BOX(g, px + 5, fl - 13, 6, 5, '#3a6a8a', '#8a8a8a'); stripes(g, px, fl - 2, 16, 2, '#e05a3a', '#e8e2d0');
  }
  k.wd({ kind: 'blink', x: x0 + 6, y: top + 13, c: '#ff5a3a' });
}

function buildLaundry(k) {
  const { g, x0, x1, top, fl, R } = k;
  wall(k, WALLS.hall, { lampGap: 36 });
  let x = x0 + 4;
  for (let i = 0; i < 3 && x < x1 - 34; i++, x += 14) {
    BOX(g, x, fl - 13, 12, 13, '#e0e4e8', '#8a929c'); R_(g, x + 1, fl - 12, 10, 2, '#b8c0c8');
    k.wd({ kind: 'drum', x: x + 6, y: fl - 5, r: 3 });
    k.st({ x: x + 6, act: 'laundry', dir: 1, use: 'chores', label: 'doing laundry', machine: true });
  }
  table(g, x + 4, x + 20, fl, 7, '#8a7a6a');
  for (let i = 0; i < 4; i++) R_(g, x + 6 + i * 3, fl - 9, 2, 2, R.pick(['#e05a5a', '#5a9ae0', '#e8e8e8', '#5ac07a']));
  k.st({ x: x + 12, act: 'fold', dir: 1, use: 'chores', dept: 'operations', watches: [0], label: 'folding towels' });
}

function buildWashroom(k) {
  const { g, f, x0, x1, top, fl, R } = k;
  wall(k, { b: '#8fa6ae', d: '#7d949c', l: '#a2b8c0', t: '#c0d4da', f: '#6a8088' }, { lampGap: 30 });
  for (let y = top + 3; y < fl - 2; y += 4) for (let x = x0; x < x1; x++) if ((x + (y >> 2)) % 4 === 0) PX(g, x, y, '#7d949c');
  // showers with doors in front of whoever is inside
  for (let i = 0; i < 2; i++) {
    const sx = x0 + 4 + i * 15;
    VL(g, sx + 6, top + 3, top + 5, METAL_L); PX(g, sx + 5, top + 5, METAL_L);
    R_(f, sx, fl - 12, 13, 12, '#c8d8e0'); HL(f, sx, sx + 12, fl - 12, '#e8f4f8'); VL(f, sx, fl - 12, fl - 1, METAL); VL(f, sx + 12, fl - 12, fl - 1, METAL);
    k.wd({ kind: 'shower', x: sx + 6, y: top + 6, h: fl - top - 18 });
    k.st({ x: sx + 6, act: 'shower', dir: 1, use: 'hygiene', label: 'in the shower', shower: true, behind: true });
  }
  const mx = x0 + 36;
  if (mx + 12 < x1) {
    BOX(g, mx, top + 5, 10, 8, '#c8e0f0', '#8a9aa4'); R_(g, mx, fl - 9, 10, 2, '#e8eef0'); VL(g, mx + 5, fl - 7, fl - 1, METAL);
    k.st({ x: mx - 2, act: 'sink', dir: 1, use: 'hygiene', label: 'brushing their teeth' });
  }
}

function buildStorage(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.cargo, { lampGap: 40, trim: .95 });
  for (let y = top + 8; y < fl - 4; y += 8) shelf(g, x0 + 3, x1 - 4, y, R);
  for (let x = x0 + 3; x < x1 - 8; x += 9) if (R.chance(.6)) crate(g, x, fl - 5, 7, 5, R.pick(['#8a6a3a', '#6a7a4a', '#5a6a7a']));
  if (x1 - x0 > 60) k.st({ x: x1 - 8, act: 'clipboard', dir: -1, dept: 'operations', watches: [0], label: 'taking inventory' });
  r.panel = { x: x0 + 8, y: fl };
}

function buildPassage(k) {
  const { g, x0, x1, top, fl, R } = k;
  wall(k, WALLS.hall, { lampGap: 30 });
  // lockers, a bench, a vending machine and a noticeboard: somewhere to pass the time between rooms
  let x = x0 + 3;
  if (R.chance(.6)) { locker(g, x, fl, 10, 16, R.pick(['#5a6a7a', '#6a5a4a', '#4a6a5a'])); x += 13; }
  const vx = x;
  BOX(g, vx, fl - 17, 10, 17, '#3a4a6a', '#1a2030'); R_(g, vx + 1, fl - 16, 5, 11, '#0c1420');
  for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) PX(g, vx + 2 + i * 2, fl - 15 + j * 3, R.pick(['#e05a3a', '#ffd24a', '#5ac07a', '#5a9ae0']));
  PX(g, vx + 8, fl - 12, '#5aff8a'); R_(g, vx + 7, fl - 6, 2, 2, '#10131a');
  k.st({ x: vx + 13, act: 'stand', dir: -1, use: 'snack', label: 'buying a snack' });
  x = vx + 16;
  if (x1 - x > 16) {
    HL(g, x + 1, x + 11, fl - 3, '#6a5a4a'); VL(g, x + 2, fl - 2, fl - 1, DARK); VL(g, x + 10, fl - 2, fl - 1, DARK);
    k.st({ x: x + 4, act: 'sit', dir: 1, use: 'chat', label: 'chatting in the corridor' });
    k.st({ x: x + 9, act: 'sit', dir: -1, use: 'chat', label: 'chatting in the corridor' });
    BOX(g, x + 2, top + 5, 10, 8, '#8a6a4a', '#5a4030');
    for (let i = 0; i < 4; i++) R_(g, x + 3 + (i % 2) * 4, top + 6 + (i >> 1) * 3, 3, 2, R.pick(['#f0e8c8', '#ffd0d0', '#d0e8ff', '#e0ffd0']));
  }
}

function buildMaint(k) {
  const { g, x0, x1, top, fl, R, r } = k;
  wall(k, WALLS.dark, { lampGap: 60, trim: .99 });
  for (const px of [x0 + 4, x0 + 8]) { VL(g, px, top, fl - 1, R.pick(['#3d7ea6', '#8a3a5a', '#3a8a6a'])); }
  for (let y = top + 6; y < fl - 4; y += 7) { HL(g, x0 + 3, x1 - 4, y, '#5a5048'); PX(g, x1 - 8, y - 1, '#c83a2a'); PX(g, x1 - 9, y - 1, '#c83a2a'); PX(g, x1 - 7, y - 1, '#c83a2a'); }
  BOX(g, x0 + 14, top + 10, 10, 8, '#3a404c', '#1a1d24'); k.wd({ kind: 'blink', x: x0 + 17, y: top + 12, c: '#5aff8a' }); k.wd({ kind: 'blink', x: x0 + 20, y: top + 12, c: '#ffd24a' });
  r.panel = { x: x0 + 19, y: fl };
}
