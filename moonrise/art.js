// Cut-paper silhouettes and the manor plan, all as SVG strings.
import { ROOMS } from './rules.js';

const NS = 'http://www.w3.org/2000/svg';

// ------------------------------------------------------------------ profiles (facing right, 100×120 box)
function face(o = {}) {
  const n = o.nose ?? 0, nTx = 80 + n * 4, nTy = 57 + n * 2.2;
  const lipY = 63 + (o.lips ?? 0), cX = 74 + (o.chin ?? 0), cY = 71 + (o.jaw ?? 0);
  const br = o.brow ?? 0;
  return `M 12 120 C 12 104 23 96 35 92 C 35 86 32 80 30 72 C 26 66 25 56 26 48 C 27 32 39 21 54 21
    C 64 21 71 28 ${72 + br} 37 C ${72.6 + br} 41 ${72 + br} 43 ${73.2 + br} 45 C ${73.8 + br} 46.5 72.6 47.6 73 49
    L ${nTx} ${nTy} C ${nTx - .4} ${nTy + 2} ${nTx - 3.5} ${nTy + 2.6} 75.4 ${lipY - 1}
    C 76 ${lipY} 77.4 ${lipY + .6} 76.4 ${lipY + 2} C 75.4 ${lipY + 2.8} 75.4 ${lipY + 3.4} 76.4 ${lipY + 4.6}
    C 76.4 ${cY - 2.5} ${cX} ${cY - 1.5} ${cX} ${cY} C ${cX} ${cY + 3.4} 71 ${cY + 5} 66 ${cY + 5}
    C 62 ${cY + 6} 61 ${cY + 10} 62 96 C 76 100 88 108 92 120 Z`;
}

// Each person: a face, extra black shapes, cream details. eye = where the eye sits.
const LOOKS = {
  you: {
    face: { nose: .3, chin: 1, brow: .5 },
    // the wolf's shadow on the wall behind you
    back: `M -4 124 C -2 100 2 84 4 70 C 4 56 6 44 10 34 L 6 6 L 26 26 C 30 24 34 23 38 23 L 50 -2 L 54 28 C 60 32 64 36 68 40 L 76 44 C 79 46 79 51 76 53 L 70 56 C 64 70 58 84 52 96 L 50 124 Z`,
    black: `M 26 48 C 22 30 34 17 52 17 C 64 17 72 23 73 32 C 66 26 52 25 44 30 C 36 34 32 42 30 52 Z
      M 30 50 C 32 60 36 66 42 70 L 46 58 C 40 54 36 50 30 50 Z
      M 55 88 L 78 90 L 74 98 L 60 98 Z`,
    cream: `M 61 90 L 70 98 L 66 104 L 62 98 Z`,
    eye: [66.5, 47],
  },
  colonel: {
    face: { nose: .6, chin: -1, jaw: 1, brow: .4 },
    black: `M 70 59.5 C 76 58.5 81 60 83.5 66.5 C 81 65.5 79 66 77.5 67.5 C 75.5 65.8 72 65.2 68 65.5 Z
      M 28 46 C 30 58 40 70 50 76 L 52 62 C 44 58 38 52 34 44 Z
      M 30 82 L 66 80 L 68 94 L 34 96 Z
      M 8 108 C 14 100 28 98 40 100 C 34 106 24 110 8 112 Z`,
    cream: `M 34 94 L 66 92 L 66 95 L 34 97 Z M 12 108 l 3 7 M 18 106 l 3 8 M 24 105 l 2 8 M 30 104 l 2 8`,
    creamStroke: true,
    eye: [66.5, 47.5],
  },
  reverend: {
    face: { nose: .1, chin: -1.5, jaw: 3, lips: 1 },
    black: `M 60 76 C 66 80 72 78 74 74 C 72 82 66 86 60 84 Z`,
    cream: `M 46 88 C 52 90 58 90 64 90 L 64 95 C 58 95 52 95 46 93 Z`,
    eye: [66, 47],
  },
  ada: {
    face: { nose: -.5, chin: -1, lips: .4 },
    black: `M 24 40 C 22 26 34 15 50 15 C 64 15 72 22 72 32 C 64 28 50 28 40 34 Z
      M 16 32 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0
      M 24 50 a 5.5 6 0 1 0 11 0 a 5.5 6 0 1 0 -11 0 M 22 60 a 5 6 0 1 0 10 0 a 5 6 0 1 0 -10 0 M 22 70 a 4.5 5.5 0 1 0 9 0 a 4.5 5.5 0 1 0 -9 0`,
    cream: `M 30 22 l 8 -6 l 0 10 z M 38 16 l 8 6 l -8 4 z`,
    eye: [66, 47.5],
  },
  ida: {
    face: { nose: -.5, chin: -1, lips: .4 },
    black: `M 24 40 C 22 26 34 15 50 15 C 64 15 72 22 72 32 C 64 28 50 28 40 34 Z
      M 16 32 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0
      M 24 50 a 5.5 6 0 1 0 11 0 a 5.5 6 0 1 0 -11 0 M 22 60 a 5 6 0 1 0 10 0 a 5 6 0 1 0 -10 0 M 22 70 a 4.5 5.5 0 1 0 9 0 a 4.5 5.5 0 1 0 -9 0`,
    cream: `M 34 20 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0`,
    eye: [66, 47.5],
    flip: true,
  },
  cook: {
    face: { nose: -.2, chin: -2, jaw: 3, lips: .6 },
    black: `M 18 40 C 10 30 18 14 32 14 C 36 6 52 4 58 12 C 70 10 78 20 74 32 C 62 30 40 34 26 42 Z
      M 58 76 C 66 82 74 80 75 75 C 74 84 66 88 58 86 Z`,
    cream: `M 22 40 C 36 34 60 30 74 32 L 74 35 C 60 33 38 37 23 43 Z`,
    eye: [65.5, 47.5],
  },
  doctor: {
    face: { nose: .8, chin: 1.5, brow: .2 },
    black: `M 74 72 C 78 76 76 84 70 86 C 68 82 68 76 70 72 Z
      M 54 88 L 76 90 L 72 100 L 58 100 Z
      M 26 46 C 26 30 38 20 52 20 C 62 20 68 24 70 30 C 60 28 46 30 36 40 Z`,
    cream: `M 59 90 L 70 99 L 66 104 L 62 99 Z`,
    glass: [67, 47.5],
    eye: [66.5, 47.5],
  },
  widow: {
    face: { nose: .9, chin: .5, lips: -.4 },
    black: `M 22 50 C 16 30 30 12 50 12 C 64 12 74 20 74 30 C 64 26 46 28 36 38 C 30 44 30 52 32 60
      C 30 76 24 96 6 120 L 2 120 C 14 96 18 70 22 50 Z
      M 58 74 C 62 82 70 86 72 92 L 62 98 C 58 92 56 84 58 74 Z`,
    cream: `M 58 86 l 4 2 M 60 92 l 4 1 M 62 82 l 4 2`,
    creamStroke: true,
    eye: [66.5, 47.5],
  },
  poet: {
    face: { nose: .2, chin: -.5, lips: .3, brow: -.4 },
    black: `M 22 54 C 12 46 16 34 24 30 C 22 20 32 12 42 16 C 46 8 60 8 64 16 C 72 14 78 22 74 30 C 70 28 66 30 64 34
      C 56 28 42 32 38 42 C 36 48 36 52 34 58 C 30 60 26 58 22 54 Z
      M 60 90 C 70 86 80 88 84 96 C 76 98 70 96 66 98 C 70 104 70 112 64 116 C 62 108 60 100 60 90 Z`,
    cream: ``,
    eye: [66, 47.5],
  },
};

// mood 0 calm, 1 wary, 2 suspicious, 3 glaring
function eyeSVG(x, y, mood, glow) {
  const col = mood >= 3 ? '#e0402a' : glow ? '#f2b24a' : 'var(--paper, #efe2c6)';
  const fl = mood >= 3 ? ' filter="url(#eyeGlow)"' : '';
  if (mood === 0) return `<ellipse cx="${x}" cy="${y}" rx="2.1" ry="2" fill="${col}"${fl}/><path d="M ${x - 3} ${y - 4.2} Q ${x} ${y - 5.6} ${x + 3.4} ${y - 4.4}" stroke="${col}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
  if (mood === 1) return `<path d="M ${x - 2.6} ${y} Q ${x} ${y - 1.8} ${x + 2.8} ${y} Q ${x} ${y + 1.4} ${x - 2.6} ${y} Z" fill="${col}"${fl}/><path d="M ${x - 3} ${y - 3.6} L ${x + 3.4} ${y - 3.4}" stroke="${col}" stroke-width=".9" stroke-linecap="round"/>`;
  return `<path d="M ${x - 2.8} ${y + .2} Q ${x} ${y - 1} ${x + 3} ${y - .2} Q ${x} ${y + .9} ${x - 2.8} ${y + .2} Z" fill="${col}"${fl}/><path d="M ${x - 3.4} ${y - 4.4} L ${x + 3.4} ${y - 1.8}" stroke="${col}" stroke-width="${mood >= 3 ? 1.4 : 1}" stroke-linecap="round"/>`;
}

export function silhouette(id, mood = 0, opts = {}) {
  const L = LOOKS[id];
  const flip = L.flip ? ' transform="translate(100 0) scale(-1 1)"' : '';
  const ink = opts.ink || '#15100e';
  let s = `<g${flip}>`;
  if (L.back) s += `<path d="${L.back}" fill="${opts.wolf || '#5a1515'}" opacity="${opts.wolfOpacity ?? .8}" transform="translate(-6 -16)"/>`;
  s += `<path d="${face(L.face)}" fill="${ink}"/>`;
  if (L.black) s += `<path d="${L.black}" fill="${ink}"/>`;
  if (L.cream) s += L.creamStroke
    ? `<path d="${L.cream}" fill="var(--paper, #efe2c6)" stroke="var(--paper, #efe2c6)" stroke-width="1.1" stroke-linecap="round"/>`
    : `<path d="${L.cream}" fill="var(--paper, #efe2c6)"/>`;
  if (!opts.noEye) {
    const [x, y] = L.eye;
    s += `<g class="eye">${eyeSVG(x, y, mood, opts.glow)}</g>`;
    if (L.glass) s += `<circle cx="${L.glass[0] + .5}" cy="${L.glass[1]}" r="4.6" fill="none" stroke="var(--paper, #efe2c6)" stroke-width=".8"/><path d="M ${L.glass[0] - 4} ${L.glass[1] - .6} L 58 46" stroke="var(--paper, #efe2c6)" stroke-width=".7"/>`;
  }
  return s + '</g>';
}
export function eyeOnly(id, mood, glow) {
  const L = LOOKS[id], [x, y] = L.eye;
  return eyeSVG(x, y, mood, glow);
}
export const isFlipped = id => !!LOOKS[id].flip;

export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="eyeGlow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="paperGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .18  0 0 0 0 .1  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <radialGradient id="gilt" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#f3d58a"/><stop offset=".45" stop-color="#b98a3a"/><stop offset="1" stop-color="#5d4116"/></radialGradient>
  <radialGradient id="moonlit" cx="50%" cy="20%" r="90%"><stop offset="0" stop-color="#2d3c58"/><stop offset="1" stop-color="#121a2b"/></radialGradient>
  <pattern id="boards" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0 H12 M0 6 H12" stroke="rgba(0,0,0,.18)" stroke-width=".6"/></pattern>
  <pattern id="parchFloor" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8 L8 0" stroke="rgba(90,60,30,.12)" stroke-width=".7"/></pattern>
</defs></svg>`;

// A portrait in its oval frame. tint: 0..1 (how much the table suspects them)
export function portraitSVG(id, mood = 0, opts = {}) {
  return `<svg viewBox="0 0 100 124" class="pt" aria-hidden="true">
    <ellipse cx="50" cy="60" rx="45" ry="56" fill="url(#gilt)"/>
    <ellipse cx="50" cy="60" rx="41" ry="52" fill="#2a1a0e"/>
    <ellipse class="ground" cx="50" cy="60" rx="39" ry="50" fill="var(--paper, #efe2c6)"/>
    <ellipse class="blush" cx="50" cy="60" rx="39" ry="50" fill="#8e1b1b" opacity="0"/>
    <clipPath id="clip-${id}"><ellipse cx="50" cy="60" rx="39" ry="50"/></clipPath>
    <g clip-path="url(#clip-${id})"><g transform="translate(9 14) scale(.84)">${silhouette(id, mood, opts)}</g></g>
    <ellipse cx="50" cy="60" rx="39" ry="50" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>
  </svg>`;
}

// ------------------------------------------------------------------ the manor plan
export const CELL = 100, PAD = 8, SIZE = CELL * 3 + PAD * 2;
export const roomXY = i => [PAD + (i % 3) * CELL, PAD + (i / 3 | 0) * CELL];

const FURN = {
  library: `<rect x="8" y="26" width="6" height="66"/><rect x="86" y="26" width="6" height="66"/><rect x="26" y="88" width="48" height="5"/><circle cx="50" cy="58" r="8" opacity=".6"/>`,
  gallery: `<rect x="16" y="24" width="14" height="10"/><rect x="44" y="22" width="12" height="13"/><rect x="70" y="24" width="14" height="10"/><rect x="40" y="66" width="20" height="8" rx="3" opacity=".6"/>`,
  chapel: `<rect x="47" y="24" width="6" height="22"/><rect x="40" y="30" width="20" height="5"/><rect x="18" y="58" width="24" height="4"/><rect x="58" y="58" width="24" height="4"/><rect x="18" y="72" width="24" height="4"/><rect x="58" y="72" width="24" height="4"/><rect x="18" y="86" width="24" height="4"/><rect x="58" y="86" width="24" height="4"/>`,
  study: `<rect x="22" y="44" width="40" height="18" rx="2"/><circle cx="72" cy="54" r="6"/><rect x="10" y="80" width="30" height="8" opacity=".6"/>`,
  hall: `<rect x="20" y="46" width="60" height="10" rx="3"/><circle cx="26" cy="68" r="3.5"/><circle cx="40" cy="68" r="3.5"/><circle cx="54" cy="68" r="3.5"/><circle cx="68" cy="68" r="3.5"/><path d="M 74 84 h 16 v -6 h -6 v -6 h -6 v -6 h -4 z" opacity=".6"/>`,
  conserv: `<circle cx="22" cy="34" r="9"/><circle cx="78" cy="30" r="7"/><circle cx="20" cy="82" r="8"/><circle cx="80" cy="84" r="10"/><circle cx="50" cy="56" r="5" opacity=".6"/>`,
  kitchen: `<rect x="10" y="24" width="30" height="16"/><rect x="60" y="26" width="30" height="10" opacity=".6"/><rect x="34" y="60" width="32" height="14" rx="2"/>`,
  cellar: `<circle cx="20" cy="30" r="8"/><circle cx="38" cy="30" r="8"/><circle cx="20" cy="86" r="8"/><circle cx="80" cy="86" r="8"/><circle cx="80" cy="30" r="8"/><rect x="58" y="22" width="6" height="16" opacity=".6"/>`,
  billiard: `<rect x="24" y="40" width="52" height="30" rx="3"/><circle cx="26" cy="42" r="2.5" fill="#000"/><circle cx="74" cy="42" r="2.5" fill="#000"/><circle cx="26" cy="68" r="2.5" fill="#000"/><circle cx="74" cy="68" r="2.5" fill="#000"/><rect x="10" y="84" width="40" height="3" transform="rotate(-8 30 85)"/>`,
};

// Wall segments with a door gap between neighbouring rooms.
function walls() {
  const T = PAD, E = PAD + 3 * CELL, D = 26;
  let s = `<rect x="${T}" y="${T}" width="${3 * CELL}" height="${3 * CELL}" fill="none" class="wall outer"/>`;
  for (let k = 1; k < 3; k++) {
    const x = PAD + k * CELL;
    for (let r = 0; r < 3; r++) {
      const y0 = PAD + r * CELL, mid = y0 + CELL / 2;
      s += `<path class="wall" d="M ${x} ${y0} V ${mid - D / 2} M ${x} ${mid + D / 2} V ${y0 + CELL}"/>`;
    }
    const y = PAD + k * CELL;
    for (let c = 0; c < 3; c++) {
      const x0 = PAD + c * CELL, mid = x0 + CELL / 2;
      s += `<path class="wall" d="M ${x0} ${y} H ${mid - D / 2} M ${mid + D / 2} ${y} H ${x0 + CELL}"/>`;
    }
  }
  return s;
}

export function planSVG() {
  let s = `<svg viewBox="0 0 ${SIZE} ${SIZE}" class="plan" role="img" aria-label="Plan of the manor">`;
  for (let i = 0; i < 9; i++) {
    const [x, y] = roomXY(i), r = ROOMS[i];
    s += `<g class="room" data-room="${i}" transform="translate(${x} ${y})">
      <rect class="floor" width="${CELL}" height="${CELL}"/>
      <rect class="tex" width="${CELL}" height="${CELL}"/>
      <g class="furn">${FURN[r.id]}</g>
      <rect class="hi" x="3" y="3" width="${CELL - 6}" height="${CELL - 6}" rx="2"/>
      <text class="rname" x="${CELL / 2}" y="14" text-anchor="middle">${r.name}</text>
      <text class="rkey" x="${CELL - 7}" y="${CELL - 6}" text-anchor="end">${i + 1}</text>
      <g class="marks"></g>
    </g>`;
  }
  s += `<g class="walls">${walls()}</g><g class="doorfx"></g><g class="tokens"></g></svg>`;
  return s;
}
// token slots inside a room, for up to 4 people
export function slot(i, k, count) {
  const [x, y] = roomXY(i);
  const layouts = {
    1: [[50, 58]], 2: [[32, 58], [68, 58]], 3: [[30, 50], [70, 50], [50, 78]], 4: [[30, 46], [70, 46], [30, 78], [70, 78]],
    5: [[26, 44], [50, 44], [74, 44], [38, 76], [62, 76]], 6: [[26, 44], [50, 44], [74, 44], [26, 76], [50, 76], [74, 76]],
  };
  const L = layouts[Math.min(6, Math.max(1, count))];
  const [a, b] = L[k % L.length];
  return [x + a, y + b];
}
export function tokenSVG(id, x, y, cls = '') {
  return `<g class="tok ${cls}" data-id="${id}" transform="translate(${x} ${y})">
    <circle r="15" class="tokring"/>
    <circle r="12.5" class="tokbg"/>
    <g transform="translate(-10.5 -13.5) scale(.21)">${silhouette(id, 0, { noEye: true, wolfOpacity: 0 })}</g>
    <circle r="15" class="tokhit" fill="transparent"/>
  </g>`;
}
