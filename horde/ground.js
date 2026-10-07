// Horde: the six fields, painted pixel by pixel once a night: patchy dithered ground, roads and flagstones, flat
// litter baked in, and the standing things (graves, birches, a shrine) handed back to be drawn in depth order.
// Only the lamplit colours are painted; the shader works out the moonlit ones.
import { hex } from './art.js';
import { mulberry } from './game.js';

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export const bayer = (x, y) => B4[(y & 3) * 4 + (x & 3)];

function noise2(seed) {
  const R = mulberry(seed), P = new Float32Array(512);
  for (let i = 0; i < 512; i++) P[i] = R();
  const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 511];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

export const SETTINGS = {
  crossroads: { ground: ['#1d2717', '#24301b', '#2b391f', '#334324', '#3e4f2b'], road: ['#33281d', '#3e3123', '#4a3b2a', '#574633'], roads: 'cross',
    flat: { tuft: 40, stone: 10, bones: 3, heather: 0 }, stand: [['shrine', 1, 'mid'], ['sign', 1, 'mid'], ['grave2', 2], ['stone', 0], ['candle', 0]] },
  churchyard: { ground: ['#19221a', '#1f2a1e', '#253222', '#2c3a27', '#35452d'], road: ['#3e3c44', '#4a4852', '#56545e', '#62606a'], roads: 'flag',
    flat: { tuft: 34, stone: 6, bones: 4 }, stand: [['grave', 9], ['grave2', 8], ['cross', 5], ['candle', 6]] },
  birches: { ground: ['#241c14', '#2c2218', '#35291c', '#3f3120', '#4a3a26'], moss: ['#24301a', '#2c3a1f'], road: null,
    flat: { tuft: 16, stone: 8, shroom: 10, fern: 14 }, stand: [['birch', 9, 'edge'], ['stump', 4]] },
  mill: { ground: ['#1a1817', '#211e1c', '#292522', '#322d29', '#3d3631'], road: ['#2a221b', '#332920', '#3c3026', '#46372b'], roads: 'track',
    flat: { stone: 12, bones: 4, tuft: 10 }, stand: [['beam', 5], ['millstone', 1, 'mid'], ['ember', 7]] },
  abbey: { ground: ['#1b2618', '#21301c', '#283820', '#2f4125', '#384c2c'], road: ['#45434b', '#504e57', '#5c5a63', '#69676f'], roads: 'court',
    flat: { tuft: 18, herb: 12, stone: 4 }, stand: [['well', 1, 'mid'], ['hedge', 6, 'edge'], ['candle', 3]] },
  dawnroad: { ground: ['#212418', '#282d1c', '#303621', '#394026', '#434b2d'], road: ['#4a4436', '#575040', '#655d4a', '#736a55'], roads: 'diag',
    flat: { tuft: 30, heather: 26, stone: 8 }, stand: [['standing', 7, 'ring'], ['candle', 2]] },
};
const FLAT_PROPS = new Set(['tuft', 'stone', 'bones', 'heather', 'shroom', 'fern', 'herb']);

// paints the ground (lit and moonlit) and lays out the standing props. sprites: from bakeAll()
export function makeField(setting, W, H, seed, sprites) {
  const S = SETTINGS[setting] || SETTINGS.crossroads, R = mulberry(seed * 31 + 7), n1 = noise2(seed), n2 = noise2(seed + 99), n3 = noise2(seed + 7);
  const gcol = S.ground.map(hex), rcol = S.road?.map(hex), mcol = S.moss?.map(hex);
  const cx = W / 2, cy = H / 2;
  // roads as a distance function: returns 0 on the road's middle line, growing away from it
  const roads = [];
  const wob = (t, a) => Math.sin(t * 0.035 + seed) * a + Math.sin(t * 0.011 + seed * 2) * a * 1.6;
  if (S.roads === 'cross') { roads.push((x, y) => Math.abs(y - cy - wob(x, 4)) - 7); roads.push((x, y) => Math.abs(x - cx * 1.05 - wob(y, 3)) - 6); }
  if (S.roads === 'track') roads.push((x, y) => Math.abs(y - cy * 1.2 - wob(x, 6)) - 8);
  if (S.roads === 'diag') roads.push((x, y) => Math.abs((x - cx) * 0.45 - (y - cy) + wob(x, 4)) / 1.1 - 9);
  if (S.roads === 'flag') roads.push((x, y) => Math.abs(x - cx) - 9 + (y < cy - 30 ? 0 : 0));
  const court = S.roads === 'court' ? (x, y) => Math.max(Math.abs(x - cx) - W * 0.22, Math.abs(y - cy) - H * 0.2) : null;
  const D = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = n1(x / 26, y / 26) * 0.6 + n2(x / 9, y / 9) * 0.3 + n3(x / 3.3, y / 3.3) * 0.1;
    // a dithered step between shades: crisp pixels, no blur
    let f = v * (gcol.length - 0.3) + (bayer(x, y) - 0.5) * 0.9;
    let col = gcol[Math.max(0, Math.min(gcol.length - 1, Math.floor(f)))];
    if (mcol && n2(x / 14 + 40, y / 14) > 0.62) col = mcol[(n3(x / 4, y / 4) + bayer(x, y) * 0.5) > 0.8 ? 1 : 0];
    let rd = 1e9; for (const r of roads) rd = Math.min(rd, r(x, y));
    if (rcol && rd < 2.5) {
      const edge = rd > 0 ? (2.5 - rd) / 2.5 : 1;
      if (edge > bayer(x + 1, y + 2)) {
        if (S.roads === 'flag') {
          // flagstones: tiles with dark joints
          const tx = (x - cx + 9) % 9, ty = (y + ((Math.floor((x - cx + 9) / 9) & 1) * 4)) % 8;
          col = (tx === 0 || ty === 0) ? rcol[0] : rcol[1 + ((n3(Math.floor((x - cx + 9) / 9) * 3.1, Math.floor(y / 8) * 2.7) * 3) | 0)];
          if (n1(x / 7, y / 7) > 0.72 && bayer(x, y) < 0.5) col = gcol[2];
        } else {
          const rv = n3(x / 2.5, y / 2.5) * 0.7 + n1(x / 11, y / 11) * 0.3;
          col = rcol[Math.max(0, Math.min(rcol.length - 1, Math.floor(rv * rcol.length + (bayer(x, y) - 0.5) * 0.8)))];
          if (rd < -3 && rd > -4.2 && S.roads !== 'diag') col = rcol[0];  // cart ruts
        }
      }
    }
    if (court) {
      const cd = court(x, y);
      if (cd < 1.5 && (cd < 0 || bayer(x, y) < 0.5)) {
        const tx = Math.floor((x - cx) / 10), ty = Math.floor((y - cy) / 10), jx = ((x - cx) % 10 + 10) % 10, jy = ((y - cy) % 10 + 10) % 10;
        col = (jx === 0 || jy === 0) ? rcol[0] : rcol[1 + ((n3(tx * 1.7, ty * 2.3) * 3) | 0)];
        if (jx === 1 || jy === 1) col = rcol[Math.min(3, 2 + ((n3(tx * 1.7, ty * 2.3) * 2) | 0))];
        if (n2(x / 6, y / 6) > 0.74 && bayer(x, y) < 0.6) col = gcol[1];
      }
    }
    const p = (y * W + x) * 4;
    D[p] = col[0]; D[p + 1] = col[1]; D[p + 2] = col[2]; D[p + 3] = 255;
  }
  // flat litter, baked into the ground
  const blit = (img, x0, y0, flip) => {
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const sx = flip ? img.w - 1 - x : x, s = (y * img.w + sx) * 4, X = x0 + x, Y = y0 + y;
      if (!img.d[s + 3] || X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const t = (Y * W + X) * 4; D[t] = img.d[s]; D[t + 1] = img.d[s + 1]; D[t + 2] = img.d[s + 2]; D[t + 3] = 255;
    }
  };
  const onRoad = (x, y) => { let rd = 1e9; for (const r of roads) rd = Math.min(rd, r(x, y)); return rd < 3 || (court && court(x, y) < 2); };
  for (const [k, count] of Object.entries(S.flat || {})) {
    const sp = sprites.prop[k] || sprites.prop.tuft;
    for (let i = 0; i < count * (W * H) / 110000; i++) {
      const x = Math.floor(R() * (W - 8)) + 2, y = Math.floor(R() * (H - 6)) + 2;
      if (k !== 'stone' && onRoad(x + 2, y + 2)) continue;
      blit(sp.img, x, y, R() < 0.5);
    }
  }
  // standing props, placed away from the middle (the hero starts there) and from each other
  const stand = [], taken = [];
  const free = (x, y, r) => taken.every(([a, b, q]) => Math.hypot(a - x, b - y) > r + q);
  for (const [k, count, where] of S.stand) {
    const sp = sprites.prop[k]; if (!sp) continue;
    const n = where === 'mid' ? count : Math.round(count * Math.max(0.6, (W * H) / 110000));
    for (let i = 0, tries = 0; i < n && tries < 400; tries++) {
      let x, y;
      if (where === 'mid') { const a = R() * Math.PI * 2, d = 46 + R() * 20; x = cx + Math.cos(a) * d; y = cy + Math.sin(a) * d * 0.8; }
      else if (where === 'edge') { const s = (R() * 4) | 0; x = s === 0 ? 8 + R() * 22 : s === 1 ? W - 8 - R() * 22 : 10 + R() * (W - 20); y = s === 2 ? 14 + R() * 18 : s === 3 ? H - 6 - R() * 16 : 14 + R() * (H - 20); }
      else if (where === 'ring') { const a = i / n * Math.PI * 2 + R() * 0.3, d = Math.min(W, H) * 0.36; x = cx + Math.cos(a) * d * 1.25; y = cy + Math.sin(a) * d; }
      else { x = 8 + R() * (W - 16); y = 14 + R() * (H - 20); }
      x = Math.round(x); y = Math.round(y);
      const rr = Math.max(sp.w, sp.h) * 0.6 + 4;
      if (where !== 'mid' && Math.hypot(x - cx, y - cy) < 52) continue;
      if (k !== 'candle' && k !== 'ember' && onRoad(x, y)) continue;
      if (!free(x, y, rr)) continue;
      taken.push([x, y, rr]);
      stand.push({ k, x, y, f: R() < 0.5 ? 0 : 1, ph: R() * 6 });
      // a candle burns on some of the graves
      if ((k === 'grave' || k === 'grave2') && R() < 0.3) stand.push({ k: 'candle', x: x + 4, y: y + 2, f: 0, ph: R() * 6 });
      if (k === 'shrine') stand.push({ k: 'candle', x: x - 6, y: y + 2, f: 0, ph: R() * 6 });
      i++;
    }
  }
  stand.sort((p, q) => p.y - q.y);
  return { img: { w: W, h: H, d: D }, stand };
}
