// The pictures: small vector emblems drawn on a 100 × 100 grid, standing on the horizon (y = 100) or floating above
// it. A card shows its emblem twice: upright in a gold heaven, and mirrored below as a crimson reflection in hell.
// Charms, events and the map use the same emblems.
//
// Each glyph is a list of layers: [role, path]. Roles: 'b' body (the main fill), 'a' accent (a bright fill),
// 'd' detail (stroked lines), 'h' hole (filled with the shadow colour). Paths are SVG path data using only absolute
// M, L, C, Q and Z, so the helpers below can move, scale, rotate and mirror them.

/* ---------- path helpers ---------- */
const f = n => +n.toFixed(2);
export function tf(d, { dx = 0, dy = 0, sx = 1, sy = sx, rot = 0, cx = 50, cy = 50 } = {}) {
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  let out = '', nums = [];
  const flush = () => { for (let i = 0; i < nums.length; i += 2) { let x = (nums[i] - cx) * sx, y = (nums[i + 1] - cy) * sy; const X = x * c - y * s + cx + dx, Y = x * s + y * c + cy + dy; out += f(X) + ' ' + f(Y) + ' '; } nums = []; };
  for (const t of tok) { if (/[MLCQZ]/.test(t)) { flush(); out += t + ' '; } else nums.push(+t); }
  flush();
  return out.trim();
}
const K = .5523;
export const circle = (x, y, r) => `M${x + r} ${y} C${x + r} ${y + r * K} ${x + r * K} ${y + r} ${x} ${y + r} C${x - r * K} ${y + r} ${x - r} ${y + r * K} ${x - r} ${y} C${x - r} ${y - r * K} ${x - r * K} ${y - r} ${x} ${y - r} C${x + r * K} ${y - r} ${x + r} ${y - r * K} ${x + r} ${y} Z`;
const ellipse = (x, y, rx, ry) => `M${x + rx} ${y} C${x + rx} ${y + ry * K} ${x + rx * K} ${y + ry} ${x} ${y + ry} C${x - rx * K} ${y + ry} ${x - rx} ${y + ry * K} ${x - rx} ${y} C${x - rx} ${y - ry * K} ${x - rx * K} ${y - ry} ${x} ${y - ry} C${x + rx * K} ${y - ry} ${x + rx} ${y - ry * K} ${x + rx} ${y} Z`;
// a ring: outer circle one way, inner the other way, so nonzero filling leaves a hole
const ringE = (x, y, rx, ry, w) => ellipse(x, y, rx, ry) + ' ' + rev(ellipse(x, y, rx - w, ry - w * ry / rx));
const ring = (x, y, r, w) => ringE(x, y, r, r, w);
function rev(d) {   // reverse a closed path made of one M and C segments (good enough for ellipses)
  const segs = d.match(/[MC][^MCZ]*/g).map(s => [s[0], s.slice(1).trim().split(/\s+/).map(Number)]);
  const start = segs[0][1];
  const pts = [start];
  for (const [, n] of segs.slice(1)) pts.push(n);
  let out = `M${pts[pts.length - 1].slice(-2).join(' ')} `;
  for (let i = pts.length - 1; i >= 1; i--) {
    const n = pts[i], prev = pts[i - 1].slice(-2);
    out += `C${n[2]} ${n[3]} ${n[0]} ${n[1]} ${prev[0]} ${prev[1]} `;
  }
  return out + 'Z';
}
export const star = (x, y, r1, r2, n, rot = -90) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + f(x + Math.cos(a) * r) + ' ' + f(y + Math.sin(a) * r) + ' '; }
  return d + 'Z';
};
const rays = (x, y, r1, r2, n, w, rot = 0) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (rot + i * 360 / n) * Math.PI / 180, b = w * Math.PI / 180;
    d += `M${f(x + Math.cos(a - b) * r1)} ${f(y + Math.sin(a - b) * r1)} L${f(x + Math.cos(a) * r2)} ${f(y + Math.sin(a) * r2)} L${f(x + Math.cos(a + b) * r1)} ${f(y + Math.sin(a + b) * r1)} Z `;
  }
  return d;
};
const mirror = d => tf(d, { sx: -1, sy: 1 });   // left-right about x = 50
const rect = (x, y, w, h) => `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`;
const line = (...p) => 'M' + p.map((v, i) => v + (i % 2 ? ' L' : ' ')).join('').replace(/ L$/, '');

/* ---------- reusable parts ---------- */
const SWORD = 'M50 3 L56 15 L56 63 L44 63 L44 15 Z M28 62 C34 60 66 60 72 62 L72 69 C66 67 34 67 28 69 Z M46.5 69 L53.5 69 L53.5 87 L46.5 87 Z ' + circle(50, 92, 6);
const SWORD_D = 'M50 17 L50 58';
const WING = 'M50 62 C42 44 26 32 4 33 C12 37 17 41 19 45 C11 45 7 48 3 53 C12 52 18 54 21 58 C14 60 11 63 9 68 C20 65 32 66 50 72 Z';
const WING_D = 'M44 60 C34 50 22 44 12 42 M44 64 C34 58 24 56 14 58';
const FLAME = 'M50 4 C62 22 80 36 78 62 C76 84 62 96 50 96 C38 96 24 84 22 62 C20 46 30 38 34 26 C38 36 40 42 44 44 C44 30 46 16 50 4 Z';
const FLAME_IN = 'M50 44 C56 56 66 64 64 76 C62 88 56 92 50 92 C44 92 38 88 36 78 C34 68 42 62 44 54 C46 60 48 62 50 62 C49 56 48 50 50 44 Z';
const SHIELD = 'M50 12 C62 18 74 18 84 16 C84 50 74 78 50 96 C26 78 16 50 16 16 C26 18 38 18 50 12 Z';
const HEART = 'M50 90 C20 66 10 50 14 36 C18 22 38 18 50 34 C62 18 82 22 86 36 C90 50 80 66 50 90 Z';
const EYE = 'M6 54 C26 28 74 28 94 54 C74 80 26 80 6 54 Z';
const CLOUD = 'M14 46 C8 34 18 22 30 26 C34 12 56 10 62 22 C74 16 90 26 86 40 C94 46 88 58 78 56 L22 56 C14 56 10 50 14 46 Z';
const BOLT = 'M58 4 L30 54 L48 54 L38 98 L72 40 L54 40 L66 4 Z';
const SKULL = 'M50 16 C70 16 82 30 82 48 C82 58 76 64 72 68 L72 80 L28 80 L28 68 C24 64 18 58 18 48 C18 30 30 16 50 16 Z';

export const GLYPHS = {
  /* --- the angel's cards --- */
  sword: [['b', SWORD], ['d', SWORD_D]],
  shield: [['b', SHIELD], ['d', tf(SHIELD, { sx: .74, sy: .74, cy: 54 })], ['a', star(50, 48, 13, 5, 4)]],
  vial: [['b', 'M42 12 L58 12 L58 21 L56 21 L56 40 C74 48 78 62 76 74 C74 90 62 98 50 98 C38 98 26 90 24 74 C22 62 26 48 44 40 L44 21 L42 21 Z'], ['a', 'M27 70 C38 64 60 76 73 68 C74 84 62 94 50 94 C38 94 27 84 27 70 Z'], ['d', 'M36 56 C34 62 34 66 36 70']],
  bowl: [['b', 'M14 56 L86 56 L86 62 L82 62 C80 82 66 92 50 92 C34 92 20 82 18 62 L14 62 Z M42 92 L58 92 L62 100 L38 100 Z'], ['a', 'M50 18 C56 28 60 36 56 46 C54 52 46 52 44 46 C40 36 44 28 50 18 Z'], ['d', 'M34 40 C30 32 36 26 32 18 M66 40 C70 32 64 26 68 18']],
  sun: [['b', circle(50, 52, 18) + ' ' + rays(50, 52, 22, 42, 12, 8)], ['a', circle(50, 52, 11)]],
  flameSword: [['b', 'M50 3 C60 20 64 30 57 41 C65 35 67 27 65 19 C76 35 71 52 56 62 L44 62 C29 52 24 35 35 19 C33 27 35 35 43 41 C36 30 40 20 50 3 Z M28 62 C34 60 66 60 72 62 L72 69 C66 67 34 67 28 69 Z M46.5 69 L53.5 69 L53.5 87 L46.5 87 Z ' + circle(50, 92, 6)], ['a', 'M47 22 L53 22 L54 60 L46 60 Z']],
  bolt: [['b', BOLT], ['d', 'M52 20 L42 44']],
  twin: [['b', tf(SWORD, { rot: -28, cy: 70 }) + ' ' + tf(SWORD, { rot: 28, cy: 70 })]],
  lance: [['b', 'M50 2 L57 18 L52 23 L52 98 L48 98 L48 23 L43 18 Z M42 30 L58 30 L58 34 L42 34 Z'], ['a', rays(50, 14, 8, 20, 8, 5)]],
  wings: [['b', WING + ' ' + mirror(WING)], ['d', WING_D + ' ' + mirror(WING_D)], ['a', circle(50, 62, 7)]],
  heart: [['b', HEART], ['a', 'M50 40 L54 54 L50 70 L46 54 Z'], ['d', 'M30 34 C26 40 26 48 30 54']],
  dawn: [['b', 'M22 100 C22 82 34 70 50 70 C66 70 78 82 78 100 Z ' + Array.from({ length: 7 }, (_, i) => { const t = (200 + i * 23.3) * Math.PI / 180, b = .07; return `M${f(50 + Math.cos(t - b) * 34)} ${f(100 + Math.sin(t - b) * 34)} L${f(50 + Math.cos(t) * 62)} ${f(100 + Math.sin(t) * 62)} L${f(50 + Math.cos(t + b) * 34)} ${f(100 + Math.sin(t + b) * 34)} Z`; }).join(' ')], ['a', 'M32 100 C32 88 40 79 50 79 C60 79 68 88 68 100 Z']],
  bigShield: [['b', tf(SHIELD, { sx: 1.12, sy: 1.04, cy: 60 })], ['d', tf(SHIELD, { sx: .86, sy: .82, cy: 60 })], ['a', circle(50, 48, 10)], ['d', line(50, 22, 50, 80) + ' ' + line(24, 46, 76, 46)]],
  lyre: [['b', 'M28 14 C18 36 22 66 38 84 L62 84 C78 66 82 36 72 14 C68 18 66 24 66 30 C68 44 64 52 60 54 L40 54 C36 52 32 44 34 30 C34 24 32 18 28 14 Z M34 84 L66 84 L66 92 L34 92 Z'], ['d', 'M43 56 L43 84 M50 56 L50 84 M57 56 L57 84'], ['a', circle(28, 14, 4) + ' ' + circle(72, 14, 4)]],
  eye: [['b', EYE], ['h', circle(50, 54, 15)], ['a', circle(50, 54, 9)], ['d', 'M14 40 L8 32 M30 30 L27 21 M50 27 L50 17 M70 30 L73 21 M86 40 L92 32']],
  chalice: [['b', 'M26 16 L74 16 C74 44 63 56 54 58 L54 76 L68 86 L68 94 L32 94 L32 86 L46 76 L46 58 C37 56 26 44 26 16 Z'], ['a', circle(50, 8, 7)], ['d', 'M30 26 L70 26']],
  salt: [['b', Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return star(50 + Math.cos(a) * 36, 58 + Math.sin(a) * 30, 7, 3, 4, i * 25); }).join(' ')], ['a', 'M44 66 L56 66 L54 44 C58 40 56 34 50 28 C44 34 42 40 46 44 Z']],
  brokenBlade: [['b', 'M44 64 L44 42 L50 46 L56 38 L56 64 Z M28 62 C34 60 66 60 72 62 L72 69 C66 67 34 67 28 69 Z M46.5 69 L53.5 69 L53.5 87 L46.5 87 Z ' + circle(50, 92, 6) + ' ' + tf('M50 3 L56 15 L56 30 L50 26 L44 32 L44 15 Z', { rot: 24, cy: 20, dx: 10 })], ['a', star(60, 36, 8, 2, 4, 20)]],
  bread: [['b', 'M12 82 C12 52 32 38 50 38 C68 38 88 52 88 82 C88 88 84 90 80 90 L20 90 C16 90 12 88 12 82 Z'], ['d', 'M30 54 L38 66 M46 48 L54 62 M62 54 L70 66'], ['a', star(50, 18, 12, 4, 4)]],
  candle: [['b', 'M40 40 L60 40 L60 92 L40 92 Z M26 90 L74 90 L70 100 L30 100 Z'], ['a', 'M50 6 C58 18 60 26 50 36 C40 26 42 18 50 6 Z'], ['d', 'M56 40 L56 52 M45 44 L45 49']],
  feather: [['b', 'M72 4 C50 12 30 36 26 70 C26 78 28 84 30 88 L34 88 C44 80 58 62 66 40 C70 28 72 16 72 4 Z'], ['d', 'M30 97 C40 70 56 40 71 7 M48 46 L38 50 M56 34 L46 36 M42 60 L32 66']],
  trumpet: [['b', 'M12 90 L16 84 L60 38 C60 28 68 14 84 6 C90 12 94 20 94 26 C84 32 74 38 66 42 L22 88 Z M10 92 L18 82 L22 86 L14 96 Z'], ['a', ellipse(87, 15, 6, 10)], ['d', 'M40 64 L46 70']],
  censer: [['b', 'M30 50 C30 38 70 38 70 50 C70 70 62 80 50 80 C38 80 30 70 30 50 Z M38 38 L62 38 L56 30 L44 30 Z M44 80 L56 80 L58 88 L42 88 Z'], ['d', 'M44 30 L40 2 M56 30 L60 2 M34 56 L66 56'], ['a', 'M64 44 C74 40 70 30 80 26 C86 24 88 18 86 12 M30 44 C22 40 26 30 18 26']],
  scroll: [['b', 'M26 18 L74 18 L74 84 L26 84 Z ' + ellipse(50, 18, 28, 7) + ' ' + ellipse(50, 84, 28, 7)], ['d', 'M34 32 L66 32 M34 42 L66 42 M34 52 L60 52 M34 62 L64 62 M34 72 L56 72']],
  mirror: [['b', 'M50 6 C70 6 82 22 82 40 C82 58 70 72 50 72 C30 72 18 58 18 40 C18 22 30 6 50 6 Z M45 72 L55 72 L57 98 L43 98 Z'], ['h', ellipse(50, 39, 25, 27)], ['a', 'M36 30 C38 22 44 18 52 16 C44 22 40 28 38 36 Z']],
  openHand: [['b', 'M32 98 L32 62 C30 54 24 46 20 40 C17 35 22 30 27 35 L37 48 L37 18 C37 11 45 11 45 18 L45 44 L47 12 C47 5 55 5 55 12 L55 44 L58 16 C58 9 66 9 66 16 L64 48 L68 27 C68 20 76 20 76 27 L72 66 C70 80 66 88 66 98 Z'], ['a', star(50, 74, 7, 2.5, 4)]],
  swap: [['b', 'M18 34 L64 34 L64 22 L86 40 L64 58 L64 46 L18 46 Z M82 66 L36 66 L36 54 L14 72 L36 90 L36 78 L82 78 Z']],
  spear: [['b', 'M50 2 C59 14 61 24 55 34 L52 37 L52 98 L48 98 L48 37 L45 34 C39 24 41 14 50 2 Z M38 38 L62 38 L62 43 L38 43 Z'], ['d', 'M50 8 L50 32']],
  flame: [['b', FLAME], ['a', FLAME_IN]],
  horn: [['b', 'M10 90 C20 80 30 76 42 74 C62 70 76 56 82 30 C84 22 86 14 92 8 C96 22 94 40 86 56 C74 80 52 90 26 94 C20 95 14 94 10 90 Z'], ['d', 'M30 80 C34 86 34 90 32 93 M50 74 C54 80 55 84 54 89 M66 64 C70 70 72 74 72 79']],
  bigWings: [['b', tf(WING, { sx: 1.12, sy: 1.15, cx: 50, cy: 66 }) + ' ' + mirror(tf(WING, { sx: 1.12, sy: 1.15, cx: 50, cy: 66 })) + ' ' + tf(WING, { sx: .8, sy: .8, cx: 50, cy: 80, dy: 10 }) + ' ' + mirror(tf(WING, { sx: .8, sy: .8, cx: 50, cy: 80, dy: 10 }))], ['d', WING_D + ' ' + mirror(WING_D)]],
  dagger: [['b', 'M50 8 L56 22 L55 60 L45 60 L44 22 Z M32 58 C40 64 60 64 68 58 L66 66 C58 70 42 70 34 66 Z M46.5 68 L53.5 68 L53.5 86 L46.5 86 Z ' + circle(50, 91, 5)], ['a', 'M50 64 C52 70 54 76 50 80 C46 76 48 70 50 64 Z'], ['d', 'M50 22 L50 56']],
  star: [['b', star(50, 46, 44, 9, 4) + ' ' + star(50, 46, 26, 9, 4, -45)], ['a', circle(50, 46, 8)]],
  crown: [['b', 'M14 78 L18 32 L34 54 L50 22 L66 54 L82 32 L86 78 Z M14 80 L86 80 L86 92 L14 92 Z'], ['a', circle(18, 30, 5) + ' ' + circle(50, 20, 6) + ' ' + circle(82, 30, 5) + ' ' + circle(50, 86, 4)]],
  halo: [['b', ringE(50, 44, 38, 14, 7)], ['a', star(50, 20, 10, 3, 4) + ' ' + star(20, 30, 6, 2, 4) + ' ' + star(80, 30, 6, 2, 4)], ['d', 'M22 72 C34 64 66 64 78 72 M30 84 C40 78 60 78 70 84']],
  bell: [['b', 'M50 12 C60 12 64 20 66 32 C68 52 72 66 84 76 L16 76 C28 66 32 52 34 32 C36 20 40 12 50 12 Z M12 76 L88 76 L88 84 L12 84 Z ' + ring(50, 8, 6, 3)], ['a', circle(50, 91, 6)], ['d', 'M36 66 L64 66']],
  breastplate: [['b', 'M22 20 L38 14 C44 22 56 22 62 14 L78 20 L84 40 L76 46 L76 84 C66 92 34 92 24 84 L24 46 L16 40 Z'], ['d', 'M50 26 L50 86 M30 50 C40 56 60 56 70 50 M32 68 C42 72 58 72 68 68'], ['a', star(50, 38, 8, 3, 4)]],
  bush: [['b', 'M16 92 C8 80 14 66 26 66 C24 52 38 44 48 50 C52 40 68 40 72 52 C84 50 92 62 86 74 C94 82 88 94 78 92 Z'], ['a', tf(FLAME, { sx: .34, sy: .42, cx: 30, cy: 100, dy: -38 }) + ' ' + tf(FLAME, { sx: .42, sy: .5, cx: 50, cy: 100, dy: -48 }) + ' ' + tf(FLAME, { sx: .34, sy: .42, cx: 70, cy: 100, dy: -38 })]],
  pyre: [['b', 'M12 88 L86 72 L88 80 L14 96 Z M12 72 L86 88 L84 96 L10 80 Z'], ['a', tf(FLAME, { sx: .62, sy: .72, cx: 50, cy: 100, dy: -24 })]],
  purge: [['b', ring(50, 54, 40, 6)], ['a', tf(FLAME, { sx: .6, sy: .64, cx: 50, cy: 54 })]],
  host: [['b', [[50, 28, 1], [24, 62, .8], [76, 62, .8]].map(([x, y, s]) => tf(circle(50, 50, 9) + ' ' + tf(WING, { sx: .55, sy: .55, cx: 50, cy: 62, dy: -12 }) + ' ' + mirror(tf(WING, { sx: .55, sy: .55, cx: 50, cy: 62, dy: -12 })), { sx: s, dx: x - 50, dy: y - 50 })).join(' ')], ['a', ringE(50, 14, 9, 3, 2)]],
  stair: [['b', 'M8 98 L8 84 L28 84 L28 68 L48 68 L48 52 L68 52 L68 36 L88 36 L88 98 Z'], ['a', rays(78, 20, 6, 18, 8, 6) + ' ' + circle(78, 20, 5)]],
  balance: [['b', 'M48 14 L52 14 L52 88 L48 88 Z M14 24 L86 24 L86 29 L14 29 Z M34 88 L66 88 L70 96 L30 96 Z M6 58 L34 58 C32 66 26 70 20 70 C14 70 8 66 6 58 Z M66 58 L94 58 C92 66 86 70 80 70 C74 70 68 66 66 58 Z'], ['d', 'M14 28 L8 58 M14 28 L32 58 M86 28 L68 58 M86 28 L92 58'], ['a', circle(50, 12, 6)]],
  holyBlade: [['b', SWORD], ['a', ringE(50, 26, 22, 7, 4)], ['d', SWORD_D]],
  storm: [['b', CLOUD], ['a', tf(BOLT, { sx: .5, sy: .5, cx: 50, cy: 0, dx: -12, dy: 52 }) + ' ' + tf(BOLT, { sx: .4, sy: .45, cx: 50, cy: 0, dx: 16, dy: 54 })]],
  pillar: [['b', 'M36 98 C34 70 28 50 32 30 C34 18 44 8 50 2 C56 8 66 18 68 30 C72 50 66 70 64 98 Z'], ['a', 'M44 96 C42 74 38 56 42 40 C44 30 48 22 50 18 C52 22 56 30 58 40 C62 56 58 74 56 96 Z'], ['d', 'M34 60 C44 54 56 66 66 58 M33 80 C44 74 56 86 66 78']],
  eyeStar: [['b', 'M50 6 L92 84 L8 84 Z'], ['h', tf(EYE, { sx: .48, sy: .48, cy: 54, dy: 6 })], ['a', circle(50, 60, 6)], ['d', rays(50, 52, 46, 54, 16, 1)]],
  temple: [['b', 'M8 34 L50 8 L92 34 Z M12 36 L88 36 L88 44 L12 44 Z M18 46 L28 46 L28 84 L18 84 Z M36 46 L46 46 L46 84 L36 84 Z M54 46 L64 46 L64 84 L54 84 Z M72 46 L82 46 L82 84 L72 84 Z M8 86 L92 86 L92 96 L8 96 Z'], ['a', circle(50, 25, 5)]],
  heartRays: [['b', tf(HEART, { sx: .8, cy: 56 })], ['a', rays(50, 54, 34, 48, 12, 5)]],
  gate: [['b', 'M14 98 L14 44 C14 18 86 18 86 44 L86 98 L76 98 L76 46 C76 28 24 28 24 46 L24 98 Z M30 98 L30 44 L36 44 L36 98 Z M47 98 L47 34 L53 34 L53 98 Z M64 98 L64 44 L70 44 L70 98 Z'], ['a', rays(50, 34, 12, 26, 7, 5, 200)]],
  sixWings: [['b', tf(WING, { rot: -30, cy: 56 }) + ' ' + mirror(tf(WING, { rot: -30, cy: 56 })) + ' ' + tf(WING, { sx: .9, cy: 56, dy: -6 }) + ' ' + mirror(tf(WING, { sx: .9, cy: 56, dy: -6 })) + ' ' + tf(WING, { rot: 32, sx: .8, cy: 66 }) + ' ' + mirror(tf(WING, { rot: 32, sx: .8, cy: 66 }))], ['a', circle(50, 56, 10)], ['h', circle(50, 56, 4)]],
  lily: [['b', 'M50 20 C57 34 59 48 50 62 C41 48 43 34 50 20 Z M48 62 C40 52 26 50 14 56 C24 58 34 62 48 66 Z M52 62 C60 52 74 50 86 56 C76 58 66 62 52 66 Z M48 64 L52 64 L52 98 L48 98 Z M52 82 C60 74 70 74 78 76 C70 80 62 82 52 86 Z'], ['a', circle(50, 60, 4)]],
  waves: [['b', 'M4 98 C6 70 12 40 30 18 C34 26 32 32 36 38 C34 58 36 78 40 98 Z M96 98 C94 70 88 40 70 18 C66 26 68 32 64 38 C66 58 64 78 60 98 Z'], ['a', 'M44 98 L56 98 L54 60 L46 60 Z'], ['d', 'M14 50 C20 46 24 50 30 46 M10 70 C18 66 24 70 32 66 M86 50 C80 46 76 50 70 46 M90 70 C82 66 76 70 68 66']],
  tongues: [['b', tf(FLAME, { sx: .42, sy: .62, cx: 22, cy: 98 }) + ' ' + tf(FLAME, { sx: .5, sy: .82, cx: 50, cy: 98 }) + ' ' + tf(FLAME, { sx: .42, sy: .62, cx: 78, cy: 98 })], ['a', tf(FLAME_IN, { sx: .5, sy: .8, cx: 50, cy: 98 })]],
  greatSword: [['b', 'M50 2 L58 14 L58 66 L42 66 L42 14 Z M18 64 C26 58 40 62 50 62 C60 62 74 58 82 64 L80 72 C70 68 60 70 50 70 C40 70 30 68 20 72 Z M46 72 L54 72 L54 88 L46 88 Z ' + circle(50, 93, 6)], ['a', tf(WING, { sx: .32, sy: .32, cx: 50, cy: 66, dx: -16 }) + ' ' + mirror(tf(WING, { sx: .32, sy: .32, cx: 50, cy: 66, dx: -16 }))], ['d', 'M50 16 L50 62']],
  rainbow: [['b', 'M2 96 C2 30 98 30 98 96 L86 96 C86 46 14 46 14 96 Z M22 96 C22 58 78 58 78 96 L66 96 C66 72 34 72 34 96 Z'], ['a', 'M42 96 C42 84 58 84 58 96 Z ' + star(50, 20, 8, 2, 4)]],
  choir: [['b', [24, 50, 76].map((x, i) => tf('M38 98 C36 76 40 62 50 62 C60 62 64 76 62 98 Z ' + circle(50, 52, 9), { dx: x - 50, dy: i === 1 ? -8 : 2 })).join(' ')], ['a', [24, 50, 76].map((x, i) => ringE(x, i === 1 ? 32 : 42, 9, 3, 2)).join(' ')], ['h', [24, 50, 76].map((x, i) => ellipse(x, i === 1 ? 50 : 60, 3, 3.5)).join(' ')]],

  /* --- statuses and curses --- */
  ash: [['b', 'M6 98 C18 78 38 72 50 72 C64 72 82 80 94 98 Z'], ['a', circle(30, 58, 2.5) + ' ' + circle(56, 48, 2) + ' ' + circle(70, 60, 3) + ' ' + circle(44, 36, 1.8) + ' ' + circle(62, 26, 1.5)]],
  brimstone: [['b', 'M20 92 L12 66 L28 44 L56 36 L82 48 L90 74 L74 94 Z'], ['a', 'M40 60 L50 52 L58 64 L68 58'], ['d', 'M28 70 L40 60 M58 64 L62 80 M68 58 L80 66']],
  frost: [['b', Array.from({ length: 6 }, (_, i) => tf('M47 50 L47 12 L50 6 L53 12 L53 50 Z M50 24 L40 16 L42 13 L50 19 L58 13 L60 16 Z M50 36 L42 30 L44 27 L50 32 L56 27 L58 30 Z', { rot: i * 60, cy: 50 })).join(' ')], ['a', circle(50, 50, 6)]],
  apple: [['b', 'M50 32 C40 22 16 22 15 48 C14 74 32 94 44 94 C48 94 50 92 50 92 C50 92 52 94 56 94 C68 94 86 74 85 48 C84 22 60 22 50 32 Z'], ['h', circle(86, 58, 9)], ['a', 'M52 30 C54 18 62 12 74 12 C70 22 62 28 52 30 Z'], ['d', 'M50 32 C48 26 46 20 44 16']],
  tear: [['b', 'M50 8 C58 30 78 50 78 70 C78 86 66 96 50 96 C34 96 22 86 22 70 C22 50 42 30 50 8 Z'], ['a', 'M36 66 C36 58 40 52 44 48 C42 56 42 62 44 70 Z']],
  question: [['b', 'M30 34 C30 18 40 8 52 8 C66 8 76 18 76 32 C76 46 64 52 58 58 C56 60 56 64 56 70 L44 70 C44 60 46 54 52 48 C58 42 64 40 64 32 C64 24 58 20 52 20 C46 20 42 26 42 34 Z ' + circle(50, 86, 8)]],
  chain: [['b', [[50, 22, 0], [50, 50, 1], [50, 78, 0]].map(([x, y, r]) => r ? ringE(x, y, 10, 17, 5) : ringE(x, y, 17, 10, 5)).join(' ')]],
  stone: [['b', ring(50, 56, 40, 32)], ['d', 'M50 16 L50 32 M50 80 L50 96 M10 56 L26 56 M74 56 L90 56'], ['a', circle(50, 56, 4)]],
  coin: [['b', circle(50, 52, 38)], ['h', ring(50, 52, 30, 3)], ['a', 'M50 30 L56 46 L72 46 L59 56 L64 72 L50 62 L36 72 L41 56 L28 46 L44 46 Z']],

  /* --- the demons' own cards --- */
  ember: [['b', tf(FLAME, { sx: .7, sy: .7, cy: 100 })], ['a', circle(24, 40, 3) + ' ' + circle(76, 30, 2.5) + ' ' + circle(68, 52, 2) + ' ' + circle(30, 22, 2)]],
  wail: [['b', 'M24 96 L24 44 C24 18 76 18 76 44 L76 96 L66 86 L58 96 L50 86 L42 96 L34 86 Z'], ['h', ellipse(38, 46, 6, 9) + ' ' + ellipse(62, 46, 6, 9) + ' ' + ellipse(50, 70, 8, 12)]],
  shade: [['b', 'M50 6 C66 6 74 20 74 38 C74 54 82 70 90 98 L10 98 C18 70 26 54 26 38 C26 20 34 6 50 6 Z'], ['h', 'M50 22 C60 22 64 30 64 40 C64 52 58 58 50 58 C42 58 36 52 36 40 C36 30 40 22 50 22 Z'], ['a', circle(44, 40, 2.5) + ' ' + circle(56, 40, 2.5)]],
  lips: [['b', 'M8 52 C20 38 34 32 42 38 C46 40 48 42 50 42 C52 42 54 40 58 38 C66 32 80 38 92 52 C80 68 64 78 50 78 C36 78 20 68 8 52 Z'], ['h', 'M14 52 C30 50 40 56 50 56 C60 56 70 50 86 52 C70 56 60 60 50 60 C40 60 30 56 14 52 Z']],
  gale: [['b', 'M14 14 L86 14 C80 30 70 40 62 50 C58 66 54 80 50 96 C46 80 40 66 36 52 C26 40 18 28 14 14 Z'], ['d', 'M20 22 C40 28 60 22 80 24 M28 36 C44 40 58 34 72 38 M36 50 C46 54 56 48 64 52 M42 66 C48 68 54 64 58 66']],
  maw: [['b', 'M8 40 C30 16 70 16 92 40 C82 80 18 80 8 40 Z'], ['h', 'M18 42 C36 30 64 30 82 42 C74 66 26 66 18 42 Z'], ['a', 'M22 42 L28 54 L34 40 L40 52 L46 38 L52 52 L58 38 L64 52 L70 40 L76 54 L80 42 Z M30 62 L36 54 L42 64 L48 54 L54 64 L60 54 L66 62 Z']],
  bile: [['b', 'M30 20 C40 14 62 14 70 22 C80 32 80 46 72 54 C70 66 66 78 62 84 C60 76 58 70 54 66 C52 74 50 86 46 94 C44 84 42 72 40 66 C34 70 32 78 30 84 C28 74 26 62 28 54 C20 46 20 30 30 20 Z'], ['a', circle(40, 34, 5) + ' ' + circle(60, 32, 4) + ' ' + circle(52, 46, 3)]],
  fly: [['b', ellipse(50, 60, 12, 20) + ' ' + circle(50, 36, 10)], ['a', ellipse(30, 40, 18, 9) + ' ' + ellipse(70, 40, 18, 9)], ['h', circle(45, 33, 3.5) + ' ' + circle(55, 33, 3.5)], ['d', 'M44 62 L56 62 M44 70 L56 70 M40 56 L28 72 M60 56 L72 72']],
  gold: [['b', [[30, 86], [50, 86], [70, 86], [40, 72], [60, 72], [50, 58]].map(([x, y]) => ellipse(x, y, 13, 6) + ' ' + rect(x - 13, y, 26, 8)).join(' ')], ['a', star(72, 34, 10, 3, 4) + ' ' + star(30, 40, 6, 2, 4)]],
  rage: [['b', SKULL + ' M18 30 C10 22 8 10 12 2 C16 14 24 20 30 22 Z M82 30 C90 22 92 10 88 2 C84 14 76 20 70 22 Z'], ['h', ellipse(37, 48, 8, 9) + ' ' + ellipse(63, 48, 8, 9) + ' M50 58 L55 68 L45 68 Z'], ['d', 'M36 80 L36 72 M44 80 L44 72 M52 80 L52 72 M60 80 L60 72']],
  mire: [['b', 'M4 70 C16 62 26 74 38 66 C50 58 60 72 72 64 C82 58 92 66 96 70 L96 98 L4 98 Z'], ['a', ring(30, 50, 8, 2) + ' ' + ring(62, 40, 11, 2.5) + ' ' + ring(78, 54, 5, 1.6)]],
  brokenHalo: [['b', tf('M14 40 C14 26 40 24 46 26 L44 32 C38 31 22 32 22 40 C22 46 34 50 40 50 L38 56 C26 56 14 50 14 40 Z', { rot: -12, cy: 40 }) + ' ' + tf('M56 26 C66 26 86 28 86 40 C86 50 70 56 58 56 L60 50 C70 50 78 46 78 40 C78 34 66 32 54 32 Z', { rot: 14, cy: 40, dy: 8 })], ['a', star(50, 40, 8, 2, 4)]],
  blackCandle: [['b', 'M40 40 L60 40 L60 92 L40 92 Z M26 90 L74 90 L70 100 L30 100 Z'], ['a', 'M50 6 C58 18 60 26 50 36 C40 26 42 18 50 6 Z'], ['d', 'M44 40 L44 56 M55 40 L55 48']],
  hook: [['b', 'M46 4 L54 4 L54 64 C54 80 66 84 72 76 C76 70 74 62 70 58 L80 50 C88 60 88 76 80 86 C70 98 44 96 42 76 L42 60 L34 66 L30 60 L46 46 Z']],
  pitch: [['b', 'M14 44 L86 44 C86 74 72 92 50 92 C28 92 14 74 14 44 Z M8 40 L92 40 L92 48 L8 48 Z M30 92 L22 100 L30 100 Z M70 92 L78 100 L70 100 Z'], ['a', circle(34, 34, 6) + ' ' + circle(54, 30, 8) + ' ' + circle(70, 36, 4) + ' ' + circle(44, 18, 3)]],
  arrows: [['b', [-16, 0, 16].map(dx => tf('M50 4 L58 18 L52 18 L52 82 L58 92 L50 88 L42 92 L48 82 L48 18 L42 18 Z', { dx, rot: dx * 1.2, cy: 92 })).join(' ')]],
  horns: [['b', 'M44 70 C30 70 14 60 10 40 C8 28 12 14 20 6 C20 22 26 40 46 52 Z M56 70 C70 70 86 60 90 40 C92 28 88 14 80 6 C80 22 74 40 54 52 Z ' + ellipse(50, 74, 18, 20)], ['h', circle(42, 72, 3) + ' ' + circle(58, 72, 3)]],
  mask: [['b', 'M16 20 C30 14 70 14 84 20 C86 52 74 84 50 92 C26 84 14 52 16 20 Z'], ['h', 'M26 40 C30 34 38 34 42 40 C38 44 30 44 26 40 Z M58 40 C62 34 70 34 74 40 C70 44 62 44 58 40 Z M30 60 C40 74 60 74 70 60 C60 66 40 66 30 60 Z']],
  fangs: [['b', 'M6 30 C30 14 70 14 94 30 L88 44 C70 36 30 36 12 44 Z M12 70 C30 62 70 62 88 70 L94 84 C70 92 30 92 6 84 Z'], ['a', 'M20 40 L26 62 L32 38 Z M68 38 L74 62 L80 40 Z M40 36 L44 50 L48 36 Z M52 36 L56 50 L60 36 Z']],
  serpent: [['b', 'M70 10 C84 10 90 22 84 30 C78 38 64 34 52 38 C34 44 30 56 42 62 C54 68 74 62 76 76 C78 90 60 96 40 94 C26 92 16 88 12 84 C24 86 36 88 46 86 C60 84 62 78 52 74 C36 68 16 66 18 50 C20 32 42 28 58 26 C64 24 64 18 58 16 Z'], ['h', circle(76, 18, 2.5)], ['a', 'M86 22 L96 20 L92 24 L96 28 L86 26 Z']],
  hellfire: [['b', tf(FLAME, { sx: 1.05, sy: 1, cy: 98 })], ['h', tf(SKULL, { sx: .44, sy: .44, cy: 70, dy: 4 })], ['a', tf(FLAME_IN, { sx: .6, sy: .5, cy: 98 })]],
  contract: [['b', 'M24 14 L76 14 L76 82 L24 82 Z ' + ellipse(50, 14, 26, 6)], ['d', 'M32 28 L68 28 M32 38 L68 38 M32 48 L60 48 M32 58 L64 58'], ['a', 'M58 72 C58 64 66 60 70 66 C74 60 82 64 82 72 C82 80 70 88 70 88 C70 88 58 80 58 72 Z']],

  /* --- charms, events, the map --- */
  wool: [['b', 'M18 70 C8 64 10 50 20 48 C18 36 32 30 40 36 C44 26 60 26 64 36 C74 30 88 38 84 50 C94 54 92 70 82 72 C84 82 72 88 64 82 C58 90 42 90 36 82 C26 88 14 82 18 70 Z'], ['d', 'M34 56 C38 50 44 52 44 58 M54 50 C58 44 66 46 64 54 M44 70 C48 64 56 66 56 72']],
  rosary: [['b', Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2 - Math.PI / 2; return circle(50 + Math.cos(a) * 30, 42 + Math.sin(a) * 30, 4.5); }).join(' ') + ' ' + circle(50, 80, 5) + ' ' + circle(50, 90, 4)], ['a', star(50, 96, 6, 2, 4)]],
  seed: [['b', 'M50 30 C66 30 76 50 70 70 C66 84 58 92 50 92 C42 92 34 84 30 70 C24 50 34 30 50 30 Z'], ['a', 'M50 30 C48 20 52 12 60 6 C62 16 58 24 50 30 Z'], ['d', 'M50 40 C46 56 46 72 50 86']],
  sack: [['b', 'M34 24 L66 24 L60 34 C80 44 86 66 80 82 C74 94 26 94 20 82 C14 66 20 44 40 34 Z'], ['d', 'M36 30 L64 30 M30 56 L40 62 M60 70 L70 64'], ['a', 'M44 20 C48 14 52 14 56 20 Z']],
  thornCrown: [['b', ringE(50, 54, 40, 18, 7)], ['a', Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; const x = 50 + Math.cos(a) * 38, y = 54 + Math.sin(a) * 17; return `M${f(x - 2)} ${f(y)} L${f(x + Math.cos(a + 1) * 12)} ${f(y + Math.sin(a + 1) * 9 - 6)} L${f(x + 2)} ${f(y)} Z`; }).join(' ')]],
  box: [['b', 'M14 40 L86 40 L86 90 L14 90 Z M10 28 L90 28 L90 42 L10 42 Z'], ['a', circle(50, 60, 7) + ' M47 62 L53 62 L54 74 L46 74 Z'], ['d', 'M14 52 L86 52']],
  splinter: [['b', 'M30 96 L38 30 L46 6 L52 28 L60 18 L58 42 L66 96 Z'], ['d', 'M44 40 L46 90 M54 46 L56 92'], ['a', star(74, 20, 9, 3, 4)]],
  olive: [['b', 'M50 98 C50 70 44 40 30 14 L34 12 C48 38 54 68 54 98 Z ' + [[36, 30, -40], [56, 26, 30], [32, 52, -50], [60, 50, 40], [40, 72, -40], [62, 72, 40]].map(([x, y, r]) => tf('M50 40 C58 34 64 38 66 46 C58 50 52 48 50 40 Z', { dx: x - 50, dy: y - 44, rot: r, cx: 50, cy: 42 })).join(' ')], ['a', circle(66, 84, 5) + ' ' + circle(30, 88, 4)]],
  lantern: [['b', 'M36 26 L64 26 L70 36 L70 80 L64 90 L36 90 L30 80 L30 36 Z M42 16 L58 16 L58 26 L42 26 Z ' + ring(50, 10, 7, 3)], ['h', 'M36 38 L64 38 L64 78 L36 78 Z'], ['a', 'M50 44 C56 52 58 60 50 70 C42 60 44 52 50 44 Z']],
  crook: [['b', 'M46 98 L46 38 C46 18 58 8 70 8 C82 8 90 18 90 30 C90 40 84 46 78 46 L78 38 C82 38 84 34 84 30 C84 22 78 16 70 16 C62 16 54 22 54 38 L54 98 Z']],
  rod: [['b', 'M47 98 L49 20 L53 20 L53 98 Z ' + [[40, 30, -40], [62, 40, 40], [40, 54, -40], [62, 64, 40]].map(([x, y, r]) => tf('M50 40 C58 34 64 38 66 46 C58 50 52 48 50 40 Z', { dx: x - 50, dy: y - 44, rot: r, cx: 50, cy: 42 })).join(' ')], ['a', circle(51, 14, 6) + ' ' + star(51, 14, 11, 3, 5)]],
  lamps: [['b', [18, 34, 50, 66, 82].map((x, i) => rect(x - 4, 60 - Math.abs(i - 2) * 6, 8, 34 + Math.abs(i - 2) * 6)).join(' ') + ' M10 92 L90 92 L90 98 L10 98 Z'], ['a', [18, 34, 50, 66, 82].map((x, i) => tf('M50 6 C56 14 58 22 50 30 C42 22 44 14 50 6 Z', { dx: x - 50, dy: 28 - Math.abs(i - 2) * 6, sx: .7 })).join(' ')]],
  wormwood: [['b', 'M48 98 L52 98 L52 30 L48 30 Z ' + star(50, 22, 18, 5, 6)], ['a', circle(50, 22, 5)], ['d', 'M50 60 L34 48 M50 72 L66 60 M50 84 L36 76']],
  phoenix: [['b', tf(WING, { rot: -20, cy: 60 }) + ' ' + mirror(tf(WING, { rot: -20, cy: 60 })) + ' M50 30 C56 30 58 36 56 42 L60 44 L54 46 L56 70 C54 82 50 92 50 98 C50 92 46 82 44 70 L46 46 C42 42 44 30 50 30 Z'], ['a', tf(FLAME, { sx: .3, sy: .3, cy: 30, dy: -10 })]],
  bone: [['b', 'M44 22 C38 10 22 14 26 26 C16 28 18 44 30 40 L58 82 C54 92 66 98 72 88 C80 92 88 80 78 74 C84 64 70 58 66 66 L38 26 Z']],
  wheel: [['b', ring(50, 50, 40, 6) + ' ' + ring(50, 50, 26, 5)], ['a', [0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3; return tf(EYE, { sx: .16, sy: .16, dx: Math.cos(a) * 33, dy: Math.sin(a) * 33 }); }).join(' ') + ' ' + tf(EYE, { sx: .28, sy: .28 })]],
  coins: [['b', [[34, 70], [58, 64], [46, 46], [66, 40], [30, 40]].map(([x, y]) => circle(x, y, 14)).join(' ')], ['h', [[34, 70], [58, 64], [46, 46], [66, 40], [30, 40]].map(([x, y]) => ring(x, y, 10, 1.5)).join(' ')]],
  clipped: [['b', 'M50 62 C42 44 30 36 16 36 L20 46 L14 52 L22 58 L18 66 C30 65 40 66 50 72 Z ' + mirror('M50 62 C42 44 26 32 4 33 C12 37 17 41 19 45 C11 45 7 48 3 53 C12 52 18 54 21 58 C14 60 11 63 9 68 C20 65 32 66 50 72 Z')], ['d', 'M16 36 L20 46 L14 52 L22 58 L18 66']],
  ironCrown: [['b', 'M12 80 L12 40 L28 52 L40 30 L50 46 L60 30 L72 52 L88 40 L88 80 Z M10 82 L90 82 L90 94 L10 94 Z'], ['h', circle(30, 70, 4) + ' ' + circle(50, 70, 4) + ' ' + circle(70, 70, 4)]],
  jar: [['b', 'M38 14 L62 14 L62 22 L58 22 L58 30 C78 36 84 54 80 72 C76 90 64 96 50 96 C36 96 24 90 20 72 C16 54 22 36 42 30 L42 22 L38 22 Z'], ['d', 'M26 54 L74 54 M24 70 L76 70'], ['a', star(50, 62, 7, 2, 4)]],
  laurel: [['b', [0, 1, 2, 3, 4, 5].map(i => tf('M50 40 C58 34 64 38 66 46 C58 50 52 48 50 40 Z', { dx: -26 + i * 2, dy: 36 - i * 10, rot: -60 + i * 18, cx: 50, cy: 42 })).join(' ') + ' ' + [0, 1, 2, 3, 4, 5].map(i => mirror(tf('M50 40 C58 34 64 38 66 46 C58 50 52 48 50 40 Z', { dx: -26 + i * 2, dy: 36 - i * 10, rot: -60 + i * 18, cx: 50, cy: 42 }))).join(' ')], ['d', 'M30 92 C18 70 18 40 34 16 M70 92 C82 70 82 40 66 16']],
  pool: [['b', ellipse(50, 78, 44, 14)], ['h', ellipse(50, 76, 36, 9)], ['a', ellipse(50, 30, 12, 4) + ' ' + star(50, 20, 8, 2, 4)]],
  dice: [['b', 'M20 44 L50 30 L80 44 L80 80 L50 96 L20 80 Z'], ['h', circle(36, 62, 4) + ' ' + circle(64, 70, 4) + ' ' + circle(64, 54, 4) + ' ' + circle(50, 40, 4)], ['d', 'M20 44 L50 58 L80 44 M50 58 L50 96']],
  tomb: [['b', 'M12 98 L12 60 L88 60 L88 98 Z M8 50 L92 44 L92 54 L8 60 Z'], ['a', tf(FLAME, { sx: .5, sy: .4, cy: 50, dy: -18 })], ['d', 'M24 72 L76 72 M24 84 L76 84']],
  chains: [['b', [0, 1, 2, 3].map(i => i % 2 ? ringE(26 + i * 16, 52, 10, 6, 3.5) : ringE(26 + i * 16, 52, 10, 6, 3.5)).join(' ')], ['a', tf(SKULL, { sx: .3, sy: .3, cy: 90 })]],
  shrine: [['b', 'M20 98 L20 44 L50 18 L80 44 L80 98 Z'], ['h', 'M32 98 L32 54 C32 44 68 44 68 54 L68 98 Z'], ['a', 'M50 62 C56 70 58 78 50 86 C42 78 44 70 50 62 Z']],
  ledger: [['b', 'M8 30 C24 24 40 26 50 34 C60 26 76 24 92 30 L92 86 C76 80 60 82 50 90 C40 82 24 80 8 86 Z'], ['d', 'M50 34 L50 90 M16 42 L42 44 M16 52 L42 54 M16 62 L38 64 M58 44 L84 42 M58 54 L84 52 M58 64 L80 62'], ['a', circle(70, 74, 6)]],
  tree: [['b', 'M44 98 L46 64 C34 60 22 50 18 36 L24 34 C28 44 36 52 46 56 L46 40 C40 32 38 22 40 12 L46 14 C46 22 48 30 52 34 C56 26 60 18 68 12 L72 16 C64 24 58 34 56 46 C64 44 74 38 80 28 L84 32 C78 44 66 54 56 58 L58 98 Z'], ['a', circle(30, 46, 2.5) + ' ' + circle(76, 36, 2.5)]],
  ice: [['b', 'M6 98 L14 70 L24 82 L30 52 L42 76 L50 40 L58 74 L70 50 L76 82 L86 66 L94 98 Z'], ['a', circle(50, 28, 10)], ['h', circle(46, 26, 2) + ' ' + circle(54, 26, 2)]],
  boat: [['b', 'M6 70 L94 70 C88 84 74 92 50 92 C26 92 12 84 6 70 Z M66 70 L66 16 L70 16 L70 70 Z'], ['a', 'M48 70 C44 60 46 52 52 50 C58 52 60 60 56 70 Z'], ['d', 'M68 18 L30 66']],
  skull: [['b', SKULL], ['h', ellipse(37, 48, 8, 9) + ' ' + ellipse(63, 48, 8, 9) + ' M50 58 L55 68 L45 68 Z'], ['d', 'M36 80 L36 72 M44 80 L44 72 M52 80 L52 72 M60 80 L60 72']],
  flameSkull: [['b', tf(FLAME, { sx: 1.1, cy: 80 }) ], ['h', tf(SKULL, { sx: .56, sy: .56, cy: 68, dy: 8 })]],
  sanctuary: [['b', 'M14 98 L14 50 L50 20 L86 50 L86 98 Z'], ['h', 'M38 98 L38 66 C38 56 62 56 62 66 L62 98 Z'], ['a', 'M50 64 C56 72 58 80 50 90 C42 80 44 72 50 64 Z ' + star(50, 10, 8, 2, 4)]],
  treasure: [['b', 'M12 52 L88 52 L88 94 L12 94 Z M12 50 C12 28 88 28 88 50 Z'], ['a', rect(44, 56, 12, 14) + ' ' + rays(50, 40, 30, 46, 7, 5, 200)], ['d', 'M12 66 L88 66']],
  question2: [['b', 'M30 34 C30 18 40 8 52 8 C66 8 76 18 76 32 C76 46 64 52 58 58 C56 60 56 64 56 70 L44 70 C44 60 46 54 52 48 C58 42 64 40 64 32 C64 24 58 20 52 20 C46 20 42 26 42 34 Z ' + circle(50, 86, 8)]],
  horned: [['b', SKULL + ' M18 34 C8 24 6 10 14 0 C16 14 24 22 32 24 Z M82 34 C92 24 94 10 86 0 C84 14 76 22 68 24 Z'], ['h', 'M30 44 L44 48 L42 56 L30 54 Z M70 44 L56 48 L58 56 L70 54 Z M50 60 L55 70 L45 70 Z']],
};

// A Path2D for each layer, made once.
const CACHE = new Map();
export function glyphLayers(name) {
  let l = CACHE.get(name);
  if (!l) { l = (GLYPHS[name] ?? GLYPHS.star).map(([role, d]) => [role, new Path2D(d)]); CACHE.set(name, l); }
  return l;
}

// Draw a glyph in a box: x, y is the top-left of a 100-unit square drawn s pixels wide.
// p: { body, body2 (gradient end), accent, detail, hole, glow, glowBlur, outline }
export function drawGlyph(g, name, x, y, s, p) {
  const layers = glyphLayers(name), k = s / 100;
  g.save();
  g.translate(x, y); g.scale(k, k);
  const grad = g.createLinearGradient(0, 0, 0, 100);
  grad.addColorStop(0, p.body); grad.addColorStop(1, p.body2 ?? p.body);
  // glow behind everything
  if (p.glow) {
    g.save();
    g.shadowColor = p.glow; g.shadowBlur = Math.min(24, (p.glowBlur ?? 18) * k * 1.2);
    for (const [role, path] of layers) if (role === 'b' || role === 'a') { g.fillStyle = p.glow; g.fill(path); }
    g.restore();
  }
  for (const [role, path] of layers) {
    if (role === 'b') {
      g.fillStyle = grad; g.fill(path);
      if (p.outline) { g.lineWidth = 2.2; g.strokeStyle = p.outline; g.lineJoin = 'round'; g.stroke(path); }
    } else if (role === 'a') {
      g.fillStyle = p.accent ?? p.body; g.fill(path);
      if (p.outline) { g.lineWidth = 1.4; g.strokeStyle = p.outline; g.stroke(path); }
    } else if (role === 'h') {
      g.fillStyle = p.hole ?? 'rgba(0,0,0,.6)'; g.fill(path);
    } else if (role === 'd') {
      g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = p.detail ?? p.outline ?? 'rgba(0,0,0,.5)'; g.stroke(path);
    }
  }
  g.restore();
}
