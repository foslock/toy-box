// Chunky pixel art: every sprite and grain is drawn into one W×H image, then scaled up.
import { W, H, E, SAND, WET, PACK, WATER, ROCK, WOOD, PEB } from './sim.js';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pack32 = ([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);

// ---- sprites: rows of palette letters, '.' is clear
const PAL = {
  R: '#c6302a', r: '#ee5a3a', k: '#1d1a24', w: '#fbfaf2', g: '#a9b4c2', d: '#4b5468', o: '#ffb02e', y: '#f2c14e',
  b: '#b06c3a', B: '#e4473b', t: '#8a5530', n: '#2a1a12', W: '#efe3cc', h: '#5a3a22', s: '#f2b48a', a: '#2f6fd0', A: '#ffffff',
  H: '#ecc66a', p: '#ef6f9c', q: '#ffe36e', c: '#3d5a80', m: '#7d8796', S: '#f3d9a4', P: '#f7a8b8', F: '#5b3b22', K: '#e4473b',
};
const SPR = {
  crab: [
    ['R.k.k.R', 'RRrrrRR', '.rrrrr.', 'r.r.r.r'],
    ['R.k.k.R', 'RRrrrRR', '.rrrrr.', '.r.r.r.'],
    ['RRk.kRR', '.RrrrrR', '.rrrrr.', 'r.r.r.r'],
  ],
  gullFly: [
    ['d.......d', '.g.....g.', '..ggwgg..', '...wwwwo.', '.........'],
    ['.........', '.........', '.gggwgg..', 'g..wwwwo.', 'd......g.'],
  ],
  gullStand: [
    ['...ww.', '...wko', 'gggww.', 'ggwww.', '.ggww.', '..y.y.'],
    ['......', '...ww.', 'gggwko', 'ggwww.', '.ggww.', '..y.y.'],
  ],
  dog: [
    ['........bb.', '.......bbkb', 't.bbbbbbbbn', '.bbWWWWbbb.', '.b.b...b.b.'],
    ['........bb.', '.......bbkb', '.tbbbbbbbbn', '.bbWWWWbbb.', '..b.b.b.b..'],
  ],
  kid: [
    ['.hhh.', 'hhsk.', '.sss.', 'aaaas', 'AAAAB', '.aaaB', '.s.s.', '.s.s.'],
    ['.hhh.', 'hhsk.', '.sss.', 'aaaas', 'AAAAB', '.aaaB', '.s..s', 's...s'],
  ],
  kidFull: [
    ['.hhh.', 'hhsk.', '.sss.', 'aaaay', 'AAAAB', '.aaaB', '.s.s.', '.s.s.'],
    ['.hhh.', 'hhsk.', '.sss.', 'aaaay', 'AAAAB', '.aaaB', '.s..s', 's...s'],
  ],
  man: [
    ['..HHH..', '.HHHHH.', '..ssk..', '..sss..', '.ppppp.', 'spqpqps', '.ppppp.', '.pqppp.', '.ccccc.', '.cc.cc.', '.s...s.', '.s...s.', '.s...s.', 'kk...kk'],
    ['..HHH..', '.HHHHH.', '..ssk..', '..sss..', '.ppppp.', 'spqpqps', '.ppppp.', '.pqppp.', '.ccccc.', '.cc.cc.', '..s.s..', '..s.s..', '.s...s.', 'kk...kk'],
  ],
  shell: [['.A.', 'PAP', 'PPP']],
  flag: [['FKKK', 'FKKA', 'FKK.', 'FK..', 'F...', 'F...', 'F...', 'F...'], ['FKK.', 'FKKK', 'FKA.', 'FK..', 'F...', 'F...', 'F...', 'F...']],
  spade: [['..ttt..', '...t...', '...t...', '...t...', '..mmm..', '.mmmmm.', '.mmmmm.', '..mmm..', '...m...']],
  pail: [['..kkk..', '.k...k.', 'BBBBBBB', '.BBBBB.', '.BAABB.', '.BBBBB.', '..BBB..']],
  mould: [['S.S.S.S', 'SSSSSSS', '.SSSSS.', '.SSkSS.', '.SSkSS.', 'SSSSSSS']],
  post: [['.b.', 'bbt', 'bbt', 'btt', 'bbt', 'bbt', 'btb', 'bbt', 'bbt']],
  pebbles: [['..g....', '.gmg.m.', 'gmmgmmg', '.ggmgg.']],
  hand: [['..kk....', '.kwwk...', '.kwwkkk.', '.kwwwwwk', 'kkwwwwwk', 'kwwwwwwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..']],
};
const SPRITES = {};
for (const [name, frames] of Object.entries(SPR)) {
  SPRITES[name] = frames.map((rows) => {
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    const px = new Int32Array(w * h).fill(0);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) px[y * w + x] = pack32(hex(PAL[ch])); }));
    return { w, h, px };
  });
}
export { SPRITES };

// ---- grain palettes: four shades each
const shades = (list) => list.map((h) => hex(h));
const C = {
  sand: shades(['#f3d9a4', '#eed094', '#f7e2b3', '#e8c98c']),
  sandTop: hex('#fff1c9'), deep: hex('#c8a06a'),
  wet: shades(['#c99d63', '#bd9058', '#d2a76f', '#c49660']),
  pack: shades(['#e8b673', '#e1ab66', '#eec07f', '#e5b26e']),
  packWet: hex('#a97a45'),
  packLit: hex('#f8d396'), packShade: hex('#c58c4f'),
  peb: shades(['#9a948c', '#b4ada3', '#7a756e', '#8b857d']),
  rock: shades(['#6b5d52', '#5c5047', '#77695b', '#625549']),
  wood: shades(['#8a5a36', '#7a4e2e', '#9b6a40', '#83552f']),
  water: shades(['#bff3f2', '#6fd6e0', '#3fb2cf', '#2786b4', '#1d5f93']),
  foam: hex('#ffffff'),
};

// sky keyframes over the day: [t, top, mid, bottom]
const SKY = [
  [0.0, '#62c2ef', '#9ad9f3', '#d8f3f9'],
  [0.45, '#48aeea', '#86d0f2', '#c8edf6'],
  [0.75, '#6ba6da', '#a9c9de', '#f4dda8'],
  [0.9, '#5a68a8', '#d89a86', '#ffd99a'],
  [1.0, '#363f80', '#e2786a', '#ffc77e'],
].map(([t, a, b, c]) => [t, hex(a), hex(b), hex(c)]);
function skyAt(tod) {
  let i = 0; while (i < SKY.length - 2 && tod > SKY[i + 1][0]) i++;
  const [t0, a0, b0, c0] = SKY[i], [t1, a1, b1, c1] = SKY[i + 1];
  const u = Math.max(0, Math.min(1, (tod - t0) / (t1 - t0)));
  return [mix(a0, a1, u), mix(b0, b1, u), mix(c0, c1, u)];
}
export function skyColors(tod) { return skyAt(tod).map((c) => `rgb(${c})`); }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const HZ = 44; // horizon row

export class Painter {
  constructor() {
    this.cv = document.createElement('canvas');
    this.cv.width = W; this.cv.height = H;
    this.cx = this.cv.getContext('2d');
    this.img = this.cx.createImageData(W, H);
    this.px = new Uint32Array(this.img.data.buffer);
    this.bg = new Uint32Array(W * H);
    this.bgTod = -1;
    this.colDepth = new Int16Array(W);
  }

  background(tod, time) {
    const [top, mid, bot] = skyAt(tod);
    const bg = this.bg;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = BAYER[(y & 3) * 4 + (x & 3)];
        let c;
        if (y < HZ) {
          const u = y / HZ;
          // banded sky with dithered steps between bands
          const q = Math.floor(u * 7 + d * 0.9) / 7;
          c = q < 0.5 ? mix(top, mid, q * 2) : mix(mid, bot, (q - 0.5) * 2);
        } else {
          const u = (y - HZ) / (H - HZ);
          const q = Math.floor(u * 5 + d * 0.9) / 5;
          const farTop = mix(mix(bot, [111, 196, 214], 0.55), [255, 255, 255], 0.08), farBot = mix(mid, [60, 150, 190], 0.6);
          c = mix(farTop, farBot, q);
        }
        bg[y * W + x] = pack32(c);
      }
    }
    // a headland with a lighthouse, far away on the left
    const land = pack32(mix(mix(mid, [70, 110, 120], 0.55), bot, 0.15));
    for (let x = 0; x < 34; x++) {
      const h = Math.round(5 - x * 0.12 + Math.sin(x * 0.7) * 0.8);
      for (let y = HZ - h; y < HZ + 1; y++) if (h > 0) bg[y * W + x] = land;
    }
    const lw = pack32([250, 246, 236]), lr = pack32([214, 72, 60]);
    for (let y = HZ - 13; y < HZ - 4; y++) for (let x = 10; x < 12; x++) bg[y * W + x] = ((y >> 1) & 1) ? lr : lw;
    bg[(HZ - 14) * W + 10] = bg[(HZ - 14) * W + 11] = pack32([255, 236, 140]);
    // distant pier on the right
    const pier = pack32(mix(mid, [80, 90, 110], 0.5));
    for (let x = 124; x < W; x++) bg[(HZ - 3) * W + x] = pier;
    for (let x = 126; x < W; x += 5) for (let y = HZ - 2; y < HZ + 2; y++) bg[y * W + x] = pier;
    this.bgTod = tod;
  }

  sun(tod, time) {
    const px = this.px;
    const sx = 18 + tod * 120, sy = 30 - Math.sin(Math.min(1, tod * 1.1) * Math.PI) * 20 + (tod > 0.85 ? (tod - 0.85) * 60 : 0);
    const core = pack32(mix(hex('#fff6c2'), hex('#ffb14a'), Math.max(0, tod - 0.6) / 0.4));
    const rim = pack32(mix(hex('#ffe680'), hex('#ff8a4a'), Math.max(0, tod - 0.6) / 0.4));
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const d = x * x + y * y, X = Math.round(sx + x), Y = Math.round(sy + y);
      if (X < 0 || X >= W || Y < 0 || Y >= HZ) continue;
      if (d <= 16) px[Y * W + X] = core; else if (d <= 26) px[Y * W + X] = rim;
    }
    // glitter on the far sea under the sun
    const gl = pack32([255, 250, 225]);
    for (let k = 0; k < 14; k++) {
      const y = HZ + 1 + ((k * 7) % 12), x = Math.round(sx + Math.sin(time * 1.7 + k * 2.1) * (3 + k * 0.6));
      if (x >= 0 && x < W && ((time * 4 + k) % 2) < 1.1) px[y * W + x] = gl;
    }
  }

  clouds(time) {
    const px = this.px, c1 = pack32([255, 255, 255]), c2 = pack32([226, 238, 246]);
    const blobs = [[0, 10, 1], [70, 18, 0.7], [130, 7, 1.2]];
    for (const [ox, oy, sc] of blobs) {
      const cx = ((ox + time * 1.2 * sc) % (W + 40)) - 20;
      for (const [dx, dy, r] of [[0, 0, 4], [5, -2, 5], [11, 0, 4], [7, 2, 3]]) {
        const R = r * sc;
        for (let y = -R; y <= R; y++) for (let x = -R * 1.4; x <= R * 1.4; x++) {
          if ((x / 1.4) ** 2 + y * y > R * R) continue;
          const X = Math.round(cx + dx * sc + x), Y = Math.round(oy + dy * sc + y);
          if (X < 0 || X >= W || Y < 0 || Y >= HZ) continue;
          px[Y * W + X] = y > R * 0.35 ? c2 : c1;
        }
      }
    }
  }

  cells(b, time) {
    const { px } = this, t = b.t, m = b.m, v = b.v, cd = this.colDepth;
    cd.fill(0);
    const tops = this.tops || (this.tops = new Int16Array(W));
    for (let x = 0; x < W; x++) tops[x] = b.topAt(x);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, k = t[i];
        if (k !== WATER) cd[x] = 0;
        if (k === E) continue;
        const s = v[i] & 3;
        const up = y > 0 ? t[i - W] : E;
        let c;
        switch (k) {
          case SAND: {
            c = up === E ? C.sandTop : C.sand[s];
            const dd = y - tops[x] + BAYER[(y & 3) * 4 + (x & 3)] * 5;
            if (dd > 6) c = mix(c, C.deep, dd > 26 ? 0.42 : dd > 15 ? 0.28 : 0.14);
            break;
          }
          case WET: c = C.wet[s]; if (up === E) c = mix(c, C.sandTop, 0.25); break;
          case PACK: {
            c = C.pack[s];
            const l = x > 0 ? t[i - 1] : PACK, r = x < W - 1 ? t[i + 1] : PACK;
            if (up === E) c = C.packLit;
            else if (l === E) c = mix(c, C.packLit, 0.6);
            else if (r === E) c = C.packShade;
            else if (y % 4 === 0 && ((x + (y >> 2) * 3) % 7) !== 0) c = mix(c, C.packShade, 0.22);
            if (m[i] > 20) c = mix(c, C.packWet, Math.min(0.85, m[i] / 220));
            break;
          }
          case PEB: c = C.peb[s]; break;
          case ROCK: c = C.rock[s]; break;
          case WOOD: c = C.wood[(s + (x & 1)) & 3]; if (up === E) c = mix(c, [190, 140, 96], 0.5); break;
          case WATER: {
            const d = cd[x]++;
            if (d === 0) {
              const front = (x > 0 && t[i - 1] !== WATER && t[i - 1] !== E) || (x > 0 && t[i - 1] === E && y < H - 1 && t[i + W - 1] !== E);
              c = front || ((v[i] + time * 9) % 40) < 1.2 ? C.foam : C.water[0];
            } else c = C.water[Math.min(4, 1 + (d >> 1))];
            if (d > 0 && ((x * 7 + y * 13 + Math.floor(time * 3)) % 61) === 0) c = C.water[0];
            break;
          }
        }
        px[i] = pack32(c);
      }
    }
  }

  sprite(name, frame, x, y, flip = false, alpha = 1) {
    const fs = SPRITES[name]; if (!fs) throw new Error("no sprite " + name); const f = fs[(((frame | 0) % fs.length) + fs.length) % fs.length]; if (!f) throw new Error("bad frame " + name + " " + frame);
    const ox = Math.round(x - f.w / 2), oy = Math.round(y - f.h + 1);
    const { px } = this;
    for (let j = 0; j < f.h; j++) {
      const Y = oy + j; if (Y < 0 || Y >= H) continue;
      for (let i = 0; i < f.w; i++) {
        const X = ox + i; if (X < 0 || X >= W) continue;
        const c = f.px[j * f.w + (flip ? f.w - 1 - i : i)];
        if (c && (alpha >= 1 || BAYER[(Y & 3) * 4 + (X & 3)] < alpha)) px[Y * W + X] = c;
      }
    }
  }
  dot(x, y, rgb) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) this.px[y * W + x] = pack32(rgb);
  }
  ring(cx, cy, r, rgb) {
    const c = pack32(rgb);
    for (let a = 0; a < 64; a++) {
      const x = Math.round(cx + Math.cos(a / 64 * Math.PI * 2) * r), y = Math.round(cy + Math.sin(a / 64 * Math.PI * 2) * r);
      if (x >= 0 && x < W && y >= 0 && y < H && ((a >> 1) & 1)) this.px[y * W + x] = c;
    }
  }

  begin(tod, time) {
    if (Math.abs(tod - this.bgTod) > 0.004) this.background(tod, time);
    this.px.set(this.bg);
    this.sun(tod, time);
    this.clouds(time);
  }
  end() { this.cx.putImageData(this.img, 0, 0); return this.cv; }
}

// a sprite on its own little canvas, for buttons and the tutorial
export function spriteCanvas(name, frame = 0, scale = 4, flip = false) {
  const f = SPRITES[name][frame];
  const cv = document.createElement('canvas');
  cv.width = f.w; cv.height = f.h;
  const cx = cv.getContext('2d'), img = cx.createImageData(f.w, f.h);
  const p = new Uint32Array(img.data.buffer);
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) p[j * f.w + i] = f.px[j * f.w + (flip ? f.w - 1 - i : i)];
  cx.putImageData(img, 0, 0);
  cv.style.width = f.w * scale + 'px'; cv.style.height = f.h * scale + 'px';
  cv.style.imageRendering = 'pixelated';
  return cv;
}
