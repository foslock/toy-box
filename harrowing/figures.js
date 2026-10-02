// The angel and the demons, painted part by part on canvases and rigged as flat layers (wings, body, arm, head,
// tail), so they breathe, flap and lunge in the 3D scene. Everything is drawn in a 512-pixel frame with the feet at
// (256, 496); each part is cropped to what's painted and remembers where it sat.
import { canvas, lin, rad, rgba, mixc, rand, TAU } from './paint.js';

const FW = 512, FH = 512, FX = 256, FY = 496;

/* ---------- small drawing helpers ---------- */
function shapeFill(g, path, cols, x0 = 0, y0 = 0, x1 = 0, y1 = FH) { g.fillStyle = lin(g, x0, y0, x1, y1, cols.map((c, i) => [i / (cols.length - 1), c])); g.fill(path); }
const P = d => new Path2D(d);
function ellipse(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); }
function stroke(g, d, col, w, a = 1) { g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(typeof d === 'string' ? P(d) : d); g.restore(); }
// a soft glow dot (for eyes and embers) on a glow canvas
function glowDot(g, x, y, r, col, core = '#ffffff') {
  g.fillStyle = rad(g, x, y, 0, r * 3, [[0, rgba(col, .9)], [.35, rgba(col, .35)], [1, rgba(col, 0)]]); g.beginPath(); g.arc(x, y, r * 3, 0, TAU); g.fill();
  g.fillStyle = core; g.beginPath(); g.arc(x, y, r * .55, 0, TAU); g.fill();
}
function crop(c) {
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 4) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = 10;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(c, -x0, -y0);
  return { canvas: out, x: x0, y: y0 };
}
// A rig under construction: part(name, draw, o) paints a part into the frame.
class Rig {
  constructor(o = {}) { this.parts = []; this.o = o; this.frameH = o.frameH ?? FH; }
  part(name, draw, o = {}) {
    // drawn on the CPU (willReadFrequently), since each part is read back once to crop it
    const c = canvas(FW, this.frameH), g = c.getContext('2d', { willReadFrequently: true });
    draw(g);
    let glow = null;
    if (o.glow) { const gc = canvas(FW, this.frameH); o.glow(gc.getContext('2d', { willReadFrequently: true })); glow = gc; }
    const cr = crop(c);
    const gcr = glow ? crop(glow) : null;
    if (!cr && !gcr) return this;
    this.parts.push({ name, base: cr, glow: gcr, pivot: o.pivot ?? [FX, FY], z: o.z ?? this.parts.length, anim: o.anim ?? null, parent: o.parent ?? null });
    return this;
  }
}

/* ---------- wings ---------- */
// A bat's wing: an arm up and out to the wrist, finger bones fanning from it, a scalloped membrane between them.
function batWing(g, sx, sy, len, up, col, col2, side = -1, tatter = 0) {
  const W = [sx + side * len * .42, sy - len * .62 * up];
  const angs = [78, 46, 16, -14];             // finger directions, from up to down-and-out
  const lens = [.62, .78, .7, .5];
  const tips = angs.map((a, i) => [W[0] + side * Math.cos(a * Math.PI / 180) * len * lens[i], W[1] - Math.sin(a * Math.PI / 180) * len * lens[i] * up]);
  const root = [sx + side * len * .1, sy + len * .36];
  const p = new Path2D();
  p.moveTo(sx, sy - len * .04);
  p.quadraticCurveTo(sx + side * len * .16, W[1] - len * .06, W[0], W[1]);
  p.lineTo(tips[0][0], tips[0][1]);
  for (let i = 1; i < tips.length; i++) {
    const a = tips[i - 1], b = tips[i];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ix = mx + (W[0] - mx) * .32, iy = my + (W[1] - my) * .32;
    p.quadraticCurveTo(ix, iy, b[0], b[1]);
  }
  const last = tips[tips.length - 1];
  p.quadraticCurveTo((last[0] + root[0]) / 2 + side * len * .02, (last[1] + root[1]) / 2 - len * .08, root[0], root[1]);
  p.closePath();
  g.save();
  g.fillStyle = lin(g, sx, sy, W[0] + side * len * .4, W[1], [[0, col], [1, col2]]);
  g.fill(p);
  // veins in the membrane
  g.globalAlpha = .35; g.strokeStyle = mixc(col2, '#ffffff', .2); g.lineWidth = 1.5;
  for (const t of tips) { g.beginPath(); g.moveTo(W[0] + (t[0] - W[0]) * .3, W[1] + (t[1] - W[1]) * .3); g.quadraticCurveTo((W[0] + root[0]) / 2, (W[1] + root[1]) / 2 + 10, root[0] + side * 6, root[1] - 10); g.stroke(); }
  g.globalAlpha = 1;
  if (tatter) { g.globalCompositeOperation = 'destination-out'; const r = rand(tatter); for (let i = 0; i < 7; i++) { const a = tips[1 + (i % 3)], b = tips[(i % 3)]; const t = r(); ellipse(g, a[0] + (b[0] - a[0]) * t + side * (r() - .5) * 20, a[1] + (b[1] - a[1]) * t + 14 + r() * 26, 5 + r() * 9, 8 + r() * 14); g.fill(); } g.globalCompositeOperation = 'source-over'; }
  // bones
  const bone = mixc(col, '#000000', .5);
  g.strokeStyle = bone; g.lineCap = 'round';
  g.lineWidth = 7; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + side * len * .16, W[1] - len * .06, W[0], W[1]); g.stroke();
  g.lineWidth = 3.5;
  for (const t of tips) { g.beginPath(); g.moveTo(W[0], W[1]); g.lineTo(t[0], t[1]); g.stroke(); }
  // a claw at the wrist
  g.fillStyle = '#e8dcc4'; g.beginPath(); g.moveTo(W[0] - 5, W[1]); g.lineTo(W[0] + side * 4, W[1] - 16); g.lineTo(W[0] + 5, W[1]); g.fill();
  g.restore();
}
// A feathered wing: a curved leading edge out to the tip, long primaries hanging from it, rows of shorter feathers
// toward the shoulder, each feather its own shape.
function featherWing(g, sx, sy, len, col, col2, side = -1, layers = 3, dark = false) {
  const tip = [sx + side * len * .95, sy - len * .78];
  const elbow = [sx + side * len * .38, sy - len * .46];
  const edge = t => {   // a point along the leading edge, shoulder (0) to tip (1)
    const a = 1 - t;
    return [a * a * sx + 2 * a * t * (elbow[0] + side * len * .04) + t * t * tip[0], a * a * (sy - len * .05) + 2 * a * t * (elbow[1] - len * .2) + t * t * tip[1]];
  };
  const feather = (bx, by, ang, fl, w, c1, c2) => {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const tx = bx + dx * fl, ty = by + dy * fl;
    const p = new Path2D();
    p.moveTo(bx + nx * w * .5, by + ny * w * .5);
    p.bezierCurveTo(bx + dx * fl * .35 + nx * w, by + dy * fl * .35 + ny * w, tx + nx * w * .5 - dx * w * .4, ty + ny * w * .5 - dy * w * .4, tx, ty);
    p.bezierCurveTo(tx - nx * w * .4 - dx * w * .5, ty - ny * w * .4 - dy * w * .5, bx + dx * fl * .4 - nx * w * .7, by + dy * fl * .4 - ny * w * .7, bx - nx * w * .5, by - ny * w * .5);
    p.closePath();
    g.fillStyle = lin(g, bx, by, tx, ty, [[0, c1], [1, c2]]); g.fill(p);
    g.strokeStyle = dark ? 'rgba(0,0,0,.5)' : 'rgba(150,115,50,.38)'; g.lineWidth = 1.4; g.stroke(p);
    g.strokeStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(170,135,70,.45)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + dx * fl * .5 + nx * w * .15, by + dy * fl * .5 + ny * w * .15, tx, ty); g.stroke();
  };
  const down = Math.PI / 2;
  // primaries: from the tip back along the outer half, long and hanging down-and-out
  for (let i = 0; i < 9; i++) {
    const t = 1 - i * .07, [bx, by] = edge(t);
    const ang = down - side * (.95 - i * .09);
    feather(bx, by, ang, len * (.62 - i * .025), len * .1, mixc(col, col2, .25), col2);
  }
  // secondaries: along the inner half
  for (let i = 0; i < 8; i++) {
    const t = .4 - i * .045, [bx, by] = edge(t);
    feather(bx, by, down - side * (.2 - i * .02), len * (.48 - i * .02), len * .1, col, mixc(col, col2, .6));
  }
  // coverts: two rows of short, rounded feathers over the roots
  for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
    const t = .08 + i * .1, [bx, by] = edge(t);
    feather(bx + side * 4, by + 6 + row * len * .08, down - side * (.35 + t * .5), len * (.2 - row * .04) * (1 + t * .4), len * .09, mixc(col, '#ffffff', dark ? .04 : .5 - row * .2), col);
  }
  // the leading edge itself, a soft bright band
  g.save(); g.lineCap = 'round';
  const pts = Array.from({ length: 20 }, (_, i) => edge(i / 19));
  g.strokeStyle = mixc(col, '#ffffff', dark ? .08 : .7); g.lineWidth = len * .07;
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  g.restore();
}

/* ---------- the angel ---------- */
function angel() {
  const r = new Rig({ frameH: 600 });
  const SX = 248, SY = 250;   // shoulders
  // far wing (behind, smaller), near wing (behind the body, larger)
  r.part('wingFar', g => featherWing(g, SX + 22, SY - 4, 205, '#fffaf0', '#e8cf8a', 1, 3), { pivot: [SX + 22, SY], z: 0, anim: { rot: .1, speed: 1.6, phase: .4 } });
  r.part('wingNear', g => featherWing(g, SX - 18, SY + 2, 250, '#ffffff', '#f0d48a', -1, 3), { pivot: [SX - 18, SY], z: 1, anim: { rot: -.12, speed: 1.6 } });
  // robe and body
  r.part('body', g => {
    // robe flowing down, hem fluttering
    const robe = P('M222 262 C206 300 196 360 188 420 C182 470 170 520 160 560 C190 552 214 566 236 556 C258 568 280 552 304 562 C318 552 330 556 342 552 C330 500 318 440 306 380 C298 330 290 290 276 262 Z');
    shapeFill(g, robe, ['#ffffff', '#efe6d4', '#b9a98a'], 180, 260, 330, 560);
    stroke(g, 'M236 300 C230 380 222 460 214 548 M262 300 C266 380 270 460 276 552 M250 296 C250 380 248 470 250 556', 'rgba(120,100,60,.35)', 2.5);
    // gold hem and belt
    stroke(g, 'M162 556 C190 548 214 562 236 552 C258 564 280 548 304 558 C318 548 330 552 340 548', '#e2b04a', 6);
    g.fillStyle = lin(g, 0, 300, 0, 312, [[0, '#ffe39a'], [1, '#c78f24']]); g.fillRect(222, 300, 58, 11);
    // torso
    const torso = P('M222 262 C224 240 236 228 250 226 C264 228 278 240 280 262 L282 306 L220 306 Z');
    shapeFill(g, torso, ['#ffffff', '#e8dcc4'], 220, 226, 282, 306);
    // back arm (left, holding nothing), a sleeve
    const back = P('M226 252 C210 262 196 290 192 318 C190 330 198 334 204 326 C210 304 220 282 234 268 Z');
    shapeFill(g, back, ['#f4ecdc', '#c8b898'], 190, 250, 236, 334);
    ellipse(g, 196, 330, 8, 9); g.fillStyle = '#f2d6bc'; g.fill();
  }, { z: 2, anim: { breath: .012, speed: 1.6 } });
  // head with golden hair, facing right
  r.part('head', g => {
    // hair behind
    const hair = P('M228 196 C222 168 236 148 256 146 C278 146 292 162 290 186 C292 204 286 220 278 232 C272 236 262 236 256 232 L236 236 C226 226 224 210 228 196 Z');
    shapeFill(g, hair, ['#fff2b8', '#e8b440', '#a8701a'], 230, 146, 290, 236);
    // face
    const face = P('M244 174 C254 166 272 168 278 182 C282 190 284 200 280 208 C278 216 272 224 262 226 C252 226 244 218 242 206 C240 194 240 182 244 174 Z');
    shapeFill(g, face, ['#ffe6d0', '#f2c8a6'], 240, 168, 284, 226);
    // hair over the brow
    const fringe = P('M240 182 C244 164 262 156 278 164 C284 170 286 176 284 182 C276 174 264 172 252 178 C248 182 244 184 240 182 Z');
    shapeFill(g, fringe, ['#fff4c4', '#e9b848'], 240, 156, 286, 184);
    // eye, brow, mouth (calm)
    g.fillStyle = '#4a3a6a'; ellipse(g, 268, 196, 3.2, 2.2); g.fill();
    stroke(g, 'M262 189 C266 187 272 187 276 190', '#8a6a2a', 2);
    stroke(g, 'M266 214 C270 215 273 214 275 212', '#c47a6a', 2);
    // neck
    g.fillStyle = '#f0ccb0'; g.fillRect(250, 222, 14, 10);
  }, { z: 4, pivot: [256, 230], anim: { bob: 2, speed: 1.6, rot: .03 },
    glow: g => {
      // the halo
      g.save(); g.translate(258, 128); g.scale(1, .3);
      g.strokeStyle = 'rgba(255,236,170,.95)'; g.lineWidth = 9; g.shadowColor = '#ffe9a0'; g.shadowBlur = 24;
      g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.stroke();
      g.restore();
    } });
  // the front arm with a spear of light
  r.part('arm', g => {
    const arm = P('M270 252 C286 258 300 266 314 270 C324 272 330 266 326 258 C312 250 296 244 278 240 Z');
    shapeFill(g, arm, ['#ffffff', '#ddd0b4'], 270, 240, 330, 274);
    ellipse(g, 328, 264, 9, 8); g.fillStyle = '#f2d6bc'; g.fill();
    // the spear: a long shaft angled up-forward
    g.save(); g.translate(328, 262); g.rotate(-.42);
    g.fillStyle = lin(g, -120, 0, 150, 0, [[0, '#c8902a'], [.5, '#ffe9a6'], [1, '#c8902a']]); g.fillRect(-120, -3.5, 270, 7);
    const tip = P('M150 -12 L196 0 L150 12 L156 0 Z'); g.fillStyle = '#fffbe8'; g.fill(tip);
    g.restore();
  }, { z: 5, pivot: [276, 248], anim: { rot: .04, speed: 1.6, phase: 1 },
    glow: g => { g.save(); g.translate(328, 262); g.rotate(-.42); g.shadowColor = '#fff2b0'; g.shadowBlur = 22; g.fillStyle = 'rgba(255,245,200,.85)'; g.beginPath(); g.moveTo(150, -14); g.lineTo(204, 0); g.lineTo(150, 14); g.closePath(); g.fill(); g.restore(); } });
  r.feet = 560; r.top = 110; r.hover = true;
  return r;
}

/* ---------- imps: round, horned, small bat wings, a tail ---------- */
function imp(o) {
  const r = new Rig();
  const skin = o.skin ?? '#a8321e', skin2 = o.skin2 ?? '#4a0e08', belly = o.belly ?? 1, eye = o.eye ?? '#ffd23a';
  const cx = 256, hip = 420 - (belly - 1) * 20, top = 300 - (belly - 1) * 30;
  r.part('tail', g => {
    stroke(g, `M${cx + 30} ${hip} C${cx + 90} ${hip + 10} ${cx + 110} ${hip - 60} ${cx + 80} ${hip - 90}`, skin2, 9);
    const tip = P(`M${cx + 80} ${hip - 90} L${cx + 66} ${hip - 112} L${cx + 92} ${hip - 104} Z`); g.fillStyle = skin2; g.fill(tip);
  }, { pivot: [cx + 30, hip], z: 0, anim: { rot: .18, speed: 2.3 } });
  if (o.wings !== false) {
    r.part('wingL', g => batWing(g, cx - 20, top + 20, 120 * (o.wingSize ?? 1), 1, mixc(skin2, '#000000', .2), skin, -1, o.tatter ?? 0), { pivot: [cx - 20, top + 20], z: 1, anim: { rot: -.25, speed: 6 } });
    r.part('wingR', g => batWing(g, cx + 20, top + 20, 105 * (o.wingSize ?? 1), 1, mixc(skin2, '#000000', .35), skin2, 1, o.tatter ?? 0), { pivot: [cx + 20, top + 20], z: 1, anim: { rot: .25, speed: 6, phase: .1 } });
  }
  r.part('body', g => {
    // legs, bent
    for (const s of [-1, 1]) {
      const leg = P(`M${cx + s * 22} ${hip - 10} C${cx + s * 46} ${hip + 10} ${cx + s * 40} ${hip + 40} ${cx + s * 30} ${hip + 58} L${cx + s * 46} ${FY} L${cx + s * 18} ${FY} C${cx + s * 22} ${hip + 50} ${cx + s * 10} ${hip + 20} ${cx + s * 6} ${hip}`);
      shapeFill(g, leg, [skin, skin2], 0, hip, 0, FY);
    }
    // the round body
    const bw = 62 * belly, bh = 74 * (1 + (belly - 1) * .6);
    ellipse(g, cx, hip - bh * .6, bw, bh); g.fillStyle = rad(g, cx - bw * .4, hip - bh, 8, bw * 1.6, [[0, mixc(skin, '#ffffff', .15)], [.6, skin], [1, skin2]]); g.fill();
    // belly
    ellipse(g, cx + 8, hip - bh * .45, bw * .62, bh * .6); g.fillStyle = rgba(mixc(skin, '#ffd0a0', .35), .5); g.fill();
    if (o.coins) { g.fillStyle = lin(g, cx - 70, hip - 30, cx - 20, hip + 30, [[0, '#ffe08a'], [1, '#a8700a']]); ellipse(g, cx - 54, hip - 4, 30, 34); g.fill(); stroke(g, `M${cx - 74} ${hip - 32} C${cx - 60} ${hip - 44} ${cx - 44} ${hip - 44} ${cx - 34} ${hip - 32}`, '#7a5008', 4); }
  }, { z: 2, anim: { breath: .03, speed: 2.4 } });
  r.part('arm', g => {
    const ax = cx + 40, ay = top + 40;
    const arm = P(`M${ax - 6} ${ay} C${ax + 30} ${ay + 10} ${ax + 50} ${ay + 40} ${ax + 58} ${ay + 70} L${ax + 44} ${ay + 76} C${ax + 34} ${ay + 50} ${ax + 20} ${ay + 30} ${ax - 10} ${ay + 20} Z`);
    shapeFill(g, arm, [skin, skin2], ax, ay, ax + 60, ay + 80);
    for (let i = 0; i < 3; i++) stroke(g, `M${ax + 48 + i * 5} ${ay + 74} L${ax + 52 + i * 7} ${ay + 92}`, '#1a0806', 4);
    if (o.hook) { stroke(g, `M${ax + 54} ${ay + 80} L${ax + 100} ${ay - 70}`, '#3a2a20', 7); stroke(g, `M${ax + 100} ${ay - 70} C${ax + 130} ${ay - 80} ${ax + 132} ${ay - 40} ${ax + 112} ${ay - 36}`, '#9aa0a8', 6); }
    if (o.fork) { stroke(g, `M${ax + 54} ${ay + 80} L${ax + 104} ${ay - 60}`, '#2a1a10', 6); stroke(g, `M${ax + 92} ${ay - 70} L${ax + 104} ${ay - 60} L${ax + 118} ${ay - 66} M${ax + 104} ${ay - 60} L${ax + 112} ${ay - 82}`, '#c0c4c8', 4); }
  }, { z: 3, pivot: [cx + 36, top + 40], anim: { rot: .06, speed: 2.4, phase: 1 } });
  r.part('head', g => {
    const hy = top - 16, hr = 52 * (o.head ?? 1);
    // horns
    for (const s of [-1, 1]) {
      const h = P(`M${cx + s * 22} ${hy - hr * .55} C${cx + s * 34} ${hy - hr * 1.2} ${cx + s * 56} ${hy - hr * 1.5} ${cx + s * 74} ${hy - hr * 1.4} C${cx + s * 54} ${hy - hr * 1.2} ${cx + s * 44} ${hy - hr * .8} ${cx + s * 40} ${hy - hr * .4} Z`);
      shapeFill(g, h, ['#f2e2c4', o.hornCol ?? '#5a4636'], 0, hy - hr * 1.5, 0, hy);
    }
    // ears
    for (const s of [-1, 1]) { const e = P(`M${cx + s * hr * .8} ${hy - 4} L${cx + s * hr * 1.5} ${hy - 26} L${cx + s * hr * .9} ${hy + 14} Z`); shapeFill(g, e, [skin, skin2], 0, hy - 30, 0, hy + 14); }
    ellipse(g, cx, hy, hr, hr * .92); g.fillStyle = rad(g, cx - hr * .35, hy - hr * .5, 4, hr * 1.4, [[0, mixc(skin, '#ffffff', .18)], [.6, skin], [1, skin2]]); g.fill();
    // brow, mouth with teeth
    stroke(g, `M${cx - 36} ${hy - 16} L${cx - 8} ${hy - 6} M${cx + 36} ${hy - 16} L${cx + 8} ${hy - 6}`, skin2, 6);
    const m = P(`M${cx - 30} ${hy + 18} C${cx - 10} ${hy + 36} ${cx + 10} ${hy + 36} ${cx + 30} ${hy + 18} C${cx + 10} ${hy + 26} ${cx - 10} ${hy + 26} ${cx - 30} ${hy + 18} Z`);
    g.fillStyle = '#1a0204'; g.fill(m);
    g.fillStyle = '#fff4e0'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * 10 - 4, hy + 23); g.lineTo(cx + i * 10, hy + 31); g.lineTo(cx + i * 10 + 4, hy + 23); g.fill(); }
    ellipse(g, cx - 18, hy - 2, 9, 7); g.fillStyle = '#1a0204'; g.fill(); ellipse(g, cx + 18, hy - 2, 9, 7); g.fill();
  }, { z: 4, pivot: [cx, top + 20], anim: { bob: 3, speed: 2.4, rot: .05 },
    glow: g => { const hy = top - 16; glowDot(g, cx - 18, hy - 2, 5, eye); glowDot(g, cx + 18, hy - 2, 5, eye); if (o.flame) for (let i = 0; i < 3; i++) glowDot(g, cx - 20 + i * 20, hy - 60 - i % 2 * 10, 6, '#ff7a2a', '#ffe0a0'); } });
  r.feet = FY; r.top = top - 100;
  return r;
}

/* ---------- wraiths: a hood and a tattered cloak, no legs ---------- */
function wraith(o) {
  const r = new Rig();
  const col = o.col ?? '#3a4050', col2 = o.col2 ?? '#0a0c12', eye = o.eye ?? '#a8e0ff', cx = 256, s = o.size ?? 1;
  const top = 496 - 400 * s;
  r.part('cloak', g => {
    const p = new Path2D();
    p.moveTo(cx - 60 * s, top + 120 * s);
    p.bezierCurveTo(cx - 110 * s, top + 220 * s, cx - 120 * s, top + 330 * s, cx - 90 * s, top + 390 * s);
    const rr = rand(o.seed ?? 3);
    for (let i = 0; i <= 8; i++) { const x = cx - 90 * s + i * 22 * s, y = top + (380 + (i % 2 ? -30 : 20) + rr() * 30) * s; p.lineTo(x, y); }
    p.bezierCurveTo(cx + 110 * s, top + 300 * s, cx + 90 * s, top + 200 * s, cx + 60 * s, top + 120 * s);
    p.closePath();
    g.fillStyle = lin(g, 0, top + 100 * s, 0, top + 420 * s, [[0, col], [.6, mixc(col, col2, .6)], [1, rgba(col2, .1)]]); g.fill(p);
    for (let i = 0; i < 6; i++) stroke(g, `M${cx - 50 * s + i * 20 * s} ${top + 150 * s} C${cx - 60 * s + i * 24 * s} ${top + 250 * s} ${cx - 70 * s + i * 28 * s} ${top + 320 * s} ${cx - 80 * s + i * 32 * s} ${top + 380 * s}`, rgba(col2, .5), 3);
  }, { z: 0, pivot: [cx, top + 120 * s], anim: { rot: .04, speed: 1.3, sway: 6 } });
  r.part('arms', g => {
    for (const sd of [-1, 1]) {
      const ax = cx + sd * 58 * s, ay = top + 150 * s;
      const a = P(`M${ax} ${ay} C${ax + sd * 40 * s} ${ay + 40 * s} ${ax + sd * 70 * s} ${ay + 40 * s} ${ax + sd * 100 * s} ${ay + 20 * s} L${ax + sd * 96 * s} ${ay + 36 * s} C${ax + sd * 60 * s} ${ay + 60 * s} ${ax + sd * 30 * s} ${ay + 60 * s} ${ax - sd * 6 * s} ${ay + 40 * s} Z`);
      shapeFill(g, a, [col, col2], 0, ay, 0, ay + 60 * s);
      for (let i = 0; i < 4; i++) stroke(g, `M${ax + sd * 98 * s} ${ay + 26 * s} L${ax + sd * (118 + i * 3) * s} ${ay + (10 + i * 10) * s}`, o.claw ?? '#c8d0dc', 3);
    }
  }, { z: 1, pivot: [cx, top + 150 * s], anim: { rot: .05, speed: 1.3, phase: 1.3 } });
  r.part('hood', g => {
    const h = P(`M${cx} ${top} C${cx + 60 * s} ${top} ${cx + 80 * s} ${top + 60 * s} ${cx + 78 * s} ${top + 120 * s} C${cx + 70 * s} ${top + 160 * s} ${cx - 70 * s} ${top + 160 * s} ${cx - 78 * s} ${top + 120 * s} C${cx - 80 * s} ${top + 60 * s} ${cx - 60 * s} ${top} ${cx} ${top} Z`);
    shapeFill(g, h, [mixc(col, '#ffffff', .12), col, col2], 0, top, 0, top + 160 * s);
    ellipse(g, cx, top + 86 * s, 40 * s, 50 * s); g.fillStyle = '#020204'; g.fill();
    if (o.ice) { g.fillStyle = 'rgba(220,245,255,.85)'; for (let i = 0; i < 5; i++) { const x = cx - 60 * s + i * 30 * s; g.beginPath(); g.moveTo(x - 6, top + 20 * s + (i % 2) * 10); g.lineTo(x, top - 30 * s - (i % 2) * 20); g.lineTo(x + 6, top + 20 * s + (i % 2) * 10); g.fill(); } }
  }, { z: 2, pivot: [cx, top + 140 * s], anim: { bob: 4, speed: 1.3, rot: .04 },
    glow: g => { glowDot(g, cx - 15 * s, top + 84 * s, 6 * s, eye); glowDot(g, cx + 15 * s, top + 84 * s, 6 * s, eye); } });
  r.feet = FY; r.top = top; r.hover = true;
  return r;
}

/* ---------- humanoids: most demons ---------- */
function humanoid(o) {
  const r = new Rig({ frameH: o.frameH ?? FH });
  const H = r.frameH, feet = H - 16;
  const skin = o.skin ?? '#8a2a20', skin2 = o.skin2 ?? '#2a0806', cx = 256;
  const tall = o.tall ?? 1;                       // height scale
  const sh = feet - 300 * tall;                   // shoulder line
  const hip = feet - 150 * tall;
  const bw = (o.bulk ?? 1) * 52;                  // half the chest width
  const eye = o.eye ?? '#ffcf3a';
  // wings behind
  if (o.wings === 'bat') {
    r.part('wingL', g => batWing(g, cx - 20, sh + 10, 190 * (o.wingSize ?? 1), 1.05, o.wingCol ?? mixc(skin2, '#000000', .2), o.wingCol2 ?? skin, -1, o.tatter ?? 0), { pivot: [cx - 20, sh + 10], z: 0, anim: { rot: -.12, speed: 2.2 } });
    r.part('wingR', g => batWing(g, cx + 20, sh + 10, 170 * (o.wingSize ?? 1), 1.05, o.wingCol ?? mixc(skin2, '#000000', .35), o.wingCol2 ?? skin2, 1, o.tatter ?? 0), { pivot: [cx + 20, sh + 10], z: 0, anim: { rot: .12, speed: 2.2, phase: .15 } });
  } else if (o.wings === 'feather') {
    r.part('wingL', g => featherWing(g, cx - 16, sh + 10, 200 * (o.wingSize ?? 1), o.wingCol ?? '#1a1420', o.wingCol2 ?? '#000000', -1, 3, true), { pivot: [cx - 16, sh + 10], z: 0, anim: { rot: -.08, speed: 1.4 } });
    r.part('wingR', g => featherWing(g, cx + 16, sh + 10, 180 * (o.wingSize ?? 1), o.wingCol ?? '#1a1420', o.wingCol2 ?? '#000000', 1, 3, true), { pivot: [cx + 16, sh + 10], z: 0, anim: { rot: .08, speed: 1.4, phase: .2 } });
  }
  if (o.tail) r.part('tail', g => {
    stroke(g, `M${cx + 10} ${hip} C${cx + 90} ${hip + 40} ${cx + 140} ${hip - 20} ${cx + 120} ${hip - 90}`, skin2, 12);
    const tip = P(`M${cx + 120} ${hip - 90} L${cx + 104} ${hip - 118} L${cx + 136} ${hip - 108} Z`); g.fillStyle = skin2; g.fill(tip);
  }, { pivot: [cx + 10, hip], z: .5, anim: { rot: .12, speed: 1.8 } });
  // the lower body
  r.part('body', g => {
    if (o.lower === 'serpent') {
      const p = P(`M${cx - 40} ${hip - 20} C${cx - 60} ${hip + 60} ${cx + 80} ${feet - 70} ${cx + 120} ${feet - 30} C${cx + 160} ${feet} ${cx + 60} ${feet + 6} ${cx - 40} ${feet} C${cx - 140} ${feet - 6} ${cx - 160} ${feet - 50} ${cx - 120} ${feet - 70} C${cx - 90} ${feet - 90} ${cx - 50} ${feet - 30} ${cx - 10} ${feet - 50} C${cx + 20} ${feet - 70} ${cx + 30} ${hip + 40} ${cx + 40} ${hip - 20} Z`);
      shapeFill(g, p, [o.tailCol ?? '#3a5a2a', o.tailCol2 ?? '#0e1a08'], 0, hip, 0, feet);
      for (let i = 0; i < 9; i++) stroke(g, `M${cx - 120 + i * 28} ${feet - 40 + Math.sin(i) * 10} l12 8`, 'rgba(0,0,0,.35)', 3);
    } else if (o.lower === 'robe' || o.lower === 'ice') {
      const p = P(`M${cx - bw} ${sh + 40} C${cx - bw - 30} ${hip + 40} ${cx - bw - 50} ${feet - 40} ${cx - bw - 56} ${feet} L${cx + bw + 56} ${feet} C${cx + bw + 50} ${feet - 40} ${cx + bw + 30} ${hip + 40} ${cx + bw} ${sh + 40} Z`);
      shapeFill(g, p, [o.robe ?? '#2a1a2a', o.robe2 ?? '#0a050a'], 0, sh, 0, feet);
      for (let i = 0; i < 5; i++) stroke(g, `M${cx - bw + i * bw * .5} ${sh + 70} C${cx - bw - 10 + i * bw * .55} ${hip + 60} ${cx - bw - 30 + i * bw * .6} ${feet - 60} ${cx - bw - 40 + i * bw * .65} ${feet}`, 'rgba(0,0,0,.35)', 3);
      if (o.trim) stroke(g, `M${cx - bw - 56} ${feet - 4} L${cx + bw + 56} ${feet - 4}`, o.trim, 6);
      if (o.lower === 'ice') {
        const ice = P(`M${cx - 170} ${feet} L${cx - 150} ${hip - 10} L${cx - 110} ${hip - 60} L${cx - 60} ${sh + 120} L${cx} ${sh + 90} L${cx + 60} ${sh + 130} L${cx + 120} ${hip - 50} L${cx + 160} ${hip} L${cx + 176} ${feet} Z`);
        g.fillStyle = lin(g, 0, sh, 0, feet, [[0, 'rgba(220,245,255,.75)'], [1, 'rgba(120,180,220,.9)']]); g.fill(ice);
        stroke(g, `M${cx - 120} ${feet - 30} L${cx - 60} ${hip} L${cx - 20} ${hip + 60} M${cx + 100} ${feet - 20} L${cx + 60} ${hip + 10}`, 'rgba(255,255,255,.7)', 2.5);
      }
    } else if (o.lower === 'horse') {
      const hb = P(`M${cx - 30} ${hip - 30} C${cx - 10} ${hip - 60} ${cx + 160} ${hip - 60} ${cx + 180} ${hip - 10} C${cx + 190} ${hip + 30} ${cx + 170} ${hip + 60} ${cx + 140} ${hip + 60} L${cx - 20} ${hip + 60} C${cx - 50} ${hip + 50} ${cx - 50} ${hip} ${cx - 30} ${hip - 30} Z`);
      shapeFill(g, hb, [o.hide ?? '#5a3a24', o.hide2 ?? '#1a0e08'], 0, hip - 60, 0, hip + 60);
      for (const lx of [cx - 20, cx + 10, cx + 130, cx + 160]) { const l = P(`M${lx - 10} ${hip + 40} L${lx + 10} ${hip + 40} L${lx + 8} ${feet - 14} L${lx + 14} ${feet} L${lx - 8} ${feet} L${lx - 8} ${feet - 14} Z`); shapeFill(g, l, [o.hide ?? '#5a3a24', '#140a04'], 0, hip, 0, feet); }
      stroke(g, `M${cx + 180} ${hip - 10} C${cx + 210} ${hip + 10} ${cx + 214} ${hip + 70} ${cx + 200} ${hip + 100}`, '#1a0e08', 10);
    } else if (o.lower === 'bird') {
      for (const s of [-1, 1]) { stroke(g, `M${cx + s * 20} ${hip} L${cx + s * 30} ${hip + 70} L${cx + s * 16} ${feet - 10}`, '#c8a060', 8); stroke(g, `M${cx + s * 16} ${feet - 10} l${-14} 10 M${cx + s * 16} ${feet - 10} l14 10 M${cx + s * 16} ${feet - 10} l0 12`, '#3a2a1a', 5); }
      const fl = P(`M${cx - bw} ${sh + 60} C${cx - bw - 20} ${hip} ${cx - 20} ${hip + 40} ${cx} ${hip + 50} C${cx + 20} ${hip + 40} ${cx + bw + 20} ${hip} ${cx + bw} ${sh + 60} Z`);
      shapeFill(g, fl, [o.feather ?? '#5a4a3a', '#1a120a'], 0, sh, 0, hip + 50);
    } else {
      // legs: digitigrade for demons, straight for the human ones
      for (const s of [-1, 1]) {
        const lw = 20 * (o.bulk ?? 1);
        const leg = o.hoof !== false
          ? P(`M${cx + s * 16} ${hip - 10} C${cx + s * (36 + lw)} ${hip + 30} ${cx + s * (40 + lw)} ${hip + 70} ${cx + s * 30} ${hip + 90} C${cx + s * 40} ${hip + 110} ${cx + s * 44} ${feet - 20} ${cx + s * 46} ${feet} L${cx + s * 22} ${feet} C${cx + s * 20} ${feet - 30} ${cx + s * 16} ${hip + 110} ${cx + s * 10} ${hip + 90} C${cx + s * 4} ${hip + 60} ${cx} ${hip + 20} ${cx} ${hip}`)
          : P(`M${cx + s * 6} ${hip - 6} L${cx + s * (24 + lw)} ${hip - 6} L${cx + s * (22 + lw * .6)} ${feet} L${cx + s * 8} ${feet} Z`);
        shapeFill(g, leg, [o.legCol ?? skin, skin2], 0, hip, 0, feet);
      }
      if (o.loin) { const l = P(`M${cx - bw * .9} ${hip - 14} L${cx + bw * .9} ${hip - 14} L${cx + bw * .6} ${hip + 50} L${cx} ${hip + 70} L${cx - bw * .6} ${hip + 50} Z`); shapeFill(g, l, [o.loin, mixc(o.loin, '#000000', .6)], 0, hip, 0, hip + 70); }
    }
    // the torso
    if (o.lower !== 'robe' && o.lower !== 'ice') {
      const t = P(`M${cx - bw} ${sh} C${cx - bw - 10} ${sh + 60} ${cx - bw * .7} ${hip - 30} ${cx - bw * .55} ${hip} L${cx + bw * .55} ${hip} C${cx + bw * .7} ${hip - 30} ${cx + bw + 10} ${sh + 60} ${cx + bw} ${sh} C${cx + bw * .5} ${sh - 16} ${cx - bw * .5} ${sh - 16} ${cx - bw} ${sh} Z`);
      g.fillStyle = rad(g, cx - bw * .4, sh + 30, 6, bw * 2.4, [[0, mixc(skin, '#ffffff', .12)], [.55, skin], [1, skin2]]); g.fill(t);
      if (o.muscles !== false) stroke(g, `M${cx} ${sh + 10} L${cx} ${hip - 10} M${cx - bw * .55} ${sh + 46} C${cx - 16} ${sh + 60} ${cx + 16} ${sh + 60} ${cx + bw * .55} ${sh + 46} M${cx - 20} ${sh + 90} L${cx + 20} ${sh + 90} M${cx - 18} ${sh + 120} L${cx + 18} ${sh + 120}`, rgba(skin2, .55), 3);
      if (o.chest) stroke(g, o.chest(cx, sh, hip, bw), o.chestCol ?? '#c8a04a', 5);
    } else {
      const t = P(`M${cx - bw} ${sh} C${cx - bw * .5} ${sh - 14} ${cx + bw * .5} ${sh - 14} ${cx + bw} ${sh} L${cx + bw + 6} ${sh + 70} L${cx - bw - 6} ${sh + 70} Z`);
      shapeFill(g, t, [o.robe ?? '#2a1a2a', o.robe2 ?? '#0a050a'], 0, sh, 0, sh + 70);
      if (o.trim) stroke(g, `M${cx - 10} ${sh - 8} L${cx - 26} ${sh + 70} M${cx + 10} ${sh - 8} L${cx + 26} ${sh + 70}`, o.trim, 5);
    }
    // the back arm
    const ba = P(`M${cx - bw + 6} ${sh + 6} C${cx - bw - 30} ${sh + 30} ${cx - bw - 40} ${sh + 90} ${cx - bw - 34} ${sh + 140} L${cx - bw - 14} ${sh + 142} C${cx - bw - 14} ${sh + 100} ${cx - bw - 8} ${sh + 50} ${cx - bw + 18} ${sh + 30} Z`);
    shapeFill(g, ba, [o.sleeve ?? skin, skin2], 0, sh, 0, sh + 150);
    ellipse(g, cx - bw - 24, sh + 150, 13, 15); g.fillStyle = o.handCol ?? skin; g.fill();
    if (o.collar) { const c = P(`M${cx - bw - 4} ${sh - 6} C${cx - 20} ${sh + 26} ${cx + 20} ${sh + 26} ${cx + bw + 4} ${sh - 6} L${cx + bw} ${sh + 12} C${cx + 20} ${sh + 40} ${cx - 20} ${sh + 40} ${cx - bw} ${sh + 12} Z`); shapeFill(g, c, [o.collar, mixc(o.collar, '#000000', .5)], 0, sh, 0, sh + 40); }
  }, { z: 1, anim: { breath: .015, speed: 1.6 } });
  // the front arm, with whatever it holds
  r.part('arm', g => {
    const ax = cx + bw - 6, ay = sh + 6;
    const a = P(`M${ax} ${ay} C${ax + 36} ${ay + 20} ${ax + 52} ${ay + 70} ${ax + 70} ${ay + 110} L${ax + 52} ${ay + 120} C${ax + 34} ${ay + 84} ${ax + 14} ${ay + 50} ${ax - 18} ${ay + 30} Z`);
    shapeFill(g, a, [o.sleeve ?? skin, skin2], 0, ay, 0, ay + 120);
    ellipse(g, ax + 62, ay + 122, 14, 15); g.fillStyle = o.handCol ?? skin; g.fill();
    const hx = ax + 62, hy = ay + 122;
    if (o.claws !== false && !o.weapon) for (let i = 0; i < 4; i++) stroke(g, `M${hx - 8 + i * 6} ${hy + 10} l${2 + i * 2} 16`, '#14080a', 3.5);
    if (o.weapon === 'whip') { stroke(g, `M${hx} ${hy} C${hx + 60} ${hy + 40} ${hx + 90} ${hy - 30} ${hx + 140} ${hy + 10} C${hx + 170} ${hy + 30} ${hx + 180} ${hy + 80} ${hx + 160} ${hy + 110}`, o.whipCol ?? '#2a4a20', 7); }
    if (o.weapon === 'trident') { stroke(g, `M${hx - 30} ${hy + 140} L${hx + 50} ${hy - 160}`, '#2a1a10', 8); stroke(g, `M${hx + 26} ${hy - 170} L${hx + 50} ${hy - 160} L${hx + 76} ${hy - 150} M${hx + 50} ${hy - 160} L${hx + 58} ${hy - 200} M${hx + 26} ${hy - 170} L${hx + 30} ${hy - 196} M${hx + 76} ${hy - 150} L${hx + 86} ${hy - 176}`, '#b8bcc4', 6); }
    if (o.weapon === 'oar') { stroke(g, `M${hx - 60} ${hy - 160} L${hx + 40} ${hy + 150}`, '#3a2414', 9); const b = P(`M${hx + 28} ${hy + 120} L${hx + 60} ${hy + 110} L${hx + 76} ${hy + 200} L${hx + 50} ${hy + 210} Z`); shapeFill(g, b, ['#5a3a20', '#1a0e06'], 0, hy + 100, 0, hy + 210); }
    if (o.weapon === 'staff') { stroke(g, `M${hx} ${hy + 150} L${hx + 10} ${hy - 200}`, '#1a1012', 7); }
    if (o.weapon === 'axe') { stroke(g, `M${hx - 20} ${hy + 120} L${hx + 40} ${hy - 150}`, '#2a1a10', 10); const b = P(`M${hx + 30} ${hy - 130} C${hx + 90} ${hy - 170} ${hx + 120} ${hy - 110} ${hx + 100} ${hy - 60} C${hx + 80} ${hy - 90} ${hx + 50} ${hy - 90} ${hx + 26} ${hy - 96} Z`); shapeFill(g, b, ['#d0d4dc', '#5a5e68'], hx, hy - 170, hx + 110, hy - 60); }
    if (o.weapon === 'scale') { stroke(g, `M${hx} ${hy} L${hx} ${hy - 100}`, '#c8a04a', 5); stroke(g, `M${hx - 50} ${hy - 96} L${hx + 50} ${hy - 104}`, '#c8a04a', 5); for (const s of [-1, 1]) { stroke(g, `M${hx + s * 50} ${hy - 100} l${-12} 40 M${hx + s * 50} ${hy - 100} l12 40`, '#c8a04a', 2); ellipse(g, hx + s * 50, hy - 58, 20, 6); g.fillStyle = '#c8a04a'; g.fill(); } }
    if (o.weapon === 'horn') { const b = P(`M${hx} ${hy} C${hx + 30} ${hy - 30} ${hx + 70} ${hy - 40} ${hx + 100} ${hy - 80} C${hx + 110} ${hy - 60} ${hx + 110} ${hy - 30} ${hx + 96} ${hy - 20} C${hx + 70} ${hy - 6} ${hx + 30} ${hy + 10} ${hx} ${hy + 14} Z`); shapeFill(g, b, ['#e8dcc0', '#7a6a50'], hx, hy - 80, hx + 110, hy + 14); }
    if (o.weapon === 'sword') { stroke(g, `M${hx - 10} ${hy + 20} L${hx + 70} ${hy - 160}`, '#2a2a32', 12); stroke(g, `M${hx - 10} ${hy + 20} L${hx + 70} ${hy - 160}`, '#8a8e98', 6); }
    if (o.weapon === 'coins') { for (let i = 0; i < 5; i++) { ellipse(g, hx + 10 + i * 4, hy + 4 - i * 8, 16, 6); g.fillStyle = i % 2 ? '#ffd86a' : '#d8a434'; g.fill(); } }
  }, { z: 3, pivot: [cx + bw - 6, sh + 6], anim: { rot: .05, speed: 1.6, phase: 1.2 },
    glow: o.weaponGlow ? g => o.weaponGlow(g, cx + bw + 56, sh + 128) : null });
  // the head
  r.part('head', g => {
    const hy = sh - 46 * (o.headSize ?? 1), hs = o.headSize ?? 1;
    drawHead(g, cx, hy, hs, o);
  }, { z: 4, pivot: [cx, sh - 6], anim: { bob: 2.5, speed: 1.6, rot: .035 },
    glow: g => { const hs = o.headSize ?? 1, hy = sh - 46 * hs; if (o.faces === 3) { for (const dx of [-62, 0, 62]) { glowDot(g, cx + dx - 10 * hs, hy - 4 * hs, 4.5 * hs, eye); glowDot(g, cx + dx + 10 * hs, hy - 4 * hs, 4.5 * hs, eye); } } else { glowDot(g, cx - 13 * hs, hy - 4 * hs, 4.5 * hs, eye); glowDot(g, cx + 13 * hs, hy - 4 * hs, 4.5 * hs, eye); }
      if (o.halo === 'broken') { g.save(); g.translate(cx, hy - 66 * hs); g.scale(1, .3); g.strokeStyle = 'rgba(200,170,255,.8)'; g.lineWidth = 8; g.shadowColor = '#b090ff'; g.shadowBlur = 18; g.beginPath(); g.arc(0, 0, 40 * hs, .3, 2.6); g.stroke(); g.beginPath(); g.arc(0, 0, 40 * hs, 3.1, 5.6); g.stroke(); g.restore(); }
      if (o.flames) for (let i = 0; i < 5; i++) glowDot(g, cx - 40 + i * 20, hy - 70 * hs - (i % 2) * 14, 7, '#ff7a2a', '#ffe0a0');
      if (o.headGlow) o.headGlow(g, cx, hy, hs); } });
  r.feet = feet; r.top = sh - 140 * (o.headSize ?? 1);
  r.hover = !!o.hover;
  return r;
}
function drawHead(g, cx, hy, hs, o) {
  const skin = o.skin ?? '#8a2a20', skin2 = o.skin2 ?? '#2a0806', kind = o.head ?? 'demon';
  if (o.faces === 3) {
    // three faces on one head: red, pale yellow and black, as Dante saw him
    const cols = [['#2a0a0a', '#000000'], ['#c81e14', '#4a0606'], ['#d8c87a', '#5a4a1a']];
    [-62, 62, 0].forEach((dx, i) => { const [a, b] = cols[i === 0 ? 0 : i === 1 ? 2 : 1]; drawHead(g, cx + dx, hy + (dx ? 10 : 0), hs * (dx ? .82 : 1), { ...o, faces: 1, skin: a, skin2: b }); });
    return;
  }
  // horns behind
  if (o.horns === 'curl' || o.horns === 'big') {
    for (const s of [-1, 1]) { const k = o.horns === 'big' ? 1.6 : 1; const h = P(`M${cx + s * 18 * hs} ${hy - 30 * hs} C${cx + s * 40 * hs} ${hy - 80 * hs * k} ${cx + s * 90 * hs * k} ${hy - 90 * hs * k} ${cx + s * 100 * hs * k} ${hy - 50 * hs * k} C${cx + s * 80 * hs * k} ${hy - 66 * hs * k} ${cx + s * 50 * hs} ${hy - 60 * hs} ${cx + s * 36 * hs} ${hy - 20 * hs} Z`); shapeFill(g, h, ['#efe0c4', o.hornCol ?? '#3a2a20'], 0, hy - 100 * hs * k, 0, hy); }
  } else if (o.horns === 'straight') {
    for (const s of [-1, 1]) { const h = P(`M${cx + s * 14 * hs} ${hy - 30 * hs} L${cx + s * 30 * hs} ${hy - 96 * hs} L${cx + s * 32 * hs} ${hy - 26 * hs} Z`); shapeFill(g, h, ['#efe0c4', '#2a1a14'], 0, hy - 96 * hs, 0, hy); }
  } else if (o.horns === 'ram') {
    for (const s of [-1, 1]) { g.save(); g.translate(cx + s * 34 * hs, hy - 18 * hs); g.scale(s, 1); const h = P(`M0 -10 C30 -40 60 -10 50 20 C42 40 16 36 14 18 C12 6 26 2 30 12 C26 -6 10 -10 0 6 Z`); g.scale(hs, hs); shapeFill(g, h, ['#d8c8a8', '#5a4a36'], 0, -40, 0, 40); g.restore(); }
  }
  // hair
  if (o.hair === 'long') { const h = P(`M${cx - 36 * hs} ${hy - 30 * hs} C${cx - 52 * hs} ${hy + 10 * hs} ${cx - 40 * hs} ${hy + 50 * hs} ${cx - 50 * hs} ${hy + 86 * hs} C${cx - 30 * hs} ${hy + 80 * hs} ${cx - 22 * hs} ${hy + 60 * hs} ${cx - 18 * hs} ${hy + 40 * hs} L${cx + 18 * hs} ${hy + 40 * hs} C${cx + 22 * hs} ${hy + 60 * hs} ${cx + 30 * hs} ${hy + 80 * hs} ${cx + 50 * hs} ${hy + 86 * hs} C${cx + 40 * hs} ${hy + 50 * hs} ${cx + 52 * hs} ${hy + 10 * hs} ${cx + 36 * hs} ${hy - 30 * hs} C${cx + 24 * hs} ${hy - 56 * hs} ${cx - 24 * hs} ${hy - 56 * hs} ${cx - 36 * hs} ${hy - 30 * hs} Z`); shapeFill(g, h, [mixc(o.hairCol ?? '#1a0a14', '#ffffff', .15), o.hairCol ?? '#1a0a14', mixc(o.hairCol ?? '#1a0a14', '#000000', .5)], 0, hy - 50 * hs, 0, hy + 90 * hs); }
  if (o.hair === 'snakes') { for (let i = 0; i < 9; i++) { const a = -Math.PI + i * Math.PI / 8; const x0 = cx + Math.cos(a) * 30 * hs, y0 = hy - 10 * hs + Math.sin(a) * 30 * hs; stroke(g, `M${x0} ${y0} C${x0 + Math.cos(a) * 30 * hs} ${y0 + Math.sin(a) * 20 * hs - 20} ${x0 + Math.cos(a) * 50 * hs + 10} ${y0 + Math.sin(a) * 50 * hs} ${x0 + Math.cos(a) * 64 * hs} ${y0 + Math.sin(a) * 40 * hs - 10}`, '#2a5a20', 8 * hs); ellipse(g, x0 + Math.cos(a) * 64 * hs, y0 + Math.sin(a) * 40 * hs - 10, 7 * hs, 5 * hs); g.fillStyle = '#3a7a2a'; g.fill(); } }
  if (kind === 'bull') {
    const h = P(`M${cx - 36 * hs} ${hy - 20 * hs} C${cx - 40 * hs} ${hy + 20 * hs} ${cx - 26 * hs} ${hy + 50 * hs} ${cx - 16 * hs} ${hy + 60 * hs} L${cx + 16 * hs} ${hy + 60 * hs} C${cx + 26 * hs} ${hy + 50 * hs} ${cx + 40 * hs} ${hy + 20 * hs} ${cx + 36 * hs} ${hy - 20 * hs} C${cx + 20 * hs} ${hy - 44 * hs} ${cx - 20 * hs} ${hy - 44 * hs} ${cx - 36 * hs} ${hy - 20 * hs} Z`);
    g.fillStyle = rad(g, cx - 10 * hs, hy - 20 * hs, 4, 60 * hs, [[0, mixc(skin, '#ffffff', .1)], [1, skin2]]); g.fill(h);
    ellipse(g, cx, hy + 46 * hs, 22 * hs, 14 * hs); g.fillStyle = mixc(skin, '#000000', .4); g.fill();
    g.fillStyle = '#000'; ellipse(g, cx - 8 * hs, hy + 46 * hs, 3 * hs, 4 * hs); g.fill(); ellipse(g, cx + 8 * hs, hy + 46 * hs, 3 * hs, 4 * hs); g.fill();
    stroke(g, `M${cx - 8 * hs} ${hy + 56 * hs} C${cx - 4 * hs} ${hy + 64 * hs} ${cx + 4 * hs} ${hy + 64 * hs} ${cx + 8 * hs} ${hy + 56 * hs}`, '#d8c070', 3);
    for (const s of [-1, 1]) { const hn = P(`M${cx + s * 30 * hs} ${hy - 22 * hs} C${cx + s * 70 * hs} ${hy - 30 * hs} ${cx + s * 90 * hs} ${hy - 60 * hs} ${cx + s * 86 * hs} ${hy - 96 * hs} C${cx + s * 76 * hs} ${hy - 66 * hs} ${cx + s * 56 * hs} ${hy - 50 * hs} ${cx + s * 32 * hs} ${hy - 6 * hs} Z`); shapeFill(g, hn, ['#f4ead4', '#6a5a40'], 0, hy - 96 * hs, 0, hy); }
    return;
  }
  if (kind === 'wolf') {
    const h = P(`M${cx - 36 * hs} ${hy - 30 * hs} L${cx - 30 * hs} ${hy - 70 * hs} L${cx - 10 * hs} ${hy - 40 * hs} L${cx + 10 * hs} ${hy - 40 * hs} L${cx + 30 * hs} ${hy - 70 * hs} L${cx + 36 * hs} ${hy - 30 * hs} C${cx + 44 * hs} ${hy} ${cx + 30 * hs} ${hy + 30 * hs} ${cx + 12 * hs} ${hy + 60 * hs} L${cx - 12 * hs} ${hy + 60 * hs} C${cx - 30 * hs} ${hy + 30 * hs} ${cx - 44 * hs} ${hy} ${cx - 36 * hs} ${hy - 30 * hs} Z`);
    g.fillStyle = rad(g, cx - 10 * hs, hy - 20 * hs, 4, 70 * hs, [[0, mixc(skin, '#ffffff', .1)], [1, skin2]]); g.fill(h);
    ellipse(g, cx, hy + 56 * hs, 8 * hs, 6 * hs); g.fillStyle = '#000'; g.fill();
    g.fillStyle = '#fff4e0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 10 * hs, hy + 40 * hs); g.lineTo(cx + s * 7 * hs, hy + 58 * hs); g.lineTo(cx + s * 4 * hs, hy + 40 * hs); g.fill(); }
    return;
  }
  if (kind === 'skull') {
    const h = P(`M${cx} ${hy - 44 * hs} C${cx + 34 * hs} ${hy - 44 * hs} ${cx + 44 * hs} ${hy - 16 * hs} ${cx + 40 * hs} ${hy + 10 * hs} C${cx + 36 * hs} ${hy + 24 * hs} ${cx + 26 * hs} ${hy + 30 * hs} ${cx + 22 * hs} ${hy + 44 * hs} L${cx - 22 * hs} ${hy + 44 * hs} C${cx - 26 * hs} ${hy + 30 * hs} ${cx - 36 * hs} ${hy + 24 * hs} ${cx - 40 * hs} ${hy + 10 * hs} C${cx - 44 * hs} ${hy - 16 * hs} ${cx - 34 * hs} ${hy - 44 * hs} ${cx} ${hy - 44 * hs} Z`);
    shapeFill(g, h, ['#f0e6d0', '#8a7a60'], 0, hy - 44 * hs, 0, hy + 44 * hs);
    g.fillStyle = '#100404'; ellipse(g, cx - 14 * hs, hy - 4 * hs, 10 * hs, 11 * hs); g.fill(); ellipse(g, cx + 14 * hs, hy - 4 * hs, 10 * hs, 11 * hs); g.fill();
    g.beginPath(); g.moveTo(cx, hy + 10 * hs); g.lineTo(cx - 5 * hs, hy + 20 * hs); g.lineTo(cx + 5 * hs, hy + 20 * hs); g.fill();
    for (let i = -2; i <= 2; i++) stroke(g, `M${cx + i * 7 * hs} ${hy + 30 * hs} l0 12`, '#100404', 2.5);
    return;
  }
  if (kind === 'fly') {
    ellipse(g, cx, hy, 40 * hs, 34 * hs); g.fillStyle = rad(g, cx - 10, hy - 10, 4, 50 * hs, [[0, '#3a4a2a'], [1, '#0a0e06']]); g.fill();
    for (const s of [-1, 1]) { ellipse(g, cx + s * 24 * hs, hy - 6 * hs, 20 * hs, 24 * hs); g.fillStyle = rad(g, cx + s * 20 * hs, hy - 14 * hs, 2, 26 * hs, [[0, '#ff6a5a'], [.5, '#8a0a0a'], [1, '#2a0202']]); g.fill(); }
    stroke(g, `M${cx - 6 * hs} ${hy + 26 * hs} l-4 26 M${cx + 6 * hs} ${hy + 26 * hs} l4 26`, '#1a1a10', 5);
    return;
  }
  if (kind === 'mask') {
    const h = P(`M${cx - 38 * hs} ${hy - 30 * hs} C${cx - 20 * hs} ${hy - 44 * hs} ${cx + 20 * hs} ${hy - 44 * hs} ${cx + 38 * hs} ${hy - 30 * hs} C${cx + 42 * hs} ${hy + 10 * hs} ${cx + 30 * hs} ${hy + 46 * hs} ${cx} ${hy + 54 * hs} C${cx - 30 * hs} ${hy + 46 * hs} ${cx - 42 * hs} ${hy + 10 * hs} ${cx - 38 * hs} ${hy - 30 * hs} Z`);
    shapeFill(g, h, ['#fff8ec', '#d8c8b0'], 0, hy - 44 * hs, 0, hy + 54 * hs);
    g.fillStyle = '#1a0a14'; ellipse(g, cx - 14 * hs, hy - 4 * hs, 9 * hs, 5 * hs, -.2); g.fill(); ellipse(g, cx + 14 * hs, hy - 4 * hs, 9 * hs, 5 * hs, .2); g.fill();
    stroke(g, `M${cx - 18 * hs} ${hy + 22 * hs} C${cx - 6 * hs} ${hy + 36 * hs} ${cx + 6 * hs} ${hy + 36 * hs} ${cx + 18 * hs} ${hy + 22 * hs}`, '#8a1a2a', 4);
    g.fillStyle = 'rgba(255,120,140,.35)'; ellipse(g, cx - 24 * hs, hy + 14 * hs, 7 * hs, 4 * hs); g.fill(); ellipse(g, cx + 24 * hs, hy + 14 * hs, 7 * hs, 4 * hs); g.fill();
    return;
  }
  if (kind === 'hood') {
    const h = P(`M${cx} ${hy - 56 * hs} C${cx + 40 * hs} ${hy - 56 * hs} ${cx + 52 * hs} ${hy - 10 * hs} ${cx + 48 * hs} ${hy + 40 * hs} L${cx - 48 * hs} ${hy + 40 * hs} C${cx - 52 * hs} ${hy - 10 * hs} ${cx - 40 * hs} ${hy - 56 * hs} ${cx} ${hy - 56 * hs} Z`);
    shapeFill(g, h, [mixc(o.robe ?? '#2a1a2a', '#ffffff', .1), o.robe ?? '#2a1a2a', o.robe2 ?? '#0a050a'], 0, hy - 56 * hs, 0, hy + 40 * hs);
    ellipse(g, cx, hy + 2 * hs, 26 * hs, 32 * hs); g.fillStyle = '#030204'; g.fill();
    return;
  }
  // a face: demon (pointed ears, fangs) or human
  const ear = kind === 'demon';
  if (ear) for (const s of [-1, 1]) { const e = P(`M${cx + s * 30 * hs} ${hy - 6 * hs} L${cx + s * 62 * hs} ${hy - 26 * hs} L${cx + s * 34 * hs} ${hy + 16 * hs} Z`); shapeFill(g, e, [skin, skin2], 0, hy - 26 * hs, 0, hy + 16 * hs); }
  const face = P(`M${cx - 32 * hs} ${hy - 24 * hs} C${cx - 30 * hs} ${hy - 50 * hs} ${cx + 30 * hs} ${hy - 50 * hs} ${cx + 32 * hs} ${hy - 24 * hs} C${cx + 36 * hs} ${hy + 6 * hs} ${cx + 22 * hs} ${hy + 40 * hs} ${cx} ${hy + 46 * hs} C${cx - 22 * hs} ${hy + 40 * hs} ${cx - 36 * hs} ${hy + 6 * hs} ${cx - 32 * hs} ${hy - 24 * hs} Z`);
  g.fillStyle = rad(g, cx - 10 * hs, hy - 20 * hs, 4, 60 * hs, [[0, mixc(o.face ?? skin, '#ffffff', .15)], [.6, o.face ?? skin], [1, o.face2 ?? skin2]]); g.fill(face);
  // eyes (the glow goes on top), brows, mouth
  g.fillStyle = '#100204'; ellipse(g, cx - 13 * hs, hy - 4 * hs, 8 * hs, 5 * hs, .2); g.fill(); ellipse(g, cx + 13 * hs, hy - 4 * hs, 8 * hs, 5 * hs, -.2); g.fill();
  stroke(g, `M${cx - 24 * hs} ${hy - 16 * hs} L${cx - 4 * hs} ${hy - 8 * hs} M${cx + 24 * hs} ${hy - 16 * hs} L${cx + 4 * hs} ${hy - 8 * hs}`, mixc(o.face2 ?? skin2, '#000000', .3), 4 * hs);
  if (ear) { const m = P(`M${cx - 16 * hs} ${hy + 22 * hs} C${cx - 6 * hs} ${hy + 30 * hs} ${cx + 6 * hs} ${hy + 30 * hs} ${cx + 16 * hs} ${hy + 22 * hs} C${cx + 6 * hs} ${hy + 26 * hs} ${cx - 6 * hs} ${hy + 26 * hs} ${cx - 16 * hs} ${hy + 22 * hs} Z`); g.fillStyle = '#140204'; g.fill(m); g.fillStyle = '#fff4e0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 10 * hs, hy + 24 * hs); g.lineTo(cx + s * 8 * hs, hy + 33 * hs); g.lineTo(cx + s * 5 * hs, hy + 25 * hs); g.fill(); } }
  else stroke(g, `M${cx - 10 * hs} ${hy + 26 * hs} C${cx - 4 * hs} ${hy + 22 * hs} ${cx + 4 * hs} ${hy + 22 * hs} ${cx + 10 * hs} ${hy + 26 * hs}`, o.lips ?? '#5a1a1a', 3.5 * hs);
  if (o.crown) { const c = P(`M${cx - 34 * hs} ${hy - 34 * hs} L${cx - 30 * hs} ${hy - 70 * hs} L${cx - 16 * hs} ${hy - 50 * hs} L${cx} ${hy - 80 * hs} L${cx + 16 * hs} ${hy - 50 * hs} L${cx + 30 * hs} ${hy - 70 * hs} L${cx + 34 * hs} ${hy - 34 * hs} Z`); shapeFill(g, c, [o.crown, mixc(o.crown, '#000000', .5)], 0, hy - 80 * hs, 0, hy - 34 * hs); }
  if (o.horns === 'small') for (const s of [-1, 1]) { const h = P(`M${cx + s * 14 * hs} ${hy - 38 * hs} L${cx + s * 24 * hs} ${hy - 66 * hs} L${cx + s * 28 * hs} ${hy - 34 * hs} Z`); shapeFill(g, h, ['#efe0c4', '#3a2a20'], 0, hy - 66 * hs, 0, hy - 34 * hs); }
}

/* ---------- beasts ---------- */
function hound(o) {
  // Cerberus: a huge black hound with three heads, each with its own glow
  const r = new Rig();
  const fur = o.fur ?? '#2a1c1a', fur2 = o.fur2 ?? '#070404', eye = o.eye ?? '#ff3a1a';
  const cx = 256;
  r.part('tail', g => stroke(g, `M${cx + 120} 330 C${cx + 180} 300 ${cx + 200} 250 ${cx + 190} 200`, fur2, 18), { pivot: [cx + 120, 330], z: 0, anim: { rot: .15, speed: 2 } });
  r.part('body', g => {
    const b = P(`M${cx - 120} 300 C${cx - 110} 240 ${cx + 100} 230 ${cx + 140} 290 C${cx + 160} 330 ${cx + 140} 380 ${cx + 110} 390 L${cx - 110} 392 C${cx - 140} 380 ${cx - 140} 330 ${cx - 120} 300 Z`);
    g.fillStyle = rad(g, cx - 40, 270, 10, 220, [[0, mixc(fur, '#ffffff', .08)], [.6, fur], [1, fur2]]); g.fill(b);
    for (const [lx, back] of [[cx - 96, 1], [cx - 50, 0], [cx + 80, 1], [cx + 120, 0]]) {
      const l = P(`M${lx - 22} 360 L${lx + 22} 360 L${lx + 16} 470 L${lx + 30} ${FY} L${lx - 14} ${FY} L${lx - 14} 470 Z`);
      shapeFill(g, l, [back ? fur2 : fur, fur2], 0, 360, 0, FY);
      for (let i = 0; i < 3; i++) stroke(g, `M${lx - 10 + i * 12} ${FY - 4} l2 8`, '#d8c8b0', 3);
    }
    for (let i = 0; i < 14; i++) stroke(g, `M${cx - 100 + i * 16} ${270 + (i % 3) * 6} l${-8 + (i % 2) * 4} -18`, fur2, 4);
    // chain collar
    for (let i = 0; i < 8; i++) { ellipse(g, cx - 80 + i * 12, 270 + Math.sin(i) * 3, 7, 5); g.strokeStyle = '#6a6a70'; g.lineWidth = 3; g.stroke(); }
  }, { z: 1, anim: { breath: .02, speed: 1.8 } });
  // three heads, each its own part so they can snap separately
  [[-120, 230, .85, 'headL'], [10, 196, 1, 'headM'], [-58, 250, .9, 'headR']].forEach(([dx, hy, s, name], i) => {
    const hx = cx + dx;
    r.part(name, g => {
      stroke(g, `M${hx + 40 * s} ${hy + 30 * s} C${hx + 60 * s} ${hy + 50 * s} ${cx} 280 ${cx + 10} 300`, fur, 36 * s);
      const h = P(`M${hx - 50 * s} ${hy - 20 * s} C${hx - 40 * s} ${hy - 60 * s} ${hx + 30 * s} ${hy - 60 * s} ${hx + 46 * s} ${hy - 10 * s} C${hx + 50 * s} ${hy + 20 * s} ${hx + 30 * s} ${hy + 40 * s} ${hx} ${hy + 40 * s} L${hx - 70 * s} ${hy + 30 * s} C${hx - 90 * s} ${hy + 20 * s} ${hx - 92 * s} ${hy} ${hx - 80 * s} ${hy - 8 * s} Z`);
      g.fillStyle = rad(g, hx - 10, hy - 30 * s, 4, 90 * s, [[0, mixc(fur, '#ffffff', .1)], [1, fur2]]); g.fill(h);
      // ears
      const e = P(`M${hx + 10 * s} ${hy - 44 * s} L${hx + 30 * s} ${hy - 90 * s} L${hx + 40 * s} ${hy - 30 * s} Z`); shapeFill(g, e, [fur, fur2], 0, hy - 90 * s, 0, hy);
      // jaw with teeth
      const j = P(`M${hx - 84 * s} ${hy + 16 * s} L${hx - 10 * s} ${hy + 24 * s} L${hx - 20 * s} ${hy + 44 * s} L${hx - 74 * s} ${hy + 36 * s} Z`); g.fillStyle = '#3a0606'; g.fill(j);
      g.fillStyle = '#f6ecd8'; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(hx - 80 * s + k * 13 * s, hy + 16 * s); g.lineTo(hx - 76 * s + k * 13 * s, hy + 28 * s); g.lineTo(hx - 72 * s + k * 13 * s, hy + 17 * s); g.fill(); }
      ellipse(g, hx - 84 * s, hy + 4 * s, 7 * s, 6 * s); g.fillStyle = '#000'; g.fill();
    }, { z: 2 + (name === 'headM' ? 1 : 0), pivot: [hx + 30 * s, hy + 30 * s], anim: { bob: 4, speed: 1.8, phase: i * 1.7, rot: .06 },
      glow: g => glowDot(g, hx - 30 * s, hy - 12 * s, 6 * s, eye) });
  });
  r.feet = FY; r.top = 120; r.heads = true;
  return r;
}
function blob(o) {
  // a heaving mass: the Glutton, the Hoarder
  const r = new Rig();
  const skin = o.skin ?? '#6a6a3a', skin2 = o.skin2 ?? '#1a1a08', cx = 256;
  r.part('body', g => {
    const b = P(`M${cx - 150} ${FY} C${cx - 190} 420 ${cx - 160} 250 ${cx - 60} 220 C${cx - 20} 170 ${cx + 60} 180 ${cx + 100} 230 C${cx + 180} 260 ${cx + 190} 420 ${cx + 150} ${FY} Z`);
    g.fillStyle = rad(g, cx - 50, 260, 10, 280, [[0, mixc(skin, '#ffffff', .15)], [.5, skin], [1, skin2]]); g.fill(b);
    for (let i = 0; i < 5; i++) stroke(g, `M${cx - 140 + i * 10} ${300 + i * 40} C${cx - 60} ${320 + i * 40} ${cx + 60} ${320 + i * 40} ${cx + 140 - i * 10} ${300 + i * 40}`, rgba(skin2, .5), 4);
    if (o.coins) { for (let i = 0; i < 30; i++) { const x = cx - 160 + (i * 37) % 320, y = FY - 10 - (i % 4) * 14; ellipse(g, x, y, 16, 6); g.fillStyle = i % 3 ? '#ffd86a' : '#c8902a'; g.fill(); } const sack = P(`M${cx + 90} ${FY - 40} C${cx + 70} ${FY - 120} ${cx + 160} ${FY - 140} ${cx + 180} ${FY - 60} C${cx + 190} ${FY - 20} ${cx + 100} ${FY - 10} ${cx + 90} ${FY - 40} Z`); shapeFill(g, sack, ['#8a6a3a', '#2a1a08'], 0, FY - 140, 0, FY); }
    // arms
    for (const s of [-1, 1]) { const a = P(`M${cx + s * 110} 280 C${cx + s * 170} 320 ${cx + s * 190} 380 ${cx + s * 180} 430 L${cx + s * 150} 432 C${cx + s * 150} 390 ${cx + s * 130} 340 ${cx + s * 96} 310 Z`); shapeFill(g, a, [skin, skin2], 0, 280, 0, 432); }
  }, { z: 0, anim: { breath: .04, speed: 1.2 } });
  r.part('head', g => {
    const hy = 210;
    ellipse(g, cx, hy, 70, 54); g.fillStyle = rad(g, cx - 20, hy - 20, 4, 90, [[0, mixc(skin, '#ffffff', .2)], [1, skin2]]); g.fill();
    // the maw
    const m = P(`M${cx - 52} ${hy + 4} C${cx - 30} ${hy + 50} ${cx + 30} ${hy + 50} ${cx + 52} ${hy + 4} C${cx + 30} ${hy + 20} ${cx - 30} ${hy + 20} ${cx - 52} ${hy + 4} Z`); g.fillStyle = '#1a0204'; g.fill(m);
    g.fillStyle = '#f4ead0'; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(cx + i * 11 - 4, hy + 12 + Math.abs(i)); g.lineTo(cx + i * 11, hy + 24 + Math.abs(i)); g.lineTo(cx + i * 11 + 4, hy + 12 + Math.abs(i)); g.fill(); }
    if (o.horns) for (const s of [-1, 1]) { const h = P(`M${cx + s * 40} ${hy - 40} C${cx + s * 60} ${hy - 90} ${cx + s * 90} ${hy - 90} ${cx + s * 100} ${hy - 70} C${cx + s * 80} ${hy - 70} ${cx + s * 66} ${hy - 50} ${cx + s * 56} ${hy - 30} Z`); shapeFill(g, h, ['#efe0c4', '#3a2a20'], 0, hy - 90, 0, hy); }
  }, { z: 1, pivot: [cx, 250], anim: { bob: 4, speed: 1.2, rot: .03 },
    glow: g => { glowDot(g, cx - 26, 192, 6, o.eye ?? '#e8ff5a'); glowDot(g, cx + 26, 192, 6, o.eye ?? '#e8ff5a'); } });
  r.feet = FY; r.top = 130;
  return r;
}
function leech(o) {
  const r = new Rig(); const cx = 256;
  r.part('body', g => {
    const p = new Path2D();
    p.moveTo(cx - 170, FY);
    p.bezierCurveTo(cx - 180, 400, cx - 100, 360, cx - 40, 380);
    p.bezierCurveTo(cx + 10, 400, cx + 40, 300, cx + 20, 220);
    p.bezierCurveTo(cx + 10, 160, cx + 90, 140, cx + 120, 190);
    p.bezierCurveTo(cx + 140, 230, cx + 100, 260, cx + 90, 300);
    p.bezierCurveTo(cx + 80, 360, cx + 120, 440, cx + 170, FY);
    p.closePath();
    g.fillStyle = rad(g, cx, 300, 10, 260, [[0, '#4a3a4a'], [.6, '#2a1a28'], [1, '#08040a']]); g.fill(p);
    for (let i = 0; i < 10; i++) stroke(g, `M${cx - 150 + i * 30} ${FY - 10 - Math.sin(i * .6) * 60} l20 -6`, 'rgba(0,0,0,.4)', 4);
    // the round sucker mouth
    ellipse(g, cx + 70, 190, 44, 36); g.fillStyle = '#4a1a24'; g.fill();
    ellipse(g, cx + 70, 192, 28, 22); g.fillStyle = '#120204'; g.fill();
    g.fillStyle = '#e8dcc8'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(cx + 70 + Math.cos(a) * 28, 192 + Math.sin(a) * 22); g.lineTo(cx + 70 + Math.cos(a) * 18, 192 + Math.sin(a) * 14); g.lineTo(cx + 70 + Math.cos(a + .2) * 28, 192 + Math.sin(a + .2) * 22); g.fill(); }
  }, { z: 0, pivot: [cx, FY], anim: { rot: .04, speed: 1.4, breath: .03 },
    glow: g => { for (let i = 0; i < 6; i++) glowDot(g, cx - 120 + i * 40, FY - 40 - Math.sin(i * .7) * 50, 3, '#ff5a8a'); } });
  r.feet = FY; r.top = 150;
  return r;
}
function fly(o) {
  const r = new Rig(); const cx = 256, cy = 300, s = o.size ?? 1;
  r.part('wingL', g => { ellipse(g, cx - 40 * s, cy - 50 * s, 60 * s, 26 * s, -.5); g.fillStyle = 'rgba(200,220,200,.45)'; g.fill(); g.strokeStyle = 'rgba(40,50,30,.6)'; g.lineWidth = 2; g.stroke(); }, { pivot: [cx, cy - 20 * s], z: 0, anim: { rot: -.5, speed: 22 } });
  r.part('wingR', g => { ellipse(g, cx + 40 * s, cy - 50 * s, 60 * s, 26 * s, .5); g.fillStyle = 'rgba(200,220,200,.4)'; g.fill(); g.strokeStyle = 'rgba(40,50,30,.6)'; g.lineWidth = 2; g.stroke(); }, { pivot: [cx, cy - 20 * s], z: 0, anim: { rot: .5, speed: 22, phase: .2 } });
  r.part('body', g => {
    ellipse(g, cx, cy + 30 * s, 34 * s, 50 * s); g.fillStyle = rad(g, cx - 10, cy + 10, 4, 60 * s, [[0, '#4a5a3a'], [1, '#0a0e06']]); g.fill();
    for (let i = 0; i < 3; i++) stroke(g, `M${cx - 30 * s} ${cy + (20 + i * 18) * s} C${cx} ${cy + (26 + i * 18) * s} ${cx} ${cy + (26 + i * 18) * s} ${cx + 30 * s} ${cy + (20 + i * 18) * s}`, '#1a2a10', 3);
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) stroke(g, `M${cx + sd * 20 * s} ${cy + (10 + i * 16) * s} l${sd * 30 * s} ${(20 + i * 10) * s} l${sd * 6 * s} ${24 * s}`, '#0a0e06', 3);
    drawHead(g, cx, cy - 30 * s, .9 * s, { head: 'fly' });
  }, { z: 1, pivot: [cx, cy], anim: { bob: 8, speed: 3 } });
  r.feet = cy + 100 * s; r.top = cy - 80 * s; r.hover = true;
  return r;
}
function soul(o) {
  // a small pale wisp with a sad face
  const r = new Rig(); const cx = 256;
  r.part('body', g => {
    const p = P(`M${cx} 250 C${cx + 60} 250 ${cx + 70} 320 ${cx + 60} 370 C${cx + 50} 420 ${cx + 20} 450 ${cx + 30} 490 C${cx} 470 ${cx - 20} 440 ${cx - 30} 470 C${cx - 50} 430 ${cx - 70} 380 ${cx - 60} 320 C${cx - 56} 270 ${cx - 40} 250 ${cx} 250 Z`);
    g.fillStyle = lin(g, 0, 250, 0, 490, [[0, 'rgba(220,235,255,.95)'], [.6, 'rgba(150,180,220,.6)'], [1, 'rgba(120,150,200,0)']]); g.fill(p);
    g.fillStyle = 'rgba(20,30,50,.85)'; ellipse(g, cx - 18, 310, 9, 13); g.fill(); ellipse(g, cx + 18, 310, 9, 13); g.fill(); ellipse(g, cx, 350, 10, 14); g.fill();
  }, { z: 0, pivot: [cx, 300], anim: { bob: 8, speed: 1.4, rot: .06 },
    glow: g => { g.fillStyle = rad(g, cx, 320, 10, 110, [[0, 'rgba(180,210,255,.4)'], [1, 'rgba(180,210,255,0)']]); g.beginPath(); g.arc(cx, 320, 110, 0, TAU); g.fill(); } });
  r.feet = FY; r.top = 240; r.hover = true;
  return r;
}

/* ---------- who looks like what ---------- */
const LOOKS = {
  angel: () => angel(),
  imp: () => imp({}),
  bloat: () => imp({ skin: '#7a8a3a', skin2: '#1e2a08', belly: 1.6, wingSize: .7, eye: '#f0ff6a' }),
  coinDevil: () => imp({ skin: '#b8862a', skin2: '#3a2404', coins: true, eye: '#fff2a0', hornCol: '#2a1a08' }),
  wrathling: () => imp({ skin: '#d0261a', skin2: '#3a0402', head: 1.15, flame: true, eye: '#ffffff', wingSize: .8 }),
  malebranche: () => humanoid({ skin: '#3a3a40', skin2: '#0a0a0e', horns: 'straight', wings: 'bat', wingSize: .8, tail: true, weapon: 'trident', eye: '#7affd8', bulk: .9 }),
  fly: () => fly({ size: .8 }),
  soul: () => soul({}),
  shade: () => wraith({ col: '#3a3e4c', col2: '#06070a', eye: '#b8d8ff' }),
  wraith: () => wraith({ col: '#5a2a5a', col2: '#12040e', eye: '#ff8ad0', size: 1.1, seed: 7 }),
  iceWraith: () => wraith({ col: '#9ac0d8', col2: '#1a2a3a', eye: '#e0f8ff', ice: true, size: 1.1, claw: '#e8fbff', seed: 11 }),
  succubus: () => humanoid({ skin: '#c84a5a', skin2: '#3a0a18', head: 'demon', horns: 'curl', hair: 'long', hairCol: '#2a0a1a', wings: 'bat', wingSize: .95, tail: true, bulk: .78, eye: '#ff7ad0', muscles: false, hoof: true, loin: '#2a0814' }),
  lover: () => humanoid({ skin: '#9aa4b8', skin2: '#2a3040', face: '#d8dce8', face2: '#6a7080', head: 'human', hair: 'long', hairCol: '#3a2a20', lower: 'robe', robe: '#3a2a4a', robe2: '#0a0612', eye: '#c8e0ff', muscles: false, bulk: .8, hover: true, trim: '#8a7aa8' }),
  lover2: () => humanoid({ skin: '#b8a4b8', skin2: '#3a2a40', face: '#ead8e4', face2: '#8a6a80', head: 'human', hair: 'long', hairCol: '#8a3a20', lower: 'robe', robe: '#6a2a4a', robe2: '#14060c', eye: '#ffc8e0', muscles: false, bulk: .74, hover: true, trim: '#c88aa8' }),
  minos: () => humanoid({ skin: '#5a3a2a', skin2: '#140a06', head: 'demon', horns: 'big', lower: 'serpent', tailCol: '#4a3a1a', tailCol2: '#140e04', crown: '#d8a43a', bulk: 1.3, tall: 1.05, eye: '#ffb03a', weapon: 'scale' }),
  cerberus: () => hound({}),
  glutton: () => blob({ skin: '#7a6a3a', skin2: '#1a1406', eye: '#e8ff5a' }),
  flylord: () => humanoid({ skin: '#2a3a1a', skin2: '#060a02', head: 'fly', headSize: 1.2, wings: 'bat', wingCol: 'rgba(160,190,150,.6)', wingCol2: 'rgba(60,80,40,.4)', wingSize: 1.1, bulk: 1.1, crown: '#a8a040', eye: '#ff5a3a', lower: 'robe', robe: '#1a2410', robe2: '#030502', trim: '#6a7a2a' }),
  hoarder: () => blob({ skin: '#8a6a2a', skin2: '#2a1804', coins: true, horns: true, eye: '#fff07a' }),
  leech: () => leech({}),
  heretic: () => humanoid({ skin: '#6a3a2a', skin2: '#1a0806', head: 'hood', robe: '#3a1206', robe2: '#0e0402', lower: 'robe', flames: true, eye: '#ffa03a', bulk: .9, weapon: 'staff', trim: '#c8501a', muscles: false }),
  cleric: () => humanoid({ skin: '#cfc4b8', skin2: '#4a4038', face: '#d8d0c8', face2: '#6a6058', head: 'human', lower: 'robe', robe: '#1a1420', robe2: '#05030a', trim: '#8a6ab8', halo: 'broken', eye: '#c0a8ff', bulk: .9, weapon: 'staff', collar: '#e8e0d0', muscles: false }),
  plutus: () => humanoid({ skin: '#5a4a2a', skin2: '#140e04', head: 'wolf', headSize: 1.2, bulk: 1.35, tall: 1.05, crown: '#ffd04a', weapon: 'coins', eye: '#ffd04a', loin: '#8a6a1a', collar: '#d8a43a' }),
  phlegyas: () => humanoid({ skin: '#4a3a3a', skin2: '#0e0808', head: 'demon', horns: 'ram', bulk: 1.2, tall: 1.05, weapon: 'oar', eye: '#ff5a2a', lower: 'robe', robe: '#2a1a14', robe2: '#080402', trim: '#6a3a1a' }),
  fallenSeraph: () => humanoid({ skin: '#cfc8d8', skin2: '#3a3448', face: '#e0dae8', face2: '#6a6478', head: 'human', hair: 'long', hairCol: '#e8e4f0', wings: 'feather', wingCol: '#2a2232', wingCol2: '#050308', wingSize: 1.2, halo: 'broken', lower: 'robe', robe: '#1a1624', robe2: '#030206', trim: '#b8a8e8', eye: '#d8c8ff', weapon: 'sword', bulk: .95, tall: 1.05, muscles: false, hover: true }),
  fury1: () => humanoid({ skin: '#7a2a2a', skin2: '#1a0404', face: '#b8564a', head: 'human', hair: 'snakes', wings: 'bat', wingSize: .9, tatter: 5, lower: 'robe', robe: '#3a0a0a', robe2: '#0a0202', trim: '#c84a2a', eye: '#ff5a3a', weapon: 'whip', muscles: false, bulk: .8, hover: true }),
  fury2: () => humanoid({ skin: '#3a5a3a', skin2: '#0a1a0a', face: '#7a9a6a', head: 'human', hair: 'snakes', wings: 'bat', wingSize: .9, tatter: 9, lower: 'robe', robe: '#123a12', robe2: '#020a02', trim: '#5ac84a', eye: '#aaff6a', weapon: 'whip', muscles: false, bulk: .8, hover: true }),
  fury3: () => humanoid({ skin: '#3a2a5a', skin2: '#0a061a', face: '#7a6aa8', head: 'human', hair: 'snakes', wings: 'bat', wingSize: .9, tatter: 13, lower: 'robe', robe: '#1a0e3a', robe2: '#04020a', trim: '#8a6af8', eye: '#c8a8ff', weapon: 'whip', muscles: false, bulk: .8, hover: true }),
  centaur: () => humanoid({ skin: '#8a5a3a', skin2: '#2a140a', face: '#a8704a', head: 'human', hair: 'long', hairCol: '#1a0e08', lower: 'horse', hide: '#4a2a14', hide2: '#120804', bulk: .95, eye: '#ffb04a', weapon: 'sword', horns: 'small' }),
  harpy: () => humanoid({ skin: '#8a7a6a', skin2: '#2a2018', face: '#a8987a', head: 'human', hair: 'long', hairCol: '#2a1a10', wings: 'feather', wingCol: '#4a3a2a', wingCol2: '#140e08', lower: 'bird', feather: '#5a4a3a', bulk: .72, eye: '#ffea5a', muscles: false, hover: true }),
  flatterer: () => humanoid({ skin: '#6a4a6a', skin2: '#1a0a1a', head: 'mask', lower: 'robe', robe: '#5a1a4a', robe2: '#10040e', trim: '#e8c86a', eye: '#ffffff', bulk: .9, collar: '#e8c86a', muscles: false }),
  traitor: () => humanoid({ skin: '#8aa8c0', skin2: '#1a2a3a', face: '#b8d0e0', face2: '#4a6078', head: 'human', lower: 'ice', robe: '#2a3a4a', robe2: '#0a121a', eye: '#e0f8ff', bulk: 1, muscles: false }),
  minotaur: () => humanoid({ skin: '#5a3a2a', skin2: '#140a04', head: 'bull', headSize: 1.15, bulk: 1.4, tall: 1.05, weapon: 'axe', loin: '#3a2010', eye: '#ff3a2a' }),
  geryon: () => humanoid({ skin: '#b89a7a', skin2: '#3a2a1a', face: '#e0c8a8', head: 'human', lower: 'serpent', tailCol: '#6a4a1a', tailCol2: '#1a0a02', wings: 'bat', wingCol: '#3a2a1a', wingCol2: '#8a6a3a', bulk: 1.05, eye: '#ffffff', tail: true, chest: (cx, sh) => `M${cx - 40} ${sh + 30} C${cx - 20} ${sh + 50} ${cx + 20} ${sh + 50} ${cx + 40} ${sh + 30} M${cx - 30} ${sh + 70} C${cx - 10} ${sh + 86} ${cx + 10} ${sh + 86} ${cx + 30} ${sh + 70}`, chestCol: '#8a5a2a' }),
  nimrod: () => humanoid({ skin: '#7a8a9a', skin2: '#1a2028', face: '#a8b4c0', head: 'demon', horns: 'small', bulk: 1.55, tall: 1.12, weapon: 'horn', lower: 'ice', robe: '#3a4a5a', robe2: '#0a121a', eye: '#bfefff', crown: '#8a9aa8' }),
  devil: () => humanoid({ skin: '#5a1010', skin2: '#120202', faces: 3, horns: 'big', wings: 'bat', wingSize: 1.45, wingCol: '#1a0606', wingCol2: '#4a1010', bulk: 1.6, tall: 1.15, lower: 'ice', robe: '#4a5a6a', robe2: '#121a22', eye: '#ffef8a', headSize: .9 }),
};
export const lookFor = id => (LOOKS[id] ?? LOOKS.imp)();
export { FW, FH };
