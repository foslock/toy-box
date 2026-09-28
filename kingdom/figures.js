// People and creatures: your heir (dressed in whatever armour they've found, carrying whatever they fight with, and
// wearing the crown at the end, or a toad if a witch got to them), the foes you fight, and the crowds that cheer a
// coronation. All painted facing right; the renderer flips them to face left.
import { Px, ramp, shade } from './paint.js';

const INK = '#1c1622';
const ARMOUR = {
  rags: { body: null, trim: null }, jerkin: { body: '#b89a6a', trim: '#8a7048' }, leather: { body: '#8a5a36', trim: '#5a3a24' },
  chain: { body: '#9aa0aa', trim: '#6a7078', mail: true }, scale: { body: '#7a8aa0', trim: '#4a5a70', mail: true },
  plate: { body: '#c8ccd4', trim: '#8a8e98', plate: true }, mithril: { body: '#dfe8f4', trim: '#9ab0d0', plate: true },
};
const WEAPON_LOOK = {
  staff: 'staff', dagger: 'dagger', heirloom1: 'sword', heirloom2: 'sword', heirloom3: 'sword', axe: 'axe', spear: 'spear', bow: 'bow',
  mace: 'mace', longsword: 'sword', warhammer: 'hammer', lance: 'spear', elvenblade: 'sword', runeblade: 'great', dragonbone: 'great',
};

// The heir. look: { skin, hair, style }, sex, house colour, weapon and armour ids, crowned, toad.
// pose: 'front' (facing you) or 'back' (walking away); frame: 0-3 of the walk (0 = standing).
export function hero(o, pose = 'front', frame = 0) {
  const p = new Px(16, 24);
  if (o.toad) return toad(p, frame);
  const skin = o.look?.skin || '#e0b48e', hair = o.look?.hair || '#4a2f1e', style = o.look?.style ?? 0;
  const cloth = o.colour || '#2f55a8', A = ARMOUR[o.armor] || ARMOUR.rags;
  const body = A.body || cloth, trim = A.trim || shade(cloth, -.3);
  const x = 6, feet = 22;
  // legs
  const stride = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  p.rect(x, feet - 5, 2, 5 - Math.max(0, stride), '#4a3a30'); p.rect(x + 3, feet - 5, 2, 5 - Math.max(0, -stride), '#3e3028');
  p.rect(x - (stride > 0 ? 1 : 0), feet - 1 - Math.max(0, stride), 2, 1, '#2a2018'); p.rect(x + 3 + (stride < 0 ? 1 : 0), feet - 1 - Math.max(0, -stride), 2, 1, '#2a2018');
  // cloak behind (seen from the back it covers the body)
  if (pose === 'back') p.rect(x - 1, feet - 13, 7, 9, shade(cloth, -.1));
  // torso
  const ty = feet - 12;
  if (pose !== 'back') {
    p.rect(x - 1, ty, 7, 7, body); p.rect(x - 1, ty + 6, 7, 1, trim);
    if (A.mail) for (let j = 0; j < 6; j += 2) for (let i = (j >> 1) & 1; i < 7; i += 2) p.put(x - 1 + i, ty + j, shade(body, -.18));
    if (A.plate) { p.rect(x, ty + 1, 1, 4, shade(body, .35)); p.rect(x + 4, ty, 2, 7, shade(body, -.2)); }
    if (!A.body) { p.rect(x + 2, ty, 1, 7, shade(cloth, .25)); p.rect(x - 1, ty + 5, 7, 1, '#6a4a30'); }
    p.put(x + 2, ty + 5, '#d8b848');
    // arms
    p.rect(x - 2, ty + 1, 1, 5, A.body ? trim : shade(cloth, -.15)); p.put(x - 2, ty + 6, skin);
    p.rect(x + 6, ty + 1, 1, 5, A.body ? trim : shade(cloth, -.15)); p.put(x + 6, ty + 6, skin);
  } else {
    p.rect(x - 1, ty, 7, 2, shade(cloth, .08)); for (let j = 2; j < 9; j += 3) p.hline(x - 1, x + 5, ty + j, shade(cloth, -.22));
  }
  // head
  const hy = ty - 5;
  p.rect(x, hy, 5, 5, skin);
  if (pose === 'front') {
    p.put(x + 1, hy + 2, INK); p.put(x + 3, hy + 2, INK); p.put(x + 2, hy + 4, shade(skin, -.2));
    p.rect(x, hy - 1, 5, 2, hair); p.put(x - 1, hy, hair); p.put(x + 5, hy, hair);
    if (style === 1 || style === 3) { p.rect(x - 1, hy + 1, 1, 5, hair); p.rect(x + 5, hy + 1, 1, 5, hair); }
    if (style === 2) { p.put(x + 5, hy + 1, hair); p.put(x + 6, hy + 2, hair); p.put(x + 6, hy + 3, hair); }
  } else {
    p.rect(x - 1, hy - 1, 7, 5, hair); p.rect(x, hy + 4, 5, 1, style === 1 || style === 3 ? hair : skin);
    if (style === 1 || style === 3) p.rect(x, hy + 4, 5, 3, hair);
    if (style === 2) p.rect(x + 2, hy + 4, 1, 4, hair);
  }
  if (o.armor === 'plate' || o.armor === 'mithril') { p.rect(x - 1, hy - 2, 7, 3, A.body); p.put(x + 2, hy - 3, A.trim); }
  if (o.crowned) { p.rect(x, hy - 3, 5, 2, '#f2c24c'); p.put(x, hy - 4, '#f2c24c'); p.put(x + 2, hy - 4, '#ffe88a'); p.put(x + 4, hy - 4, '#f2c24c'); p.put(x + 2, hy - 3, '#e0302a'); }
  weapon(p, WEAPON_LOOK[o.weapon] || 'staff', x, ty, pose);
  p.outline(INK);
  return p;
}
function weapon(p, kind, x, ty, pose) {
  const hx = pose === 'back' ? x - 3 : x + 7, hy = ty + 5;
  const steel = '#d8dce4', dark = '#8a8e98', wood = '#8a5a36';
  switch (kind) {
    case 'staff': p.vline(hx, ty - 7, ty + 9, wood); p.put(hx, ty - 8, shade(wood, .3)); break;
    case 'dagger': p.vline(hx, hy - 3, hy, steel); p.put(hx, hy + 1, '#6a4a30'); break;
    case 'sword': p.vline(hx, hy - 9, hy - 1, steel); p.put(hx, hy - 10, '#ffffff'); p.hline(hx - 1, hx + 1, hy, '#d8b848'); p.put(hx, hy + 1, '#6a4a30'); break;
    case 'great': p.vline(hx, hy - 12, hy - 1, steel); p.vline(hx + 1, hy - 12, hy - 1, dark); p.hline(hx - 1, hx + 2, hy, '#d8b848'); p.put(hx, hy + 1, '#6a4a30'); break;
    case 'axe': p.vline(hx, hy - 8, hy + 1, wood); p.rect(hx + 1, hy - 8, 2, 3, steel); p.put(hx + 3, hy - 7, steel); break;
    case 'spear': p.vline(hx, ty - 9, ty + 9, wood); p.put(hx, ty - 10, steel); p.put(hx, ty - 11, '#ffffff'); break;
    case 'bow': for (let j = -6; j <= 6; j++) p.put(hx + Math.round(2 - Math.abs(j) / 3), hy - 3 + j, wood); p.vline(hx, hy - 9, hy + 3, '#e8e0d0'); break;
    case 'mace': p.vline(hx, hy - 7, hy + 1, wood); p.rect(hx - 1, hy - 9, 3, 3, dark); p.put(hx, hy - 10, dark); break;
    case 'hammer': p.vline(hx, hy - 8, hy + 1, wood); p.rect(hx - 2, hy - 10, 5, 3, dark); break;
  }
}
function toad(p, frame) {
  const g = ramp('#5a9a3a'), y = 22 - (frame % 2);
  p.ellipse(8, y - 3, 5, 3.5, (px, py, nx, ny) => ny < -.3 ? g.lit : ny < .4 ? g.base : g.dim);
  p.disc(5, y - 6, 1.6, g.lit); p.disc(10, y - 6, 1.6, g.lit); p.put(5, y - 6, INK); p.put(10, y - 6, INK);
  p.hline(5, 11, y - 3, g.dark); p.rect(3, y - 1, 2, 1, g.dim); p.rect(11, y - 1, 2, 1, g.dim);
  p.put(8, y - 9, '#f2c24c');
  return p.outline(INK);
}

/* ---------- foes ---------- */
// A figure made of parts, for the humans and the humanoid monsters. s: size (1 is a person).
function humanoid(o) {
  const s = o.size || 1, W = Math.ceil(30 * s), H = Math.ceil(34 * s);
  const p = new Px(W, H);
  const cx = Math.floor(W / 2), feet = H - 2;
  const u = v => Math.round(v * s);
  const skin = o.skin || '#e0b48e', body = o.body || '#6a5a4a', legs = o.legs || shade(body, -.3), trim = o.trim || shade(body, -.35);
  const B = ramp(body);
  // legs
  p.rect(cx - u(4), feet - u(9), u(3), u(9), legs); p.rect(cx + u(1), feet - u(9), u(3), u(9), shade(legs, -.15));
  p.rect(cx - u(5), feet - u(2), u(4), u(2), o.boots || '#2a2018'); p.rect(cx + u(1), feet - u(2), u(4), u(2), o.boots || '#2a2018');
  // body
  const ty = feet - u(20);
  if (o.cloak) p.rect(cx - u(7), ty + u(1), u(14), u(14), shade(o.cloak, -.15));
  p.rect(cx - u(5), ty, u(10), u(11), B.base); p.rect(cx - u(5), ty, u(3), u(11), B.lit); p.rect(cx + u(3), ty, u(2), u(11), B.dim);
  p.rect(cx - u(5), ty + u(9), u(10), u(2), trim);
  if (o.robe) { p.poly([[cx - u(5), ty + u(8)], [cx + u(5), ty + u(8)], [cx + u(7), feet], [cx - u(7), feet]], B.base); p.rect(cx - u(1), ty + u(8), u(2), feet - ty - u(8), B.dim); }
  if (o.mail) for (let j = 0; j < u(9); j += 2) for (let i = (j >> 1) & 1; i < u(10); i += 2) p.put(cx - u(5) + i, ty + j, B.dim);
  // arms
  p.rect(cx - u(7), ty + u(1), u(2), u(8), B.dim); p.rect(cx + u(5), ty + u(1), u(2), u(8), B.dim);
  p.rect(cx - u(7), ty + u(9), u(2), u(2), skin); p.rect(cx + u(5), ty + u(9), u(2), u(2), skin);
  // head
  const hy = ty - u(8);
  p.rect(cx - u(3), hy, u(7), u(7), skin); p.rect(cx + u(2), hy + u(3), u(1), u(1), o.eye || INK); p.rect(cx - u(1), hy + u(3), u(1), u(1), o.eye || INK);
  if (o.hair) p.rect(cx - u(3), hy - u(1), u(7), u(3), o.hair);
  if (o.hood) { p.rect(cx - u(4), hy - u(2), u(9), u(4), o.hood); p.rect(cx - u(4), hy, u(2), u(6), o.hood); p.rect(cx + u(3), hy, u(2), u(6), o.hood); }
  if (o.helm) { const Hm = ramp(o.helm); p.rect(cx - u(4), hy - u(2), u(9), u(6), Hm.base); p.rect(cx - u(4), hy - u(2), u(3), u(6), Hm.lit); p.rect(cx - u(2), hy + u(2), u(6), u(1), INK); if (o.plume) p.rect(cx - u(1), hy - u(5), u(2), u(3), o.plume); }
  if (o.crown) { p.rect(cx - u(3), hy - u(3), u(7), u(2), '#f2c24c'); for (const i of [-3, 0, 3]) p.rect(cx + u(i), hy - u(5), u(1), u(2), '#f2c24c'); }
  if (o.horns) { p.rect(cx - u(5), hy - u(3), u(2), u(3), '#e8e0cc'); p.rect(cx + u(4), hy - u(3), u(2), u(3), '#e8e0cc'); }
  if (o.ears) { p.rect(cx - u(5), hy + u(1), u(2), u(2), skin); p.rect(cx + u(4), hy + u(1), u(2), u(2), skin); }
  if (o.tusks) { p.rect(cx - u(1), hy + u(5), u(1), u(1), '#fff8e8'); p.rect(cx + u(2), hy + u(5), u(1), u(1), '#fff8e8'); }
  if (o.beard) p.rect(cx - u(3), hy + u(5), u(7), u(3), o.beard);
  if (o.hat) { p.rect(cx - u(5), hy - u(1), u(11), u(2), o.hat); p.poly([[cx - u(3), hy - u(1)], [cx + u(3), hy - u(1)], [cx + u(1), hy - u(9)]], o.hat); }
  if (o.mask) p.rect(cx - u(3), hy + u(4), u(7), u(3), o.mask);
  if (o.wolfHead) {
    // a wolf's head over the man's: long snout to the right, tall ears, yellow eyes, teeth
    const fur = o.skin, F = ramp(fur);
    p.rect(cx - u(4), hy - u(1), u(8), u(8), F.base); p.rect(cx - u(4), hy - u(1), u(3), u(8), F.lit);
    p.rect(cx + u(3), hy + u(3), u(6), u(4), F.base); p.rect(cx + u(8), hy + u(3), u(2), u(2), '#1c1622');
    p.rect(cx - u(3), hy - u(5), u(2), u(4), F.dim); p.rect(cx + u(1), hy - u(5), u(2), u(4), F.base);
    p.rect(cx + u(1), hy + u(1), u(2), u(1) || 1, '#ffd24a');
    for (let i = 0; i < 3; i++) p.rect(cx + u(4 + i * 2), hy + u(6), u(1) || 1, u(1) || 1, '#fff8e8');
  }
  if (o.bones) {
    // a bare skull and a cage of ribs
    const bone = '#e8e0cc', dark = '#3a3230';
    p.rect(cx - u(3), hy, u(7), u(7), bone); p.rect(cx - u(2), hy + u(2), u(2), u(2), dark); p.rect(cx + u(1), hy + u(2), u(2), u(2), dark);
    p.rect(cx, hy + u(4), u(1) || 1, u(1) || 1, dark); for (let i = -2; i <= 2; i += 2) p.rect(cx + u(i), hy + u(6), u(1) || 1, u(1) || 1, dark);
    p.rect(cx - u(5), ty, u(10), u(9), '#1c1622'); p.rect(cx, ty, u(1) || 1, u(9), bone);
    for (let j = 1; j < 8; j += 2) p.rect(cx - u(4), ty + u(j), u(8), u(1) || 1, bone);
    p.rect(cx - u(4), ty + u(9), u(8), u(2), '#c8c0ac');
  }
  // weapon in the right hand
  const hx = cx + u(6), hy2 = ty + u(10);
  const steel = '#d8dce4';
  if (o.weapon === 'sword') { p.rect(hx, hy2 - u(14), u(1) || 1, u(14), steel); p.rect(hx - u(2), hy2 - u(1), u(5), u(1) || 1, '#d8b848'); }
  if (o.weapon === 'club') { p.rect(hx, hy2 - u(12), u(2), u(12), '#6a4a30'); p.rect(hx - u(1), hy2 - u(15), u(4), u(5), '#7a5a3a'); }
  if (o.weapon === 'axe') { p.rect(hx, hy2 - u(12), u(1) || 1, u(13), '#6a4a30'); p.rect(hx + u(1), hy2 - u(12), u(4), u(5), steel); }
  if (o.weapon === 'spear') { p.rect(hx, hy2 - u(20), u(1) || 1, u(24), '#6a4a30'); p.rect(hx - u(1), hy2 - u(23), u(3), u(3), steel); }
  if (o.weapon === 'staff') { p.rect(hx, hy2 - u(20), u(1) || 1, u(24), '#6a4a30'); p.disc(hx, hy2 - u(21), u(2), o.orb || '#8a5aff'); }
  if (o.weapon === 'dagger') p.rect(hx, hy2 - u(6), u(1) || 1, u(6), steel);
  if (o.shield) { const S = ramp(o.shield); p.rect(cx - u(10), ty + u(2), u(6), u(9), S.base); p.rect(cx - u(10), ty + u(2), u(2), u(9), S.lit); p.rect(cx - u(8), ty + u(5), u(2), u(3), o.shieldMark || '#f2c24c'); }
  return p.outline(INK);
}
function quadruped(o) {
  const s = o.size || 1, W = Math.ceil(40 * s), H = Math.ceil(28 * s), p = new Px(W, H), u = v => Math.round(v * s);
  const R = ramp(o.col), feet = H - 2, bx = u(6), by = feet - u(16);
  const legH = u(o.legs ?? 7);
  for (const [dx, sh] of [[u(3), -.15], [u(7), 0], [u(20), -.15], [u(24), 0]]) p.rect(bx + dx, feet - legH, u(3), legH, shade(o.col, sh - .1));
  p.ellipse(bx + u(14), by + u(5), u(14), u(7), (x, y, nx, ny) => ny < -.4 ? R.lit : ny < .4 ? R.base : R.dim);
  // head at the front (right)
  const hx = bx + u(27), hy = by - u(2);
  p.ellipse(hx, hy + u(3), u(6), u(5), (x, y, nx, ny) => ny < -.3 ? R.lit : R.base);
  p.rect(hx + u(3), hy + u(3), u(6), u(4), o.snout || R.base);
  p.rect(hx + u(1), hy + u(1), u(2), u(2), o.eye || INK);
  if (o.ears) { p.rect(hx - u(3), hy - u(4), u(2), u(4), R.dim); p.rect(hx, hy - u(4), u(2), u(4), R.base); }
  if (o.tusks) { p.rect(hx + u(7), hy + u(2), u(1), u(3), '#fff8e8'); }
  if (o.tail) p.line(bx, by + u(3), bx - u(5), by - u(2), R.dim);
  if (o.mane) p.rect(bx + u(18), by - u(3), u(9), u(4), o.mane);
  return p.outline(INK);
}
function spider() {
  const p = new Px(40, 28), R = ramp('#3a3040');
  for (let i = 0; i < 4; i++) { p.line(18, 16, 4 + i * 3, 26 - i, R.dim); p.line(18, 16, 4 + i * 3, 6 + i * 2, R.dim); p.line(22, 16, 36 - i * 3, 26 - i, R.base); p.line(22, 16, 36 - i * 3, 6 + i * 2, R.base); }
  p.ellipse(16, 16, 9, 7, (x, y, nx, ny) => ny < -.3 ? R.lit : R.base); p.ellipse(27, 17, 5, 4, R.base);
  for (const [x, y] of [[28, 15], [30, 15], [29, 17]]) p.put(x, y, '#ff3a3a');
  p.put(14, 13, '#c8a040'); p.put(17, 12, '#c8a040');
  return p.outline(INK);
}
function serpent() {
  const p = new Px(40, 30), R = ramp('#4a8a4a');
  for (let i = 0; i < 30; i++) { const x = 4 + i, y = 22 - Math.sin(i / 4) * 5 - (i > 22 ? (i - 22) * 1.6 : 0); p.disc(x, y, 3 - i / 20, i % 4 < 2 ? R.base : R.lit); }
  p.ellipse(35, 6, 4, 3, R.lit); p.put(36, 5, '#ffd24a'); p.line(38, 7, 40, 8, '#e0302a');
  return p.outline(INK);
}
function winged(o) {
  const s = o.size || 1, W = Math.ceil(48 * s), H = Math.ceil(40 * s), p = new Px(W, H), u = v => Math.round(v * s), R = ramp(o.col), M = ramp(o.wing || shade(o.col, -.2));
  const cx = u(22), cy = u(24);
  p.poly([[cx - u(2), cy - u(6)], [cx - u(20), cy - u(22)], [cx - u(14), cy - u(8)], [cx - u(18), cy - u(4)]], M.base);
  p.poly([[cx + u(2), cy - u(6)], [cx + u(10), cy - u(26)], [cx + u(14), cy - u(12)], [cx + u(20), cy - u(10)]], M.lit);
  p.ellipse(cx, cy, u(12), u(7), (x, y, nx, ny) => ny < -.3 ? R.lit : ny < .4 ? R.base : R.dim);
  p.line(cx - u(10), cy + u(2), cx - u(22), cy + u(10), R.dim); p.line(cx - u(22), cy + u(10), cx - u(20), cy + u(14), R.dim);
  p.rect(cx - u(6), cy + u(5), u(3), u(8), R.dim); p.rect(cx + u(4), cy + u(5), u(3), u(8), R.dim);
  p.ellipse(cx + u(14), cy - u(8), u(5), u(4), R.lit); p.rect(cx + u(10), cy - u(6), u(5), u(6), R.base);
  p.rect(cx + u(17), cy - u(8), u(5), u(3), R.base); p.put(cx + u(15), cy - u(10), o.eye || '#ffd24a');
  if (o.horns) { p.line(cx + u(12), cy - u(11), cx + u(9), cy - u(16), '#e8e0cc'); p.line(cx + u(15), cy - u(12), cx + u(14), cy - u(17), '#e8e0cc'); }
  return p.outline(INK);
}
function ghost(o) {
  const p = new Px(28, 34), R = ramp(o.col || '#c8e0f0');
  p.ellipse(14, 12, 8, 9, R.lit);
  p.poly([[6, 12], [22, 12], [24, 30], [20, 27], [16, 31], [12, 27], [8, 31], [4, 28]], (x, y) => (x + y) % 5 === 0 ? R.dim : R.base);
  p.rect(10, 10, 2, 3, o.eye || '#1a2a3a'); p.rect(16, 10, 2, 3, o.eye || '#1a2a3a'); p.rect(12, 16, 4, 2, '#1a2a3a');
  if (o.wraith) { p.rect(6, 4, 16, 6, '#2a2a3a'); p.rect(5, 8, 3, 18, '#2a2a3a'); p.rect(20, 8, 3, 18, '#2a2a3a'); }
  return p.outline(INK);
}

const FOE_ART = {
  bandit: () => humanoid({ body: '#6a5a3a', hood: '#4a3a2a', mask: '#3a2a22', weapon: 'dagger', legs: '#4a3a2a' }),
  brigand: () => humanoid({ body: '#7a3a2a', hair: '#2a1c14', beard: '#2a1c14', weapon: 'axe', size: 1.1, cloak: '#4a2a1a' }),
  soldier: () => humanoid({ body: '#9aa0aa', mail: true, helm: '#8a8e98', weapon: 'spear', shield: '#8a2a2a', trim: '#8a2a2a' }),
  knight: () => humanoid({ body: '#2a2a32', helm: '#3a3a44', plume: '#8a1a1a', weapon: 'sword', shield: '#1a1a22', shieldMark: '#8a1a1a', size: 1.1 }),
  mercenary: () => humanoid({ body: '#5a4a3a', mail: true, helm: '#6a6a72', weapon: 'axe', shield: '#3a3a2a' }),
  cultist: () => humanoid({ body: '#4a1a2a', robe: true, hood: '#2a0a14', eye: '#ff3a3a', weapon: 'dagger' }),
  witch: () => humanoid({ body: '#3a2a4a', robe: true, skin: '#a8c890', hat: '#1a1420', hair: '#6a6a6a', weapon: 'staff', orb: '#9aff6a' }),
  assassin: () => humanoid({ body: '#1e1e26', hood: '#141418', mask: '#141418', weapon: 'dagger', eye: '#e8e8f0' }),
  champion: () => humanoid({ body: '#c8ccd4', helm: '#d8dce4', plume: '#f2c24c', weapon: 'sword', shield: '#2f55a8', size: 1.25 }),
  tyrant: () => humanoid({ body: '#5a1a2a', cloak: '#3a0a14', crown: true, hair: '#1a1414', beard: '#1a1414', weapon: 'sword', size: 1.15 }),
  goblin: () => humanoid({ skin: '#6aa04a', body: '#5a4a2a', ears: true, weapon: 'dagger', size: .8, eye: '#ff3a3a' }),
  troll: () => humanoid({ skin: '#6a8a6a', body: '#4a5a3a', weapon: 'club', size: 1.6, tusks: true, hair: '#3a4a2a', eye: '#ffd24a' }),
  ogre: () => humanoid({ skin: '#b08a6a', body: '#6a4a2a', weapon: 'club', size: 1.7, tusks: true, eye: '#2a1a14' }),
  giant: () => humanoid({ skin: '#c8a888', body: '#5a6a7a', weapon: 'club', size: 2.1, beard: '#8a8a8a', hair: '#8a8a8a' }),
  werewolf: () => humanoid({ skin: '#6a5a4a', body: '#5a4a3a', legs: '#4a3a2a', wolfHead: true, size: 1.3, boots: '#3a2a20' }),
  skeleton: () => humanoid({ skin: '#e8e0cc', body: '#e8e0cc', legs: '#d8d0bc', trim: '#b8b0a0', weapon: 'sword', eye: '#1a1414', boots: '#d8d0bc', bones: true, shield: '#6a5a4a' }),
  wolf: () => quadruped({ col: '#7a7a82', ears: true, tail: true, legs: 7 }),
  bear: () => quadruped({ col: '#6a4a30', size: 1.4, ears: true, legs: 6 }),
  boar: () => quadruped({ col: '#5a4038', tusks: true, mane: '#3a2a24', legs: 5 }),
  spider: () => spider(),
  serpent: () => serpent(),
  wyvern: () => winged({ col: '#5a7a4a', wing: '#3a5a3a' }),
  dragon: () => winged({ col: '#b8302a', wing: '#7a1a1a', size: 1.4, horns: true }),
  ghost: () => ghost({}),
  wraith: () => ghost({ col: '#8a9ab8', wraith: true, eye: '#8affff' }),
};
export function foe(id) { return (FOE_ART[id] || FOE_ART.bandit)(); }

// A townsperson in the crowd, cheering. k picks their colours; frame bobs them up and down.
export function peasant(k, frame = 0) {
  const p = new Px(8, 14), cols = ['#b8563f', '#2f55a8', '#6a8a3a', '#d8b848', '#8a5a8a', '#e8e0d0', '#5a6a7a'];
  const body = cols[k % cols.length], skin = ['#f1d0b0', '#e0b48e', '#c68d64', '#9a6644'][(k >> 2) % 4], hair = ['#2a1c14', '#7a4a26', '#d9a65a', '#3a3a3a'][(k >> 3) % 4];
  const up = frame % 2;
  p.rect(2, 9 - up, 4, 4, body); p.rect(2, 13 - up, 1, 1, '#3a2a20'); p.rect(5, 13 - up, 1, 1, '#3a2a20');
  p.rect(2, 5 - up, 4, 4, skin); p.rect(2, 4 - up, 4, 2, hair);
  if (up) { p.put(1, 5, skin); p.put(6, 5, skin); p.put(1, 6, body); p.put(6, 6, body); } else { p.put(1, 10, skin); p.put(6, 10, skin); }
  return p.outline(INK);
}
// The bishop who crowns you: white and gold, with a mitre, hands raised.
export function bishop(frame = 0) {
  const p = new Px(12, 22), gold = '#f2c24c', robe = '#f0ece0';
  p.poly([[2, 21], [9, 21], [8, 9], [3, 9]], robe); p.rect(5, 10, 1, 11, gold); p.rect(3, 15, 6, 1, gold);
  p.rect(4, 5, 4, 4, '#e0b48e'); p.put(5, 7, INK); p.put(7, 7, INK); p.rect(4, 8, 4, 1, '#d8d0c0');
  p.poly([[3, 5], [9, 5], [8, 0], [6, 2], [4, 0]], robe); p.rect(3, 4, 6, 1, gold); p.vline(6, 1, 4, gold);
  const up = frame ? 2 : 0;
  p.rect(1, 9 - up, 2, 4, robe); p.rect(9, 9 - up, 2, 4, robe); p.put(1, 8 - up, '#e0b48e'); p.put(10, 8 - up, '#e0b48e');
  return p.outline(INK);
}
export function crownSprite() {
  const p = new Px(9, 7), g = '#f2c24c', hi = '#fff0a8';
  p.rect(1, 3, 7, 3, g); p.put(1, 1, g); p.put(1, 2, g); p.put(4, 0, g); p.put(4, 1, g); p.put(4, 2, g); p.put(7, 1, g); p.put(7, 2, g);
  p.put(2, 4, '#e0302a'); p.put(4, 4, '#4a8ae0'); p.put(6, 4, '#e0302a'); p.put(1, 3, hi); p.put(4, 0, hi);
  return p.outline(INK);
}
