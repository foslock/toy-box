// Reef: the cyanotype look. Everything is a white photogram on Prussian blue:
// pieces and creatures are silhouettes with soft, light-bled edges, the sea
// floor is the coated sheet, and the only other tone is a tea-stained rust used
// for warm water and losses.

export const C = {
  coat: '#1a4479', deep: '#0f2a4f', light: '#2a5a93', white: '#eef4f3', paper: '#efe8d8', ink: '#163b6b', rust: '#c2703f',
};

export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

// ---- the coated sheet: mottled blue, darker where the brush went twice, and a ragged brushed edge onto bare paper
export function drawSheet(w, h, dpr, seed = 3) {
  const c = canvas(w * dpr, h * dpr), x = c.getContext('2d'), rng = rngOf(seed);
  x.scale(dpr, dpr);
  x.fillStyle = C.paper; x.fillRect(0, 0, w, h);
  const m = Math.min(14, Math.max(7, Math.min(w, h) * 0.018));
  // the coat itself, laid in long horizontal strokes
  x.save();
  x.beginPath();
  // ragged edge: walk the rectangle with jitter
  const edge = [];
  const step = 9;
  for (let px = m; px <= w - m; px += step) edge.push([px, m + (rng() - 0.6) * m * 0.9]);
  for (let py = m; py <= h - m; py += step) edge.push([w - m + (rng() - 0.4) * m * 0.9, py]);
  for (let px = w - m; px >= m; px -= step) edge.push([px, h - m + (rng() - 0.4) * m * 0.9]);
  for (let py = h - m; py >= m; py -= step) edge.push([m + (rng() - 0.6) * m * 0.9, py]);
  edge.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b));
  x.closePath();
  x.fillStyle = C.coat; x.fill();
  x.clip();
  // brush streaks
  for (let i = 0; i < 70; i++) {
    const y = rng() * h, th = 10 + rng() * 60;
    x.fillStyle = rng() < 0.55 ? `rgba(11,32,64,${0.05 + rng() * 0.12})` : `rgba(60,110,170,${0.04 + rng() * 0.08})`;
    x.beginPath();
    x.ellipse(rng() * w, y, w * (0.3 + rng() * 0.5), th, (rng() - 0.5) * 0.06, 0, Math.PI * 2);
    x.fill();
  }
  // grain
  const n = (w * h) / 90;
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? 'rgba(5,20,45,.18)' : 'rgba(150,190,230,.10)';
    x.fillRect(rng() * w, rng() * h, 1 + rng() * 1.4, 1 + rng() * 1.4);
  }
  // a vignette where the coat was thinner at the edges
  const vg = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(70,120,175,.22)');
  x.fillStyle = vg; x.fillRect(0, 0, w, h);
  x.restore();
  // stray brush hairs over the edge
  x.strokeStyle = C.coat; x.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const side = (rng() * 4) | 0, t = rng();
    const px = side < 2 ? t * w : side === 2 ? m * 0.6 : w - m * 0.6, py = side < 2 ? (side ? h - m * 0.6 : m * 0.6) : t * h;
    x.globalAlpha = 0.4 + rng() * 0.5; x.lineWidth = 0.8 + rng() * 1.6;
    x.beginPath(); x.moveTo(px, py);
    const horiz = side < 2;
    x.lineTo(px + (horiz ? (rng() - 0.5) * 50 : (side === 2 ? -1 : 1) * rng() * m), py + (horiz ? (side ? 1 : -1) * rng() * m : (rng() - 0.5) * 50));
    x.stroke();
  }
  x.globalAlpha = 1;
  return c;
}

// ---- hex helpers (board space: pointy-top, unit size)
export const SQ3 = Math.sqrt(3);
export const hexXY = (q, r) => [SQ3 * (q + r / 2), 1.5 * r];
export function hexPath(x, cx, cy, s) {
  x.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const px = cx + s * Math.cos(a), py = cy + s * Math.sin(a);
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
}

// ---- piece sprites. Each is drawn white into a square canvas of side 2.4·S (S = hex size in device px),
// with the photogram's soft halo, in board orientation (current flowing toward +x).
const SPR = 2.4;
function sprite(S, draw, seed, glow = 0.09) {
  const side = SPR * S, c = canvas(side, side), x = c.getContext('2d'), rng = rngOf(seed);
  x.translate(side / 2, side / 2);
  x.fillStyle = x.strokeStyle = C.white;
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.shadowColor = 'rgba(225,240,255,.75)'; x.shadowBlur = glow * S;
  draw(x, S, rng);
  return c;
}

function blob(x, S, rng, r0, wob, n = 14) {
  const pts = [];
  const ph = rng() * 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = r0 * S * (1 + wob * (Math.sin(a * 3 + ph) * 0.5 + (rng() - 0.5)));
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  x.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    i ? x.quadraticCurveTo(p[0], p[1], mx, my) : x.moveTo(mx, my);
  }
  const p = pts[0], q = pts[1];
  x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  x.closePath();
}

const DRAW = {
  brain(x, S, rng) {
    blob(x, S, rng, 0.74, 0.12);
    x.fill();
    // meandering grooves: wobbly rings with breaks, knocked back toward the coat
    x.save(); x.clip();
    x.shadowBlur = 0; x.strokeStyle = 'rgba(26,68,121,.55)'; x.lineWidth = 0.065 * S;
    for (const rr of [0.18, 0.34, 0.5, 0.66]) {
      const ph = rng() * 6, gaps = 2 + ((rng() * 3) | 0);
      for (let gI = 0; gI < gaps; gI++) {
        const a0 = ph + (gI / gaps) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / gaps) * (0.6 + rng() * 0.25);
        x.beginPath();
        for (let a = a0; a <= a1; a += 0.08) {
          const r = rr * S * (1 + 0.1 * Math.sin(a * 7 + ph * 3));
          a === a0 ? x.moveTo(Math.cos(a) * r, Math.sin(a) * r) : x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        x.stroke();
      }
    }
    x.restore();
  },
  stag(x, S, rng) {
    const branch = (px, py, a, len, w, d) => {
      const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len;
      x.lineWidth = w;
      x.beginPath(); x.moveTo(px, py);
      x.quadraticCurveTo((px + ex) / 2 + Math.cos(a + 1.57) * len * 0.15 * (rng() - 0.5), (py + ey) / 2 + Math.sin(a + 1.57) * len * 0.15, ex, ey);
      x.stroke();
      if (d > 0) {
        const k = 2;
        for (let i = 0; i < k; i++) branch(ex, ey, a + (i ? 1 : -1) * (0.35 + rng() * 0.35), len * (0.72 + rng() * 0.15), w * 0.72, d - 1);
      } else {
        x.beginPath(); x.arc(ex, ey, w * 0.75, 0, Math.PI * 2); x.fill();
      }
    };
    const n = 5, ph = rng() * 6;
    for (let i = 0; i < n; i++) branch(0, 0, ph + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.4, 0.28 * S, 0.15 * S, 2);
    x.beginPath(); x.arc(0, 0, 0.14 * S, 0, Math.PI * 2); x.fill();
  },
  fan(x, S, rng) {
    // pressed flat like a specimen: a lacy fan opening up-current (−x), stem downstream
    const ox = 0.42 * S, R = 1.02 * S, a0 = Math.PI - 1.0, a1 = Math.PI + 1.0;
    x.save();
    x.beginPath(); x.moveTo(ox, 0);
    for (let a = a0; a <= a1 + 0.001; a += 0.05) {
      const r = R * (0.93 + 0.07 * Math.sin(a * 9 + 1) + (rng() - 0.5) * 0.04);
      x.lineTo(ox + Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
    x.globalAlpha = 0.22; x.fill(); x.globalAlpha = 1;
    x.clip();
    x.lineWidth = 0.038 * S;
    const ribs = 11;
    for (let i = 0; i <= ribs; i++) {
      const a = a0 + (a1 - a0) * (i / ribs);
      x.beginPath(); x.moveTo(ox, 0);
      x.quadraticCurveTo(ox + Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.45, ox + Math.cos(a) * R, Math.sin(a) * R);
      x.stroke();
    }
    x.lineWidth = 0.028 * S;
    for (let k = 1; k <= 6; k++) {
      const rr = R * (k / 6.4);
      x.beginPath();
      for (let a = a0; a <= a1; a += 0.04) {
        const r = rr * (1 + (rng() - 0.5) * 0.05);
        a === a0 ? x.moveTo(ox + Math.cos(a) * r, Math.sin(a) * r) : x.lineTo(ox + Math.cos(a) * r, Math.sin(a) * r);
      }
      x.stroke();
    }
    x.restore();
    x.lineWidth = 0.1 * S;
    x.beginPath(); x.moveTo(ox + 0.2 * S, 0.04 * S); x.lineTo(ox - 0.15 * S, 0); x.stroke();
  },
  sponge(x, S, rng) {
    const tubes = [];
    const n = 3 + ((rng() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng(), d = i ? 0.32 * S : 0.05 * S;
      tubes.push([Math.cos(a) * d, Math.sin(a) * d, (0.24 + rng() * 0.12) * S]);
    }
    for (const [tx, ty, r] of tubes) { x.beginPath(); x.arc(tx, ty, r, 0, Math.PI * 2); x.fill(); }
    x.shadowBlur = 0;
    for (const [tx, ty, r] of tubes) {
      x.fillStyle = 'rgba(15,42,79,.85)';
      x.beginPath(); x.arc(tx, ty, r * 0.48, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(26,68,121,.35)';
      for (let i = 0; i < 6; i++) {
        const a = rng() * 6.28, d = r * (0.62 + rng() * 0.25);
        x.beginPath(); x.arc(tx + Math.cos(a) * d, ty + Math.sin(a) * d, r * 0.07, 0, 6.28); x.fill();
      }
    }
  },
  anemone(x, S, rng) {
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.2, len = (0.5 + rng() * 0.25) * S;
      const bend = (rng() - 0.5) * 0.9;
      x.lineWidth = 0.075 * S;
      x.beginPath(); x.moveTo(Math.cos(a) * 0.15 * S, Math.sin(a) * 0.15 * S);
      const mx = Math.cos(a + bend * 0.5) * len * 0.6, my = Math.sin(a + bend * 0.5) * len * 0.6;
      const ex = Math.cos(a + bend) * len, ey = Math.sin(a + bend) * len;
      x.quadraticCurveTo(mx, my, ex, ey); x.stroke();
      x.beginPath(); x.arc(ex, ey, 0.06 * S, 0, 6.28); x.fill();
    }
    x.beginPath(); x.arc(0, 0, 0.22 * S, 0, 6.28); x.fill();
    x.shadowBlur = 0; x.fillStyle = 'rgba(15,42,79,.7)';
    x.beginPath(); x.ellipse(0, 0, 0.08 * S, 0.05 * S, rng() * 3, 0, 6.28); x.fill();
  },
  grass(x, S, rng) {
    // a tuft: thin blades from one root, fanning out and bending downstream (+x)
    const rx = -0.5 * S, ry = (rng() - 0.5) * 0.2 * S, n = 9;
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n - 0.5) * 1.5 + (rng() - 0.5) * 0.15;
      const len = (0.9 + rng() * 0.5) * S, w = (0.028 + rng() * 0.018) * S;
      const ex = rx + Math.cos(a * 0.8) * len, ey = ry + Math.sin(a * 0.8) * len * 0.9;
      const cx = rx + Math.cos(a) * len * 0.45, cy = ry + Math.sin(a) * len * 0.6;
      x.globalAlpha = 0.6 + rng() * 0.35;
      x.beginPath();
      x.moveTo(rx, ry - w);
      x.quadraticCurveTo(cx, cy - w, ex, ey);
      x.quadraticCurveTo(cx, cy + w, rx, ry + w);
      x.closePath(); x.fill();
    }
    x.globalAlpha = 1;
  },
  rock(x, S, rng) {
    blob(x, S, rng, 0.7, 0.3, 9);
    x.fill();
    x.save(); x.clip();
    x.shadowBlur = 0;
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(26,68,121,${0.1 + rng() * 0.25})`;
      x.beginPath(); x.arc((rng() - 0.5) * 1.6 * S, (rng() - 0.5) * 1.6 * S, (0.02 + rng() * 0.07) * S, 0, 6.28); x.fill();
    }
    x.strokeStyle = 'rgba(26,68,121,.4)'; x.lineWidth = 0.05 * S;
    x.beginPath(); x.moveTo(-0.3 * S, -0.2 * S); x.lineTo(0.05 * S, 0.05 * S); x.lineTo(0.3 * S, 0.0); x.stroke();
    x.restore();
  },
};

export const VARIANTS = 3;
export function makeSprites(S, seed = 11) {
  const out = {};
  for (const k of Object.keys(DRAW)) {
    out[k] = [];
    for (let v = 0; v < VARIANTS; v++) out[k].push(sprite(S, DRAW[k], seed * 97 + v * 13 + k.length * 7));
  }
  // bleached skeletons: the same corals, toned rust and faint
  out.ghost = {};
  for (const k of ['brain', 'stag', 'fan']) {
    out.ghost[k] = out[k].map(c => {
      const g = canvas(c.width, c.height), x = g.getContext('2d');
      x.drawImage(c, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = C.rust; x.fillRect(0, 0, g.width, g.height);
      return g;
    });
  }
  return out;
}
export const SPRITE_SCALE = SPR;

// a small swatch of a piece on its own patch of coat, for the tray and pack cards
export function swatch(kind, px, dpr, seed = 5) {
  const c = canvas(px * dpr, px * dpr), x = c.getContext('2d');
  x.fillStyle = C.coat; x.fillRect(0, 0, c.width, c.height);
  const S = (c.width / SPR) * 1.08;
  const s = sprite(S, DRAW[kind], seed + kind.length);
  x.drawImage(s, (c.width - s.width) / 2, (c.height - s.height) / 2);
  return c;
}

// ---- creatures. Drawn live, as white silhouettes, in board space (unit = one hex).
function fishBody(x, len, h, tail = 0.45) {
  x.beginPath();
  x.moveTo(len * 0.5, 0);
  x.quadraticCurveTo(len * 0.15, -h, -len * 0.3, -h * 0.35);
  x.lineTo(-len * 0.5, -h * tail * 1.4);
  x.lineTo(-len * 0.42, 0);
  x.lineTo(-len * 0.5, h * tail * 1.4);
  x.lineTo(-len * 0.3, h * 0.35);
  x.quadraticCurveTo(len * 0.15, h, len * 0.5, 0);
  x.fill();
}

export const CREATURE = {
  clown(x, t) {
    fishBody(x, 0.42, 0.13);
    x.save(); x.shadowBlur = 0; x.lineWidth = 0.035; x.strokeStyle = C.coat;
    for (const bx of [0.1, -0.12]) { x.beginPath(); x.moveTo(bx, -0.13); x.quadraticCurveTo(bx - 0.03, 0, bx, 0.13); x.stroke(); }
    x.restore();
  },
  parrot(x, t) {
    fishBody(x, 0.62, 0.17, 0.55);
    x.save(); x.shadowBlur = 0; x.fillStyle = C.coat;
    x.beginPath(); x.arc(0.2, -0.04, 0.025, 0, 6.28); x.fill();
    x.lineWidth = 0.015; x.strokeStyle = C.coat;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-0.05 - i * 0.07, 0, 0.07, -1, 1); x.stroke(); }
    x.restore();
  },
  damsel(x) { fishBody(x, 0.2, 0.07); },
  seahorse(x, t) {
    x.lineWidth = 0.07; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0.02, -0.28);
    x.quadraticCurveTo(0.14, -0.1, 0.05, 0.08);
    x.quadraticCurveTo(-0.02, 0.2, 0.06, 0.24);
    x.quadraticCurveTo(0.14, 0.26, 0.1, 0.18);
    x.stroke();
    x.beginPath(); x.ellipse(0.03, -0.3, 0.06, 0.05, 0, 0, 6.28); x.fill();
    x.lineWidth = 0.035; x.beginPath(); x.moveTo(0.06, -0.31); x.lineTo(0.17, -0.27); x.stroke();
    x.lineWidth = 0.025; x.beginPath(); x.moveTo(-0.02, -0.1); x.lineTo(-0.08, -0.06 + Math.sin(t * 9) * 0.02); x.stroke();
  },
  nudi(x, t) {
    x.beginPath(); x.ellipse(0, 0, 0.2, 0.07, 0, 0, 6.28); x.fill();
    for (let i = 0; i < 7; i++) {
      const px = -0.16 + i * 0.05;
      x.beginPath(); x.arc(px, -0.07 - Math.sin(t * 3 + i) * 0.01, 0.025, 0, 6.28); x.fill();
      x.beginPath(); x.arc(px, 0.07 + Math.sin(t * 3 + i) * 0.01, 0.025, 0, 6.28); x.fill();
    }
    x.lineWidth = 0.02; x.beginPath(); x.moveTo(0.18, -0.03); x.lineTo(0.27, -0.08); x.moveTo(0.18, 0.03); x.lineTo(0.27, 0.08); x.stroke();
  },
  moray(x, t) {
    x.lineWidth = 0.13; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-0.15, 0);
    for (let i = 1; i <= 8; i++) { const u = i / 8; x.lineTo(-0.15 + u * 0.55, Math.sin(t * 2.5 - u * 4) * 0.06 * u); }
    x.stroke();
    const hy = Math.sin(t * 2.5 - 4) * 0.06;
    x.beginPath(); x.ellipse(0.42, hy, 0.1, 0.075, 0, 0, 6.28); x.fill();
    x.save(); x.shadowBlur = 0; x.fillStyle = C.coat;
    x.beginPath(); x.arc(0.44, hy - 0.025, 0.018, 0, 6.28); x.fill();
    x.lineWidth = 0.015; x.strokeStyle = C.coat; x.beginPath(); x.moveTo(0.52, hy + 0.01); x.lineTo(0.42, hy + 0.035); x.stroke();
    x.restore();
  },
  octopus(x, t) {
    x.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      x.lineWidth = 0.06;
      x.beginPath(); x.moveTo(0, 0);
      let px = 0, py = 0;
      for (let k = 1; k <= 6; k++) {
        const u = k / 6, aa = a + Math.sin(t * 1.6 + i + u * 3) * 0.5 * u;
        px += Math.cos(aa) * 0.075; py += Math.sin(aa) * 0.075;
        x.lineWidth = 0.07 * (1 - u * 0.7);
        x.lineTo(px, py);
      }
      x.stroke();
    }
    x.beginPath(); x.ellipse(-0.03, 0, 0.17, 0.14, 0, 0, 6.28); x.fill();
    x.save(); x.shadowBlur = 0; x.fillStyle = C.coat;
    x.beginPath(); x.ellipse(0.06, -0.06, 0.025, 0.015, 0, 0, 6.28); x.ellipse(0.06, 0.06, 0.025, 0.015, 0, 0, 6.28); x.fill();
    x.restore();
  },
  turtle(x, t) {
    const f = Math.sin(t * 2) * 0.5;
    for (const [fx, fy, s, k] of [[0.18, -0.22, -1, 1], [0.18, 0.22, 1, 1], [-0.22, -0.14, -1, 0.6], [-0.22, 0.14, 1, 0.6]]) {
      x.save(); x.translate(fx, fy); x.rotate(s * (0.5 + f * k));
      x.beginPath(); x.ellipse(0, s * 0.1 * k, 0.07 * k + 0.02, 0.16 * k, 0, 0, 6.28); x.fill();
      x.restore();
    }
    x.beginPath(); x.ellipse(0.4, 0, 0.1, 0.08, 0, 0, 6.28); x.fill();
    x.beginPath(); x.ellipse(0, 0, 0.36, 0.27, 0, 0, 6.28); x.fill();
    x.save(); x.shadowBlur = 0; x.strokeStyle = C.coat; x.lineWidth = 0.022;
    x.beginPath(); x.moveTo(-0.15, -0.12); x.lineTo(0.1, -0.12); x.lineTo(0.2, 0); x.lineTo(0.1, 0.12); x.lineTo(-0.15, 0.12); x.lineTo(-0.24, 0); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(-0.15, -0.12); x.lineTo(-0.2, -0.25); x.moveTo(0.1, -0.12); x.lineTo(0.12, -0.26); x.moveTo(-0.15, 0.12); x.lineTo(-0.2, 0.25); x.moveTo(0.1, 0.12); x.lineTo(0.12, 0.26); x.stroke();
    x.restore();
  },
  manta(x, t) {
    const w = 0.85 + Math.sin(t * 1.4) * 0.12;
    x.beginPath();
    x.moveTo(0.35, 0);
    x.quadraticCurveTo(0.2, -w * 0.4, -0.05, -w * 0.75);
    x.quadraticCurveTo(-0.1, -w * 0.3, -0.3, -0.06);
    x.lineTo(-0.3, 0.06);
    x.quadraticCurveTo(-0.1, w * 0.3, -0.05, w * 0.75);
    x.quadraticCurveTo(0.2, w * 0.4, 0.35, 0);
    x.fill();
    x.lineWidth = 0.03; x.beginPath(); x.moveTo(-0.3, 0); x.lineTo(-0.8, Math.sin(t * 2) * 0.05); x.stroke();
    x.lineWidth = 0.05; x.beginPath(); x.moveTo(0.33, -0.07); x.lineTo(0.43, -0.1); x.moveTo(0.33, 0.07); x.lineTo(0.43, 0.1); x.stroke();
  },
  shark(x, t) {
    const sw = Math.sin(t * 3) * 0.12;
    x.beginPath();
    x.moveTo(0.75, 0);
    x.quadraticCurveTo(0.4, -0.17, -0.2, -0.1);
    x.quadraticCurveTo(-0.5, -0.05, -0.62, sw);
    x.lineTo(-0.85, -0.22 + sw); x.lineTo(-0.75, sw); x.lineTo(-0.82, 0.18 + sw); x.lineTo(-0.62, sw + 0.02);
    x.quadraticCurveTo(-0.5, 0.05, -0.2, 0.1);
    x.quadraticCurveTo(0.4, 0.17, 0.75, 0);
    x.fill();
    x.beginPath(); x.moveTo(0.25, -0.12); x.lineTo(0.02, -0.42); x.lineTo(0.0, -0.1); x.fill();
    x.beginPath(); x.moveTo(0.25, 0.12); x.lineTo(0.02, 0.42); x.lineTo(0.0, 0.1); x.fill();
  },
};

// a creature on its own little plate, for the log
export function creaturePlate(id, w, h, dpr, found) {
  const c = canvas(w * dpr, h * dpr), x = c.getContext('2d');
  x.fillStyle = found ? C.coat : '#2c4f7d'; x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2);
  const k = { shark: 0.55, manta: 0.6, turtle: 0.95, parrot: 1.2, moray: 1.1, damsel: 2.2, octopus: 1.4 }[id] || 1.7;
  x.scale(c.height * 0.5 * k, c.height * 0.5 * k);
  x.fillStyle = x.strokeStyle = found ? C.white : 'rgba(238,244,243,.28)';
  x.shadowColor = 'rgba(225,240,255,.7)'; x.shadowBlur = found ? 4 * dpr : 0;
  if (id === 'damsel') { for (const [dx, dy] of [[-0.2, -0.15], [0.12, -0.05], [-0.05, 0.16]]) { x.save(); x.translate(dx, dy); CREATURE.damsel(x, 0); x.restore(); } }
  else if (id === 'moray') { x.translate(-0.15, 0); CREATURE.moray(x, 0.3); }
  else CREATURE[id](x, 0.4);
  return c;
}
