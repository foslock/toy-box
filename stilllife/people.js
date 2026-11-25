// The cast, drawn as flat poster figures: thick ink outline, flat colour, one hard shadow.
// A figure is a pose (joint positions) plus a character (skin, hair, clothes). Ground is y = 0, up is negative.
export const INK = '#1c1730';
const S = 5;
let uid = 0;
const n = (v) => Math.round(v * 10) / 10;
const pt = (p) => `${n(p[0])} ${n(p[1])}`;
export const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${S}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
export const flat = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
export const line = (d, w = 3, c = INK, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function limb(pts, w, col, w2 = w * 0.84) {
  const [a, b, c] = pts;
  const d1 = `M${pt(a)} L${pt(b)}`, d2 = `M${pt(b)} L${pt(c)}`;
  return line(d1, w + S * 2, INK) + line(d2, w2 + S * 2, INK) + line(d1, w, col) + line(d2, w2, col);
}

// A hand at the end of a forearm. kinds: mitt, fist, spread, point
function hand(from, at, skin, kind = 'mitt') {
  const a = Math.atan2(at[1] - from[1], at[0] - from[0]) * 180 / Math.PI;
  let g = '';
  const finger = (x, y, x2, y2, w = 8) => line(`M${x} ${y} L${x2} ${y2}`, w + 7, INK) ;
  const fingerC = (x, y, x2, y2, w = 8) => line(`M${x} ${y} L${x2} ${y2}`, w, skin);
  if (kind === 'spread') {
    const f = [[6, -8, 22, -19], [10, -3, 30, -7], [10, 3, 30, 6], [6, 8, 23, 17], [-2, -9, 4, -24]];
    g = f.map((q) => finger(...q, 7)).join('') + path('M-12 -9 Q0 -14 10 -9 Q14 0 10 9 Q0 14 -12 9Z', skin) + f.map((q) => fingerC(...q, 7)).join('');
  } else if (kind === 'point') {
    g = finger(6, -5, 32, -6, 8) + path('M-12 -9 Q2 -14 12 -8 Q16 2 10 10 Q0 14 -12 9Z', skin) + fingerC(4, -5, 32, -6, 8) + line('M4 3 Q10 4 13 2', 2.5);
  } else if (kind === 'fist') {
    g = path('M-12 -9 Q2 -15 13 -9 Q18 0 13 10 Q2 15 -12 9Z', skin) + line('M6 -4 L14 -4 M6 3 L14 3', 2.5);
  } else {
    g = path('M-12 -8 Q2 -13 16 -9 Q26 -4 24 2 Q18 11 4 11 Q-6 11 -12 8Z', skin) + path('M2 -9 Q8 -18 14 -15 Q16 -10 8 -5', skin);
  }
  return `<g transform="translate(${pt(at)}) rotate(${n(a)})">${g}</g>`;
}

function shoe(knee, foot, col, dir, heel) {
  return `<g transform="translate(${pt(foot)}) scale(${dir} 1)">${heel
    ? path('M-12 -6 L-12 10 L-7 10 L-4 2 Q8 10 26 10 Q28 2 16 -2 L6 -10 Z', col)
    : path('M-15 -10 L-16 10 L30 10 Q32 0 16 -5 L10 -12 Z', col)}</g>`;
}

// ---------- heads ----------
const FACE = 'M-27 -20 C-30 -50 29 -52 30 -20 C32 4 25 29 9 42 C2 46 -7 44 -13 37 C-24 24 -27 2 -27 -20Z';

function eye(x, w, mood, c, dir = 0, lid = 'none', skin) {
  const h = mood === 'wide' ? 9 : mood === 'lid' ? 5.5 : 7;
  if (mood === 'closed') return line(`M${x - w} -6 Q${x} 0 ${x + w} -6`, 3.5);
  const id = 'e' + (++uid);
  let g = `<clipPath id="${id}"><path d="M${x - w} -6 Q${x} ${-6 - h * 1.5} ${x + w} -6 Q${x} ${-6 + h * 1.3} ${x - w} -6Z"/></clipPath>`;
  if (lid !== 'none') g += flat(`M${x - w - 3} -6 Q${x - 1} ${-13 - h * 1.5} ${x + w + 3} -7Z`, lid);
  g += flat(`M${x - w} -6 Q${x} ${-6 - h * 1.5} ${x + w} -6 Q${x} ${-6 + h * 1.3} ${x - w} -6Z`, '#fff6e2');
  g += `<circle cx="${x + dir * w * 0.45}" cy="${mood === 'down' ? -4 : -7}" r="${mood === 'wide' ? 4 : 5}" fill="${INK}" clip-path="url(#${id})"/>`;
  g += line(`M${x - w - 1} -6 Q${x} ${-6 - h * 1.6} ${x + w + 1} -7`, 3.6);
  if (mood === 'wide') g += line(`M${x - w} -5 Q${x} ${-6 + h * 1.3} ${x + w} -6`, 2);
  return g;
}

function mouth(m, lips) {
  const c = lips || '#8f2f2c';
  switch (m) {
    case 'smile': return line('M4 23 Q13 31 22 21', 3.6, lips ? c : INK) + (lips ? flat('M5 23 Q13 29 21 22 Q13 24 5 23Z', c) : '');
    case 'grin': return path('M1 20 Q13 24 24 18 Q20 36 10 34 Q3 31 1 20Z', '#fff6e2', 'style="stroke-width:3.5"') + (lips ? line('M1 20 Q13 24 24 18', 4, c) : '');
    case 'o': return path('M8 26 m-6 0 a6 8 0 1 0 12 0 a6 8 0 1 0 -12 0', c, 'style="stroke-width:3"');
    case 'shock': return path('M3 20 Q12 15 21 20 Q24 38 12 39 Q1 38 3 20Z', '#5d1626', 'style="stroke-width:3.5"') + flat('M6 33 Q12 28 18 33 Q14 37 9 37Z', '#d9634f');
    case 'frown': return line('M4 28 Q13 20 21 27', 3.6, lips ? c : INK);
    case 'grit': return path('M3 21 L22 19 L21 30 L4 31Z', '#fff6e2', 'style="stroke-width:3"') + line('M9 21 L9 30 M15 20 L15 30', 2);
    default: return lips ? path('M5 24 Q9 20 12 22 Q16 19 20 23 Q13 30 5 24Z', c, 'style="stroke-width:2"') : line('M4 25 L20 24', 3.6);
  }
}

const HAIR = {
  bobBlond: (c) => ({ back: path('M-32 -20 C-44 -8 -42 22 -34 32 L-8 30 L30 -10 Z', c), front: path('M-33 -16 C-40 -62 34 -66 35 -18 C28 -20 24 -32 16 -38 C4 -26 -10 -26 -14 -14 C-16 0 -10 8 -6 18 C-12 26 -24 30 -34 26 C-38 12 -34 0 -33 -16Z', c) + line('M-28 -16 C-28 -36 -8 -48 8 -46 M-26 0 C-28 10 -26 18 -22 24', 2.5) }),
  bobBlack: (c) => ({ back: path('M-34 -16 C-40 6 -38 24 -34 30 L-6 30 L32 -8 Z', c), front: path('M-34 -14 C-42 -64 36 -66 37 -14 L36 6 C33 2 31 -6 30 -15 C18 -20 2 -21 -14 -16 C-16 -4 -12 6 -2 14 C-8 24 -22 30 -36 28 C-38 12 -35 0 -34 -14Z', c) + line('M-22 -44 C-10 -52 8 -52 18 -46', 3, '#6a63a0') }),
  slick: (c) => ({ back: '', front: path('M-31 -4 C-36 -60 30 -66 33 -22 C28 -30 20 -38 6 -36 C-6 -36 -18 -30 -20 -16 L-22 4 L-29 6 Z', c) + line('M-22 -22 C-16 -42 4 -50 22 -42 M-26 -8 C-26 -24 -20 -36 -10 -44', 2.5) }),
  centre: (c) => ({ back: '', front: path('M-31 -2 C-36 -62 32 -66 33 -18 C30 -30 22 -36 10 -42 C-4 -38 -18 -30 -20 -14 L-22 6 L-29 8 Z', c) + line('M10 -42 L6 -56', 2.5) }),
  wavy: (c) => ({ back: '', front: path('M-30 2 C-38 -14 -38 -34 -28 -42 C-28 -56 -10 -62 0 -56 C12 -66 32 -58 31 -44 C40 -40 38 -26 33 -20 C28 -26 24 -32 16 -32 C8 -24 -4 -34 -14 -26 C-20 -20 -18 -8 -22 4 L-28 6Z', c) + line('M-18 -38 Q-8 -46 2 -40 Q12 -48 22 -42', 2.5) }),
  forelock: (c) => ({ back: '', front: path('M-31 -2 C-36 -60 28 -68 34 -26 C28 -32 20 -34 10 -33 C-4 -32 -16 -28 -20 -14 L-22 5 L-29 7 Z', c) + path('M2 -32 C4 -44 -2 -54 -10 -56 C6 -60 18 -48 14 -33 C10 -34 6 -34 2 -32Z', '#fff6e2', 'style="stroke-width:3.5"') }),
  forelockOld: (c) => ({ back: '', front: path('M-31 4 C-38 -30 -30 -50 -16 -52 C-20 -40 -18 -24 -22 6 Z', c) + path('M-20 -46 C-8 -62 28 -60 33 -30 C24 -34 12 -34 4 -38 C-4 -40 -14 -42 -20 -46Z', c) + path('M2 -38 C4 -46 -2 -52 -10 -51 C6 -58 20 -50 16 -35 C10 -36 6 -37 2 -38Z', '#fff6e2', 'style="stroke-width:3.5"') }),
  bun: (c) => ({ back: path('M-30 -14 m-18 4 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0', c), front: path('M-31 0 C-36 -58 32 -64 34 -18 C26 -26 18 -36 8 -40 C-4 -32 -16 -24 -20 -10 C-20 -2 -22 4 -27 8Z', c) }),
  marcel: (c) => ({ back: path('M-30 -10 C-44 -4 -44 18 -32 26 C-22 30 -16 22 -18 10Z', c), front: path('M-32 -2 C-42 -60 34 -70 36 -20 C30 -18 28 -30 18 -32 C12 -20 0 -30 -6 -20 C-14 -22 -16 -8 -14 0 C-16 12 -26 14 -32 10 C-34 6 -33 2 -32 -2Z', c) + line('M-26 -10 Q-22 -22 -12 -24 Q-8 -36 6 -34 Q14 -46 28 -36 M-28 -26 Q-18 -32 -14 -42 Q0 -44 8 -52', 2.6) }),
  bald: (c) => ({ back: '', front: path('M-31 8 C-38 -6 -36 -22 -30 -28 C-24 -24 -22 -8 -22 6Z', c) }),
  curls: (c) => ({ back: '', front: path('M-30 4 C-36 -2 -38 -14 -33 -20 C-40 -30 -34 -42 -26 -44 C-24 -56 -8 -60 0 -54 C10 -62 26 -56 28 -46 C38 -42 38 -28 33 -22 C28 -30 18 -34 8 -33 C-6 -34 -16 -28 -19 -14 L-21 5Z', c) + line('M-20 -36 q4 -6 9 -2 M-4 -44 q5 -5 10 0 M14 -44 q5 -4 9 1', 2.5, '#5a4460') }),
};

const HATS = {
  boater: () => path('M-40 -34 Q0 -22 42 -34 L42 -40 Q0 -30 -40 -40Z', '#f2d28a') + path('M-27 -37 L-25 -62 Q0 -56 28 -62 L29 -37 Q0 -30 -27 -37Z', '#f2d28a') + path('M-27 -38 L-26 -48 Q0 -41 28.500 -48 L29 -37 Q0 -30 -27 -38Z', '#d6452c'),
  cloche: (c = '#2f7f6d') => path('M-38 4 C-46 -62 30 -78 38 -18 C40 -12 44 -8 44 -4 C30 -14 10 -18 -6 -8 C-20 0 -26 12 -38 4Z', c) + path('M-39 -14 C-20 -30 18 -36 39 -22 L40 -12 C20 -26 -14 -20 -38 0Z', '#f2b23e') + path('M-26 -18 l-10 -12 l4 16 l-12 6 l16 4Z', '#f2b23e'),
  toque: () => path('M-26 -34 C-58 -50 -50 -96 -20 -88 C-12 -112 26 -112 30 -90 C58 -96 62 -54 32 -36 L31 -26 Q0 -34 -27 -22Z', '#fff6e2') + line('M-14 -44 L-18 -66 M4 -46 L4 -74 M20 -44 L26 -66', 2.5) + path('M-28 -22 L-27 -38 Q2 -48 32 -38 L33 -26 Q4 -36 -28 -22Z', '#fff6e2'),
  turban: () => path('M-36 -6 C-48 -66 34 -78 38 -18 C20 -32 -10 -28 -36 -6Z', '#6b3b78') + line('M-34 -16 C-10 -44 20 -46 36 -28 M-30 -34 C-8 -56 18 -58 32 -42', 2.6) + path('M14 -42 C2 -70 14 -100 34 -112 C36 -88 34 -62 24 -40Z', '#e9a53a') + line('M20 -44 C18 -70 24 -92 33 -108', 2.2) + path('M18 -38 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', '#2f9c86'),
  plume: () => path('M-32 -22 Q4 -42 36 -24 L36 -34 Q4 -52 -33 -32Z', '#2f9c86') + path('M-18 -36 C-46 -70 -38 -112 -10 -122 C2 -96 0 -62 -8 -38Z', '#f3e3c3') + line('M-13 -38 C-22 -68 -20 -98 -11 -118', 2.2) + path('M-14 -34 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', '#f2b23e'),
  bandeau: () => path('M-33 -22 Q4 -40 35 -24 L35 -33 Q4 -50 -34 -31Z', '#fff6e2') + path('M18 -36 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0', '#f2b23e'),
  aigrette: () => path('M-34 -20 Q4 -38 37 -22 L37 -30 Q4 -47 -35 -28Z', '#f2b23e'),
  porter: () => path('M-30 -30 L-28 -60 Q2 -70 32 -58 L33 -28 Q2 -40 -30 -30Z', '#b2332a'),
};

function head(ch, o = {}) {
  const c = ch.head, f = o.f ?? 1, mood = o.eyes || 'open', m = o.mouth || 'flat', look = o.look ?? 0.5;
  const id = 'h' + (++uid);
  const hair = c.hair ? HAIR[c.hair](c.hairC) : { back: '', front: '' };
  let g = '';
  const hat = o.hat === undefined ? c.hat : o.hat;
  if (hat !== 'cloche' && hat !== 'turban') g += hair.back;
  g += path(FACE, ch.skin);
  g += `<clipPath id="${id}"><path d="${FACE}"/></clipPath><g clip-path="url(#${id})">${flat('M-40 -60 L-4 -60 C-20 -34 -14 -12 -15 6 C-16 22 -8 34 -2 50 L-40 50Z', ch.shade)}${c.rouge ? `<circle cx="-3" cy="14" r="8.500" fill="${c.rouge}" opacity=".75"/><circle cx="25" cy="13" r="6" fill="${c.rouge}" opacity=".75"/>` : ''}</g>`;
  if (c.hair !== 'bobBlack' && c.hair !== 'bobBlond') g += path('M-26 -4 C-36 -12 -38 8 -30 12 C-28 14 -24 12 -24 8', ch.skin, 'style="stroke-width:4"');
  const lid = c.lid || 'none';
  g += eye(2, 9, mood, ch, look, lid) + eye(22, 6.5, mood, ch, look, lid);
  // brow and nose in one stroke, the way the posters do it
  const bw = c.brow || 4, b = mood === 'wide' ? -8 : o.brow === 'angry' ? 3 : 0;
  g += line(o.brow === 'angry' ? `M-9 -24 L8 -14` : `M-9 ${-17 + b} Q2 ${-25 + b} 10 ${-18 + b}`, bw, c.browC || INK);
  g += line(o.brow === 'angry' ? `M28 -22 L16 -14` : `M16 ${-18 + b} Q23 ${-24 + b} 29 ${-17 + b}`, bw, c.browC || INK);
  g += line('M15 -1 L20 9 Q18 14 10 12', 3.2);
  g += mouth(m, c.lips);
  if (c.face) g += c.face(m);
  g += hair.front;
  if (hat && HATS[hat]) g += HATS[hat](c.hatC);
  if (c.over) g += c.over();
  if (c.ear) g += c.ear();
  return `<g transform="translate(${pt(o.at)}) scale(${f} 1) rotate(${o.tilt || 0})">${g}</g>`;
}

const gem = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${INK}" stroke-width="2.500"/>`;
export function pearls(d, nBeads = 0) { return line(d, 11, INK) + line(d, 6.500, '#fff6e2', 'stroke-dasharray="0.1 8.5"') + line(d, 3, '#fff6e2', 'opacity=".5"'); }

// ---------- clothes ----------
function jacket(P, ch, o) {
  const { s, h } = P, sw = ch.sw, hw = ch.hw, f = o.f ?? 1, c = o.coat || ch.coat, dark = o.coatD || ch.coatD, shirt = ch.shirt || '#fff6e2';
  const wy = s[1] + (h[1] - s[1]) * 0.62, wx = s[0] + (h[0] - s[0]) * 0.62, hem = o.hem ?? ch.hem ?? 26, ww = ch.ww || Math.max(hw, sw * 0.78);
  const body = `M${n(s[0] - 14)} ${n(s[1] - 20)} Q${n(s[0] - sw)} ${n(s[1] - 14)} ${n(s[0] - sw - 4)} ${n(s[1] + 14)} L${n(wx - ww)} ${n(wy)} L${n(h[0] - hw - 8)} ${n(h[1] + hem)} L${n(h[0] + hw + 8)} ${n(h[1] + hem)} L${n(wx + ww)} ${n(wy)} L${n(s[0] + sw + 4)} ${n(s[1] + 14)} Q${n(s[0] + sw)} ${n(s[1] - 14)} ${n(s[0] + 14)} ${n(s[1] - 20)}Z`;
  const id = 'j' + (++uid), vx = wx + f * 5, vy = wy - 6;
  let g = path(body, c) + `<clipPath id="${id}"><path d="${body}"/></clipPath><g clip-path="url(#${id})">`;
  g += flat(`M${n(s[0] - f * sw * 0.45)} ${n(s[1] - 40)} L${n(h[0] - f * hw * 0.5)} ${n(h[1] + 60)} L${n(h[0] - f * 120)} ${n(h[1] + 60)} L${n(s[0] - f * 120)} ${n(s[1] - 40)}Z`, dark);
  if (ch.plaid) { for (let i = -5; i < 6; i++) g += line(`M${n(s[0] + i * 20)} ${n(s[1] - 40)} L${n(h[0] + i * 20)} ${n(h[1] + 60)} M${n(s[0] - 120)} ${n(s[1] + 80 + i * 24)} L${n(s[0] + 120)} ${n(s[1] + 80 + i * 24)}`, 2.2, ch.plaid, 'opacity=".7"'); }
  if (ch.stripe && !o.coat) for (let i = -5; i < 6; i++) g += line(`M${n(s[0] + i * 17)} ${n(s[1] - 40)} L${n(h[0] + i * 17)} ${n(h[1] + 60)}`, 4, ch.stripe);
  g += '</g>';
  const nx = s[0] + f * 4;
  if (o.waist || ch.waist) g += path(`M${n(nx - 17)} ${n(s[1] - 20)} L${n(vx - 22)} ${n(wy + 22)} L${n(vx)} ${n(wy + 34)} L${n(vx + 22)} ${n(wy + 22)} L${n(nx + 17)} ${n(s[1] - 20)}Z`, o.waist || ch.waist, 'style="stroke-width:4"');
  g += path(`M${n(nx - 16)} ${n(s[1] - 21)} L${n(vx)} ${n(vy)} L${n(nx + 16)} ${n(s[1] - 21)}Z`, shirt, 'style="stroke-width:4"');
  if (ch.lapel !== false) {
    g += path(`M${n(nx - 15)} ${n(s[1] - 22)} L${n(nx - 34)} ${n(s[1] + 14)} L${n(nx - 24)} ${n(s[1] + 20)} L${n(vx - 1)} ${n(vy + 4)} Z`, ch.lapelC || dark, 'style="stroke-width:4"');
    g += path(`M${n(nx + 15)} ${n(s[1] - 22)} L${n(nx + 34)} ${n(s[1] + 14)} L${n(nx + 24)} ${n(s[1] + 20)} L${n(vx + 1)} ${n(vy + 4)} Z`, ch.lapelC || dark, 'style="stroke-width:4"');
  }
  const tie = o.tie || ch.tie;
  if (tie === 'bow') g += path(`M${n(nx)} ${n(s[1] - 16)} l-17 -9 l0 18 Z M${n(nx)} ${n(s[1] - 16)} l17 -9 l0 18 Z`, ch.tieC || INK, 'style="stroke-width:3"');
  else if (tie) g += path(`M${n(nx - 6)} ${n(s[1] - 18)} l12 0 l-2 10 l5 34 l-9 12 l-9 -12 l5 -34Z`, ch.tieC, 'style="stroke-width:3"');
  const by = vy + 14;
  g += gem(vx, by, 3.5, ch.btn || '#f2b23e') + (hem > 10 ? gem(wx + (h[0] - wx) * 0.6 + f * 4, wy + (h[1] - wy) * 0.75, 3.5, ch.btn || '#f2b23e') : '');
  if (ch.extra) g += ch.extra(P, o);
  return g;
}

function dress(P, ch, o) {
  const { s, h } = P, sw = ch.sw, hw = ch.hw, f = o.f ?? 1, c = ch.dress, dark = ch.dressD, hem = o.hemY ?? ch.hemY ?? -110, sway = o.sway || 0, flare = o.flare ?? ch.flare ?? 1.5;
  const bx = h[0] + sway;
  const body = `M${n(s[0] - 15)} ${n(s[1] - 16)} L${n(s[0] - sw)} ${n(s[1] - 6)} Q${n(s[0] - sw - 2)} ${n(s[1] + 30)} ${n(h[0] - hw)} ${n(h[1])} L${n(bx - hw * flare)} ${n(hem)} Q${n(bx)} ${n(hem + 14)} ${n(bx + hw * flare)} ${n(hem)} L${n(h[0] + hw)} ${n(h[1])} Q${n(s[0] + sw + 2)} ${n(s[1] + 30)} ${n(s[0] + sw)} ${n(s[1] - 6)} L${n(s[0] + 15)} ${n(s[1] - 16)} Q${n(s[0] + f * 4)} ${n(s[1] + 20)} ${n(s[0] - 15)} ${n(s[1] - 16)}Z`;
  const id = 'd' + (++uid);
  let g = path(body, c) + `<clipPath id="${id}"><path d="${body}"/></clipPath><g clip-path="url(#${id})">`;
  g += flat(`M${n(s[0] - f * sw * 0.4)} ${n(s[1] - 30)} L${n(h[0] - f * hw * 0.35)} ${n(h[1])} L${n(bx - f * hw * flare * 0.35)} ${n(hem + 30)} L${n(bx - f * 200)} ${n(hem + 30)} L${n(s[0] - f * 120)} ${n(s[1] - 30)}Z`, dark);
  const L = hem - h[1];
  if (ch.trim === 'fringe') for (let i = -7; i <= 7; i++) g += line(`M${n(h[0] + i * hw * 0.16 + sway * 0.4)} ${n(h[1] + L * 0.5)} L${n(bx + i * hw * flare * 0.15)} ${n(hem + 20)}`, 2.6, ch.trimC);
  if (ch.trim === 'scallop') for (let r = 0; r < 3; r++) { let d = ''; for (let i = -6; i < 6; i++) { const w = hw * flare / 4; d += `M${n(bx + i * w)} ${n(hem - 12 - r * 20)} a${n(w / 2)} ${n(w / 2)} 0 0 0 ${n(w)} 0 `; } g += line(d, 2.6, ch.trimC); }
  if (ch.trim === 'chevron') for (let r = 0; r < 4; r++) g += line(`M${n(bx - 200)} ${n(hem - 4 - r * 26 - 40)} L${n(bx)} ${n(hem - r * 26)} L${n(bx + 200)} ${n(hem - 44 - r * 26)}`, 5, ch.trimC);
  if (ch.trim === 'beads') for (let r = 0; r < 12; r++) for (let i = -5; i <= 5; i++) g += `<circle cx="${n(h[0] + i * 15 + (r % 2) * 7)}" cy="${n(s[1] + 70 + r * 26)}" r="2.600" fill="${ch.trimC}"/>`;
  g += '</g>';
  if (ch.sash) g += path(`M${n(h[0] - hw - 2)} ${n(h[1] - 12)} Q${n(h[0])} ${n(h[1] - 2)} ${n(h[0] + hw + 2)} ${n(h[1] - 12)} L${n(h[0] + hw + 3)} ${n(h[1] + 8)} Q${n(h[0])} ${n(h[1] + 18)} ${n(h[0] - hw - 3)} ${n(h[1] + 8)}Z`, ch.sash, 'style="stroke-width:4"');
  if (ch.extra) g += ch.extra(P, o);
  return g;
}

// ---------- the twelve ----------
const M = { sw: 46, hw: 32, w: 27, lw: 33, pants: '#2a2644', shoes: '#1c1730' };
const W = { sw: 33, hw: 30, w: 15, lw: 14, stock: '#e9b690', shoes: '#b2332a', heel: true, kind: 'dress' };
const FAIR = { skin: '#f6cfa8', shade: '#dfa27e' }, ROSY = { skin: '#f3bd98', shade: '#d58f72' }, BROWN = { skin: '#b97a50', shade: '#935a3c' }, DEEP = { skin: '#85533a', shade: '#653a2c' }, OLIVE = { skin: '#e3b283', shade: '#c18a5f' };

export const CAST = {
  dolly: { ...W, ...FAIR, dress: '#3f9a83', dressD: '#2b7568', trim: 'chevron', trimC: '#f2d28a', sash: '#f2b23e', shoes: '#8a4a2c', head: { hair: 'bobBlond', hairC: '#eaa83a', rouge: '#e8836b', lips: '#c8322b', lid: '#8fc3b4', hat: null, browC: '#8a5a1c' } },
  julian: { ...M, ...BROWN, coat: '#2c4a7c', coatD: '#1f3560', lapelC: '#24406f', tie: 'tie', tieC: '#f2b23e', pants: '#f0dfbd', shoes: '#8a4a2c', head: { hair: 'slick', hairC: '#241a30', brow: 5.5 } },
  iris: { ...W, ...FAIR, skin: '#f4d7b8', shade: '#dcb08c', dress: '#d6452c', dressD: '#a92f27', trim: 'fringe', trimC: '#f2b23e', sash: '#1c1730', shoes: '#1c1730', head: { hair: 'bobBlack', hairC: '#1f1a33', rouge: '#e8836b', lips: '#b3242a', lid: '#6f67a8' } },
  hugo: { ...M, ...ROSY, sw: 48, coat: '#f3e3c3', coatD: '#dcc59a', stripe: '#c9553f', lapelC: '#f3e3c3', tie: 'tie', tieC: '#2f7f6d', pants: '#f0dfbd', shoes: '#8a4a2c', head: { hair: 'wavy', hairC: '#c9682a', browC: '#8f4318', brow: 5, face: () => path('M4 18 Q9 12 13 16 Q18 11 25 17 Q18 20 13 18.500 Q8 21 4 18Z', '#c9682a', 'style="stroke-width:2.500"') } },
  augustus: { ...M, ...ROSY, sw: 56, hw: 48, ww: 62, w: 30, coat: '#4b4468', coatD: '#352f50', lapelC: '#352f50', waist: '#e9b23e', tie: 'tie', tieC: '#8a2f3c', pants: '#6c6585', head: { hair: 'forelockOld', hairC: '#6f6a7c', browC: '#6f6a7c', brow: 7, face: () => path('M-6 26 C-4 14 8 14 13 18 C18 13 30 14 32 25 C26 24 22 30 13 25 C6 31 0 24 -6 26Z', '#8d8798', 'style="stroke-width:3.500"') + `<circle cx="22" cy="-6" r="13" fill="#fff6e2" fill-opacity=".25" stroke="#e9b23e" stroke-width="3.500"/>` + line('M34 0 Q40 30 30 60', 2, '#e9b23e') } },
  honoria: { ...W, ...FAIR, skin: '#f3d3b5', shade: '#d7a98a', sw: 36, hw: 32, w: 17, dress: '#2f8f78', dressD: '#1f6b5e', trim: 'beads', trimC: '#bfe3c9', hemY: -8, flare: 1.35, shoes: '#f2b23e', head: { hair: 'marcel', hairC: '#b9b4c4', rouge: '#dc8a76', lips: '#a32836', lid: '#7c9fb0', hat: 'plume', browC: '#6f6a7c', ear: () => line('M-30 14 L-30 26', 2.5) + gem(-30, 31, 6, '#2fae8c') } },
  krause: { ...M, ...FAIR, skin: '#ecd2ae', shade: '#cfa981', sw: 40, hw: 28, w: 23, coat: '#7a2438', coatD: '#5a1830', lapelC: '#48122a', tie: 'bow', tieC: '#f2b23e', hem: 70, pants: '#3a3350', head: { hair: 'centre', hairC: '#241a30', brow: 4, face: () => path('M6 33 Q13 30 18 33 L12 54Z', '#241a30', 'style="stroke-width:2.500"') + line('M2 17 Q8 13 13 17 Q18 13 24 16', 3.2) + `<circle cx="3" cy="-6" r="11" fill="none" stroke="#b98c2b" stroke-width="3"/><circle cx="23" cy="-6" r="9" fill="none" stroke="#b98c2b" stroke-width="3"/>` } },
  odette: { ...W, ...OLIVE, sw: 42, hw: 44, w: 24, dress: '#fff6e2', dressD: '#e0cfae', hemY: -70, flare: 1.2, lw: 18, stock: '#4b4468', heel: false, shoes: '#1c1730', head: { hair: 'bun', hairC: '#7b4a2c', rouge: '#d97a5f', hat: 'toque' }, extra: (P) => path(`M${n(P.s[0] - 18)} ${n(P.s[1] - 18)} l18 22 l18 -22 l6 14 l-18 24 l-6 -6 l-6 6 l-18 -24Z`, '#d6452c', 'style="stroke-width:4"') + path(`M${n(P.h[0] - 34)} ${n(P.h[1] - 12)} Q${n(P.h[0])} ${n(P.h[1] - 2)} ${n(P.h[0] + 34)} ${n(P.h[1] - 12)} L${n(P.h[0] + 40)} ${n(P.h[1] + 90)} Q${n(P.h[0])} ${n(P.h[1] + 102)} ${n(P.h[0] - 40)} ${n(P.h[1] + 90)}Z`, '#8fb8c9', 'style="stroke-width:4"') },
  emil: { ...M, ...OLIVE, skin: '#efc195', shade: '#cf956b', sw: 43, hw: 28, w: 24, coat: '#fff6e2', coatD: '#dccdb0', lapelC: '#e9dab8', tie: 'bow', tieC: '#1c1730', hem: 6, head: { hair: 'forelock', hairC: '#3b2a2a', brow: 5 } },
  winifred: { ...W, ...BROWN, sw: 40, hw: 40, w: 20, dress: '#7b4a8c', dressD: '#5a3370', trim: 'scallop', trimC: '#f2b23e', hemY: -60, flare: 1.35, shoes: '#1c1730', head: { hair: 'marcel', hairC: '#cfcad6', rouge: '#a8503f', lips: '#8f2436', lid: '#e0a34a', hat: 'turban', browC: '#5a4a50' }, extra: (P) => pearlless(P) },
  pym: { ...M, ...FAIR, sw: 46, hw: 42, ww: 54, w: 25, coat: '#c98f34', coatD: '#a06c22', plaid: '#8a4a1c', lapelC: '#b27c2a', tie: 'bow', tieC: '#2f7f6d', pants: '#8f6a3a', shoes: '#5a3320', head: { hair: 'bald', hairC: '#8a6a4a', browC: '#8a6a4a', face: () => `<circle cx="2" cy="-6" r="13" fill="#fff6e2" fill-opacity=".35" stroke="${INK}" stroke-width="3.500"/><circle cx="24" cy="-6" r="10.500" fill="#fff6e2" fill-opacity=".35" stroke="${INK}" stroke-width="3.500"/>` + path('M3 19 Q8 14 13 17 Q18 13 23 18 Q13 24 3 19Z', '#8a6a4a', 'style="stroke-width:2.500"') } },
  teddy: { ...M, ...DEEP, coat: '#fff6e2', coatD: '#dccdb0', lapelC: '#f2b23e', tie: 'bow', tieC: '#d6452c', head: { hair: 'curls', hairC: '#1f1a2a', brow: 5, face: () => line('M6 18 Q10 16 13 18 Q17 15 21 17.500', 3) } },
};
function pearlless(P) { // fox fur
  const { s } = P;
  return path(`M${n(s[0] - 40)} ${n(s[1] - 6)} Q${n(s[0] - 8)} ${n(s[1] + 26)} ${n(s[0] + 22)} ${n(s[1] - 18)} Q${n(s[0] + 44)} ${n(s[1] - 10)} ${n(s[0] + 38)} ${n(s[1] + 20)} L${n(s[0] + 26)} ${n(s[1] + 96)} l-12 -8 l-12 10 l2 -30 Q${n(s[0] + 4)} ${n(s[1] + 44)} ${n(s[0] - 4)} ${n(s[1] + 40)} Q${n(s[0] - 34)} ${n(s[1] + 34)} ${n(s[0] - 46)} ${n(s[1] + 18)}Z`, '#c9682a') + gem(s[0] + 24, s[1] + 66, 2.5, INK) + line(`M${n(s[0] - 26)} ${n(s[1] + 14)} l8 6 M${n(s[0] + 26)} ${n(s[1] + 14)} l-4 10 M${n(s[0] + 4)} ${n(s[1] + 20)} l6 8`, 2.5);
}

// Evening dress, for the reception: the same people, better clothes.
const EVE = {
  dolly: { dress: '#fff6e2', dressD: '#e3d2b4', trim: 'scallop', trimC: '#d9a441', sash: '#f6d9c0', hemY: -70, flare: 1.8, shoes: '#fff6e2', head: { ...CAST.dolly.head, hat: 'bandeau' }, veil: true },
  julian: { coat: '#322c58', coatD: '#221d42', lapelC: '#221d42', waist: '#fff6e2', tie: 'bow', tieC: '#fff6e2', pants: '#2a2548', shoes: '#14102a', btn: '#fff6e2' },
  hugo: { coat: '#322c58', coatD: '#221d42', stripe: null, lapelC: '#221d42', waist: '#fff6e2', tie: 'bow', tieC: '#fff6e2', pants: '#2a2548', shoes: '#14102a', btn: '#fff6e2', extra: (P) => path(`M${n(P.s[0] - 34)} ${n(P.s[1] + 34)} l10 0 l0 14 l-5 8 l-5 -8Z`, '#d6452c', 'style="stroke-width:2.500"') },
  augustus: { coat: '#322c58', coatD: '#221d42', lapelC: '#221d42', waist: '#fff6e2', tie: 'bow', tieC: '#fff6e2', pants: '#2a2548', btn: '#fff6e2' },
  iris: { head: { ...CAST.iris.head, hat: 'aigrette' } },
  pym: { coat: '#3a3350', coatD: '#2a2440', plaid: null, lapelC: '#4d4568', waist: '#c98f34', pants: '#2a2440' },
};
const MORN = {
  dolly: { dress: '#f0a58c', dressD: '#d9806c', trim: 'scallop', trimC: '#fff6e2', sash: '#fff6e2', shoes: '#fff6e2' },
  julian: { coat: '#f3e3c3', coatD: '#dcc59a', lapelC: '#e6d2a6', tie: 'tie', tieC: '#2c4a7c' },
  honoria: { dress: '#8a7fb5', dressD: '#675c94', trim: 'scallop', trimC: '#e3dcf3', head: { ...CAST.honoria.head, hat: null } },
  hugo: { coat: '#7d8f5a', coatD: '#5f7040', stripe: null, lapelC: '#6c7d4c', tie: 'tie', tieC: '#d6452c' },
  augustus: { coat: '#8f6a4a', coatD: '#6e4e36', lapelC: '#6e4e36', waist: '#f3e3c3', pants: '#8f6a4a' },
  winifred: { dress: '#c9553f', dressD: '#a43c30' },
};
export function look(who, when) {
  const b = CAST[who], v = when === 'eve' ? EVE[who] : when === 'morn' ? MORN[who] : null;
  return v ? { ...b, ...v } : b;
}

// pose: { s, h, hd, tilt, f, la, ra, ll, rl, lh, rh, back: [...], eyes, mouth, hat, noLegs }
export function figure(who, pose, when) {
  const ch = look(who, when);
  const P = { s: [0, -318], h: [0, -190], ...pose };
  const f = pose.f ?? 1, woman = ch.kind === 'dress';
  const armC = pose.sleeve || (woman ? (ch.sleeve || ch.skin) : (pose.coat || ch.coat));
  const sleeveless = woman && who !== 'odette' && who !== 'winifred';
  const lw = ch.lw;
  let g = '';
  const arm = (side) => {
    const a = pose[side + 'a']; if (!a) return '';
    const sx = P.s[0] + (side === 'l' ? -1 : 1) * (ch.sw - (woman ? 4 : 8)), sy = P.s[1] + (woman ? 2 : 4);
    const col = who === 'odette' ? ch.dress : who === 'winifred' ? ch.dress : armC;
    let r = limb([[sx, sy], a[0], a[1]], ch.w, col);
    const wrist = mix(a[0], a[1], 0.92);
    if (!sleeveless) { const ang = Math.atan2(a[1][1] - a[0][1], a[1][0] - a[0][0]) * 180 / Math.PI; r += `<g transform="translate(${pt(wrist)}) rotate(${n(ang)})">${path(`M-6 ${-ch.w * 0.46} h9 v${ch.w * 0.92} h-9Z`, ch.shirt || '#fff6e2', 'style="stroke-width:3.500"')}</g>`; }
    const ang2 = Math.atan2(a[1][1] - a[0][1], a[1][0] - a[0][0]);
    const at = [a[1][0] + Math.cos(ang2) * 10, a[1][1] + Math.sin(ang2) * 10];
    return r + hand(a[0], at, ch.skin, pose[side + 'h']) + (pose[side + 'Hold'] ? `<g transform="translate(${pt(at)})">${pose[side + 'Hold']}</g>` : '');
  };
  const back = pose.back || [];
  if (ch.veil && pose.veil !== false) g += path(`M${n((pose.hd || [0])[0] - f * 8)} ${n(pose.hd ? pose.hd[1] - 30 : -415)} C${n(P.s[0] - f * 90)} ${n(P.s[1] + 10)} ${n(P.s[0] - f * 70)} ${n(P.h[1])} ${n(P.h[0] - f * (120 + (pose.sway || 0)))} -26 L${n(P.h[0] + f * 30)} -40 L${n(P.s[0] + f * 20)} ${n(P.s[1])}Z`, '#fff6e2', 'fill-opacity=".78"');
  if (back.includes('la')) g += arm('l');
  if (back.includes('ra')) g += arm('r');
  if (!pose.noLegs) {
    const leg = (side) => {
      const l = pose[side + 'l'] || [[(side === 'l' ? -1 : 1) * 16 + P.h[0] * 0.5, -96], [(side === 'l' ? -1 : 1) * 20, -12]];
      const hip = [P.h[0] + (side === 'l' ? -1 : 1) * ch.hw * 0.5, P.h[1] + 4];
      const dir = pose[side + 'f'] ?? f;
      const end = woman ? l[1] : mix(l[0], l[1], 0.86), sh = shoe(l[0], l[1], ch.shoes, dir, ch.heel);
      const lb = limb([hip, l[0], end], lw, woman ? ch.stock : (pose.pants || ch.pants), woman ? lw * 0.8 : lw * 0.82);
      return woman ? lb + sh : sh + lb;
    };
    g += (pose.legOrder === 'rl') ? leg('r') + leg('l') : leg('l') + leg('r');
  }
  const hd = pose.hd || [P.s[0] + f * 4, P.s[1] - 68];
  const neckW = woman ? 17 : 24;
  g += line(`M${pt([P.s[0], P.s[1] - 6])} L${pt([hd[0] - f * 4, hd[1] + 22])}`, neckW + S * 2) + line(`M${pt([P.s[0], P.s[1] - 2])} L${pt([hd[0] - f * 4, hd[1] + 22])}`, neckW, ch.shade);
  g += woman ? dress(P, ch, pose) : jacket(P, ch, pose);
  if (pose.chest) g += pose.chest;
  if (pose.armsOverHead) { g += head(ch, { ...pose, at: hd, f, tilt: pose.tilt }); }
  if (!back.includes('la')) g += arm('l');
  if (!back.includes('ra')) g += arm('r');
  if (!pose.armsOverHead) g += head(ch, { ...pose, at: hd, f, tilt: pose.tilt });
  if (pose.top) g += pose.top;
  return g;
}

// Head-and-shoulders for the report.
export function bust(who, when) {
  const ch = look(who, when);
  const hat = { hugo: undefined, odette: 'toque', winifred: 'turban', honoria: 'plume' }[who];
  return figure(who, { la: [[-ch.sw - 12, -240], [-ch.sw - 4, -160]], ra: [[ch.sw + 12, -240], [ch.sw + 4, -160]], noLegs: true, hat: hat ?? null, veil: false,
    mouth: { krause: 'smile', hugo: 'smile', teddy: 'smile', dolly: 'smile', augustus: 'flat' }[who] || 'flat', eyes: { iris: 'lid', honoria: 'lid', krause: 'lid' }[who] }, when);
}
