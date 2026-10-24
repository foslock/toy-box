// A two-and-a-bit colour risograph: everything is drawn into one canvas per ink (blue, pink,
// yellow), tints are halftone dot screens at each ink's own angle, and the inks are multiplied
// onto cream paper slightly out of register, the way a riso drum lays them down.
import { RW, FH, BASE, HW, SW, floorY, ROOMS, ACTS, VIEW, TORCH_VIEW } from './game.js';

export const PAPER = '#f3ecdb';
export const INK = { blue: '#2c4c9c', pink: '#ff4f9e', yellow: '#ffd23a' };
const TONES = [0.1, 0.2, 0.35, 0.5, 0.7];

class Layer {
  constructor(color, angle, off) {
    this.cv = document.createElement('canvas');
    this.c = this.cv.getContext('2d');
    this.color = color; this.angle = angle; this.off = off; this.pats = {};
  }
  size(w, h) { if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; } }
  // a halftone screen of this ink at tone t, with dots a fixed size on screen whatever the zoom
  tone(t, k) {
    if (t >= 0.9) return this.color;
    let best = TONES[0];
    for (const v of TONES) if (Math.abs(v - t) < Math.abs(best - t)) best = v;
    const key = best + '@' + k.toFixed(3);
    if (this.pats[key]) return this.pats[key];
    const cell = 5;
    const cv = document.createElement('canvas'); cv.width = cv.height = cell;
    const c = cv.getContext('2d'); c.fillStyle = this.color;
    const r = Math.sqrt(best * cell * cell / Math.PI);
    // dots at the cell's corners and centre would double up; one centred dot tiles cleanly
    c.beginPath(); c.arc(cell / 2, cell / 2, Math.min(r, cell * 0.62), 0, 7); c.fill();
    if (r > cell / 2) { for (const [x, y] of [[0, 0], [cell, 0], [0, cell], [cell, cell]]) { c.beginPath(); c.arc(x, y, r - cell / 2, 0, 7); c.fill(); } }
    const pat = this.c.createPattern(cv, 'repeat');
    pat.setTransform(new DOMMatrix().scaleSelf(1 / k, 1 / k).rotateSelf(this.angle));
    this.pats = Object.keys(this.pats).length > 40 ? {} : this.pats;
    return (this.pats[key] = pat);
  }
}

// simple shape helpers on any 2D context
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
function line(c, pts, w) { c.lineWidth = w; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); }

export class Painter {
  constructor() {
    this.B = new Layer(INK.blue, 15, [0, 0]);
    this.P = new Layer(INK.pink, 75, [1.3, -0.9]);
    this.Y = new Layer(INK.yellow, 0, [-0.9, 0.7]);
    this.layers = [this.Y, this.P, this.B];
    this.grain = this.makeGrain();
    this.k = 1;
  }
  makeGrain() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 200;
    const c = cv.getContext('2d'), d = c.createImageData(200, 200);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random();
      const g = v < 0.04 ? 200 : v > 0.985 ? 255 : 238 + Math.random() * 17;
      d.data[i] = g; d.data[i + 1] = g - 4; d.data[i + 2] = g - 14; d.data[i + 3] = 255;
    }
    c.putImageData(d, 0, 0);
    return cv;
  }

  // view: { k (device px per world unit), ox, oy (device px), w, h (device px) }
  begin(view) {
    this.v = view; this.k = view.k;
    for (const L of this.layers) {
      L.size(view.w, view.h);
      L.c.setTransform(1, 0, 0, 1, 0, 0); L.c.clearRect(0, 0, view.w, view.h);
      L.c.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
      L.c.lineJoin = 'round'; L.c.lineCap = 'round';
    }
    this.b = this.B.c; this.p = this.P.c; this.y = this.Y.c;
  }
  tb(t) { return this.B.tone(t, this.k); }
  tp(t) { return this.P.tone(t, this.k); }
  ty(t) { return this.Y.tone(t, this.k); }
  // knock a shape out of every ink, leaving bare paper
  knock(fn) {
    for (const L of this.layers) { const c = L.c; c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.strokeStyle = '#000'; fn(c); c.restore(); }
  }
  knockOne(L, fn) { const c = L.c; c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.strokeStyle = '#000'; fn(c); c.restore(); }

  end(ctx) {
    const { w, h } = this.v;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'multiply';
    for (const L of this.layers) ctx.drawImage(L.cv, L.off[0], L.off[1]);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ctx.createPattern(this.grain, 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // =============================================================== the house
  house(g, time, lit) {
    const { b, p, y } = this;
    const hour = g.hour;
    // ---- the night sky behind and around the house
    const dawn = Math.max(0, Math.min(1, (hour - 28.6) / 1.4));
    b.fillStyle = dawn < 0.3 ? INK.blue : this.tb(0.9 - dawn * 0.55); b.fillRect(-2000, -2000, 5000, 2000 + BASE);
    if (dawn > 0) { p.fillStyle = this.tp(dawn * 0.5); p.fillRect(-2000, BASE - 520, 5000, 520); }
    // stars, knocked out of the blue
    this.knockOne(this.B, (c) => {
      for (let i = 0; i < 70; i++) {
        const sx = ((i * 137.5) % 1700) - 420, sy = ((i * 97.3) % 600) - 520 + (i % 3) * 40;
        if (sx > -60 && sx < HW + SW + 50 && sy > -140) continue;
        const tw = 1.2 + Math.sin(time * 2 + i) * 0.6;
        circ(c, sx, sy, tw * (1 - dawn)); c.fill();
      }
    });
    // the moon, sliding across as the night goes
    const mt = (hour - 20) / 10;
    const mx = -260 + mt * 1500, my = -330 + Math.pow(mt - 0.5, 2) * 500;
    this.knockOne(this.B, (c) => { circ(c, mx, my, 46); c.fill(); });
    y.fillStyle = INK.yellow; circ(y, mx, my, 44); y.fill();
    p.fillStyle = this.tp(0.2); circ(p, mx + 12, my - 6, 14); p.fill(); circ(p, mx - 14, my + 14, 8); p.fill();

    // ---- the garden and ground
    b.fillStyle = INK.blue; b.fillRect(-2000, BASE + 18, 5000, 600);
    p.fillStyle = this.tp(0.35); p.fillRect(-2000, BASE + 18, 5000, 600);
    b.strokeStyle = INK.blue;
    for (let gx = -900; gx < 2000; gx += 26) { line(b, [gx, BASE + 20, gx + 6, BASE + 6, gx + 11, BASE + 20], 4); }
    // a fence, a gate and a moving van waiting by the door
    this.van(g, time);

    // ---- the house shell
    const top = floorY(2) - FH + 14;
    // roof
    b.fillStyle = INK.blue;
    b.beginPath(); b.moveTo(-50, top + 4); b.lineTo(HW / 2 + 45, top - 175); b.lineTo(HW + SW + 50, top + 4); b.closePath(); b.fill();
    this.knockOne(this.B, (c) => {
      c.lineWidth = 3;
      for (let r = 0; r < 6; r++) {
        const yy = top - 10 - r * 27, half = (HW + SW + 100) / 2 * (1 - (r * 27 + 14) / 179);
        for (let sx = HW / 2 + 45 - half + 8; sx < HW / 2 + 45 + half - 8; sx += 24) { c.beginPath(); c.arc(sx + (r % 2) * 12, yy, 9, 0.1, Math.PI - 0.1); c.stroke(); }
      }
    });
    p.fillStyle = this.tp(0.5);
    p.beginPath(); p.moveTo(-50, top + 4); p.lineTo(HW / 2 + 45, top - 175); p.lineTo(HW + SW + 50, top + 4); p.closePath(); p.fill();
    // chimney
    b.fillStyle = INK.blue; b.fillRect(640, top - 150, 46, 110);
    this.smoke(time, 663, top - 156);
    // the rooms are bare paper under their wallpaper, not night sky
    this.knockOne(this.B, (c) => c.fillRect(-14, top - 2, HW + SW + 22, BASE - top + 22));
    this.knockOne(this.P, (c) => c.fillRect(-14, top - 2, HW + SW + 22, BASE - top + 22));
    for (let r = 0; r < 6; r++) this.room(g, r, time, lit[r]);
    // the stairwell
    b.fillStyle = this.tb(0.2); b.fillRect(HW, top, SW, BASE - top);
    b.strokeStyle = INK.blue;
    for (let f = 0; f < 2; f++) {
      const y0 = floorY(f), ym = y0 - FH / 2, y1 = floorY(f + 1);
      this.flight(HW + 12, y0, HW + SW - 10, ym);
      this.flight(HW + SW - 10, ym, HW + 12, y1 + 0.01);
      b.fillStyle = INK.blue; b.fillRect(HW + SW - 26, ym, 24, 7);
    }
    // the front door at the foot of the stairs
    const open = g.people.some((q) => q.leaving && !q.gone && q.f === 0 && q.x > HW + SW - 40);
    if (open) { y.fillStyle = INK.yellow; y.fillRect(HW + SW - 6, BASE - 118, 60, 118); }
    b.fillStyle = INK.blue;
    if (open) { b.fillRect(HW + SW + 2, BASE - 120, 44, 6); } else { rr(b, HW + SW - 9, BASE - 120, 18, 120, 3); b.fill(); }
    p.fillStyle = INK.pink; if (!open) { circ(p, HW + SW - 1, BASE - 58, 4); p.fill(); }
    // walls and floor slabs
    b.fillStyle = INK.blue;
    b.fillRect(-14, top - 6, 14, BASE - top + 24);                 // outer left wall
    b.fillRect(HW + SW - 4, top - 6, 12, BASE - top - 118);         // outer right wall above the door
    for (let f = 0; f < 3; f++) {
      const fy = floorY(f);
      b.fillRect(-14, fy, HW + SW + 22, f === 0 ? 20 : 14);
      // walls down to the top of each doorway: between the rooms, and onto the stairs
      b.fillRect(RW - 5, fy - FH + 8, 10, FH - 8 - 112);
      b.fillRect(HW - 5, fy - FH + 8, 10, FH - 8 - 112);
    }
    b.fillRect(-14, top - 8, HW + SW + 22, 12);                      // attic ceiling beam
  }

  flight(x0, y0, x1, y1) {
    const b = this.b, n = 8;
    b.lineWidth = 4; b.strokeStyle = INK.blue;
    b.beginPath(); b.moveTo(x0, y0);
    for (let i = 1; i <= n; i++) {
      const xa = x0 + (x1 - x0) * (i - 1) / n, xb = x0 + (x1 - x0) * i / n, yb = y0 + (y1 - y0) * i / n;
      b.lineTo(xa, yb); b.lineTo(xb, yb);
    }
    b.stroke();
    line(b, [x0, y0 - 46, x1, y1 - 46], 3);
  }

  smoke(time, x, y) {
    const p = this.p;
    p.fillStyle = this.tp(0.35);
    for (let i = 0; i < 5; i++) {
      const t = (time * 0.25 + i / 5) % 1;
      circ(p, x + Math.sin(t * 6 + i) * 12 + t * 40, y - t * 140, 10 + t * 22); p.fill();
    }
  }

  van(g, time) {
    const { b, p } = this;
    const vx = HW + SW + 120, vy = BASE + 6;
    // the movers' van, waiting: pink paint knocked out of the night
    this.knockOne(this.B, (c) => { rr(c, vx, vy - 120, 190, 100, 8); c.fill(); rr(c, vx + 190, vy - 84, 70, 64, [4, 24, 4, 4]); c.fill(); });
    p.fillStyle = INK.pink; rr(p, vx, vy - 120, 190, 100, 8); p.fill(); rr(p, vx + 190, vy - 84, 70, 64, [4, 24, 4, 4]); p.fill();
    this.knockOne(this.P, (c) => { rr(c, vx + 202, vy - 76, 38, 26, 4); c.fill(); });
    b.fillStyle = INK.blue; b.fillRect(vx + 8, vy - 82, 174, 30);
    this.knockOne(this.B, (c) => { c.font = '22px Caprasimo, Georgia, serif'; c.textBaseline = 'middle'; c.fillText('MOVERS', vx + 42, vy - 66); });
    for (const wx of [vx + 40, vx + 214]) { b.fillStyle = INK.blue; circ(b, wx, vy - 18, 22); b.fill(); this.knockOne(this.B, (c) => { circ(c, wx, vy - 18, 8); c.fill(); }); }
    // a garden fence on the far side
    p.fillStyle = this.tp(0.7);
    for (let fx = -260; fx < -24; fx += 22) { p.fillRect(fx, vy - 56, 12, 56); p.beginPath(); p.moveTo(fx, vy - 56); p.lineTo(fx + 6, vy - 66); p.lineTo(fx + 12, vy - 56); p.fill(); }
    p.fillRect(-270, vy - 40, 250, 7);
    // under the lawn: roots, stones, a lost teacup, and the house's own foundation stone
    p.strokeStyle = this.tp(0.7); p.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const rx = -200 + i * 140, ry = BASE + 30;
      p.lineWidth = 4; p.beginPath(); p.moveTo(rx, ry);
      p.bezierCurveTo(rx + 20, ry + 60, rx - 30, ry + 90, rx + 10 + (i % 3) * 14, ry + 150 + (i % 2) * 40); p.stroke();
    }
    this.knock((c) => {
      for (let i = 0; i < 14; i++) { const sx = -180 + ((i * 173) % 1250), sy = BASE + 70 + ((i * 89) % 220); c.beginPath(); c.ellipse(sx, sy, 14 + (i % 3) * 6, 9 + (i % 2) * 4, i, 0, 7); c.fill(); }
      c.fillRect(300, BASE + 40, 150, 56);
    });
    b.fillStyle = INK.blue; b.font = '20px Caprasimo, Georgia, serif'; b.textAlign = 'center';
    b.fillText('LAID 1887', 375, BASE + 76); b.textAlign = 'left';
    p.fillStyle = INK.pink; p.beginPath(); p.moveTo(640, BASE + 160); p.lineTo(670, BASE + 160); p.lineTo(664, BASE + 184); p.lineTo(646, BASE + 184); p.fill();
    p.lineWidth = 3; p.strokeStyle = INK.pink; p.beginPath(); p.arc(672, BASE + 170, 6, -1.4, 1.4); p.stroke();
  }

  // =============================================================== rooms
  room(g, r, time, light) {
    const { b, p, y } = this;
    const R = ROOMS[r];
    const x0 = R.side * RW, x1 = x0 + RW, fy = floorY(R.f), top = fy - FH + 14;
    // wallpaper
    this.wallpaper(r, x0, top, RW, FH - 14);
    // furniture behind people
    this.furniture(g, r, x0, fy, time);
    // light: warm yellow when lit, a blue wash when dark
    if (light < 0.95) { b.fillStyle = this.tb(0.25 * (1 - light)); b.fillRect(x0, top, RW, FH - 14); }
  }

  wallpaper(r, x0, top, w, h) {
    const { b, p } = this;
    b.save(); b.beginPath(); b.rect(x0, top, w, h); b.clip();
    p.save(); p.beginPath(); p.rect(x0, top, w, h); p.clip();
    if (r === 0) {        // kitchen: tiles to shoulder height, cream above
      b.strokeStyle = this.tb(0.5); b.lineWidth = 2;
      for (let yy = top + h - 120; yy < top + h; yy += 24) { b.beginPath(); b.moveTo(x0, yy); b.lineTo(x0 + w, yy); b.stroke(); }
      for (let xx = x0; xx < x0 + w; xx += 24) { b.beginPath(); b.moveTo(xx, top + h - 120); b.lineTo(xx, top + h); b.stroke(); }
      p.fillStyle = this.tp(0.1); p.fillRect(x0, top, w, h - 120);
    } else if (r === 1) { // parlour: pink stripes with a dado rail
      p.fillStyle = this.tp(0.2);
      for (let xx = x0; xx < x0 + w; xx += 34) p.fillRect(xx, top, 16, h - 80);
      b.fillStyle = INK.blue; b.fillRect(x0, top + h - 82, w, 6);
      b.fillStyle = this.tb(0.2); b.fillRect(x0, top + h - 76, w, 76);
    } else if (r === 2) { // bedroom: little pink sprigs
      p.fillStyle = this.tp(0.1); p.fillRect(x0, top, w, h);
      p.fillStyle = INK.pink;
      for (let yy = top + 16; yy < top + h; yy += 40) for (let xx = x0 + 14 + ((yy / 40) % 2) * 20; xx < x0 + w; xx += 40) { circ(p, xx, yy, 3.2); p.fill(); }
    } else if (r === 3) { // bathroom: blue tiles all the way up
      b.fillStyle = this.tb(0.1); b.fillRect(x0, top, w, h);
      b.strokeStyle = this.tb(0.5); b.lineWidth = 1.5;
      for (let yy = top; yy < top + h; yy += 20) { b.beginPath(); b.moveTo(x0, yy); b.lineTo(x0 + w, yy); b.stroke(); }
      for (let xx = x0; xx < x0 + w; xx += 20) { b.beginPath(); b.moveTo(xx, top); b.lineTo(xx, top + h); b.stroke(); }
    } else if (r === 4) { // attic: bare boards and a cobweb
      b.strokeStyle = this.tb(0.5); b.lineWidth = 2;
      for (let xx = x0 + 30; xx < x0 + w; xx += 46) { b.beginPath(); b.moveTo(xx, top); b.lineTo(xx, top + h); b.stroke(); }
      b.fillStyle = this.tb(0.1); b.fillRect(x0, top, w, h);
      b.strokeStyle = INK.blue; b.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) { const a = i / 4 * Math.PI / 2; line(b, [x0, top, x0 + Math.cos(a) * 70, top + Math.sin(a) * 70], 1.2); }
      for (let rr2 = 18; rr2 < 70; rr2 += 16) { b.beginPath(); b.arc(x0, top, rr2, 0, Math.PI / 2); b.stroke(); }
    } else {              // box room: pink with posters
      p.fillStyle = this.tp(0.2); p.fillRect(x0, top, w, h);
      b.fillStyle = INK.blue; b.fillRect(x0 + 520 - 400, top + 40, 64, 84); b.fillRect(x0 + 640 - 400, top + 30, 50, 64);
      this.knockOne(this.B, (c) => { circ(c, x0 + 152, top + 76, 18); c.fill(); c.fillRect(x0 + 247, top + 50, 26, 6); c.fillRect(x0 + 247, top + 62, 18, 6); });
    }
    b.restore(); p.restore();
  }

  furniture(g, r, x0, fy, time) {
    const { b, p, y } = this;
    b.fillStyle = INK.blue; b.strokeStyle = INK.blue;
    if (r === 0) {
      // stove, worktop, window, table and chairs
      b.fillRect(20, fy - 92, 80, 92); this.knockOne(this.B, (c) => { rr(c, 30, fy - 62, 60, 40, 4); c.fill(); });
      p.fillStyle = this.tp(0.5); rr(p, 30, fy - 62, 60, 40, 4); p.fill();
      b.fillRect(100, fy - 72, 130, 10); b.fillRect(104, fy - 62, 8, 62); b.fillRect(218, fy - 62, 8, 62);
      this.window(250, fy - 230, 80, 74);
      b.fillRect(230, fy - 58, 110, 9); b.fillRect(240, fy - 49, 7, 49); b.fillRect(323, fy - 49, 7, 49);
      p.fillStyle = this.tp(0.35); p.fillRect(226, fy - 64, 118, 8);
    } else if (r === 1) {
      // armchair, sofa, rug, a parlour window
      this.window(470, fy - 220, 70, 84);
      p.fillStyle = this.tp(0.5); rr(p, 440, fy - 6, 300, 8, 4); p.fill();
      b.fillStyle = INK.blue;
      rr(b, 458, fy - 62, 56, 40, 8); b.fill(); rr(b, 452, fy - 104, 18, 92, 8); b.fill(); b.fillRect(462, fy - 22, 6, 22); b.fillRect(506, fy - 22, 6, 22);
      rr(b, 596, fy - 58, 96, 36, 8); b.fill(); rr(b, 674, fy - 96, 22, 82, 8); b.fill(); b.fillRect(602, fy - 22, 6, 22); b.fillRect(682, fy - 22, 6, 22);
      p.fillStyle = this.tp(0.5); rr(p, 596, fy - 58, 96, 14, 6); p.fill(); rr(p, 458, fy - 62, 56, 14, 6); p.fill();
    } else if (r === 2) {
      // the double bed and the cot
      b.fillRect(104, fy - 96, 12, 96); b.fillRect(280, fy - 70, 10, 70);
      b.fillRect(104, fy - 44, 186, 18);
      p.fillStyle = this.tp(0.35); rr(p, 116, fy - 58, 166, 16, 6); p.fill();
      this.knockOne(this.B, (c) => { rr(c, 118, fy - 66, 34, 14, 6); c.fill(); rr(c, 248, fy - 66, 30, 14, 6); c.fill(); });
      if (g.people.some((q) => q.role === 'toddler')) {
        b.fillRect(296, fy - 60, 50, 6); b.fillRect(296, fy - 22, 50, 6);
        for (let xx = 296; xx <= 346; xx += 10) b.fillRect(xx, fy - 60, 3, 60);
      }
    } else if (r === 3) {
      // the bath, sink, a towel
      p.fillStyle = this.tp(0.35); rr(p, 440, fy - 56, 170, 50, [4, 4, 26, 26]); p.fill();
      b.lineWidth = 6; rr(b, 440, fy - 56, 170, 50, [4, 4, 26, 26]); b.stroke();
      b.fillRect(452, fy - 8, 10, 8); b.fillRect(588, fy - 8, 10, 8);
      b.fillRect(700, fy - 70, 64, 12); b.fillRect(724, fy - 58, 16, 58);
      p.fillStyle = INK.pink; p.fillRect(660, fy - 150, 26, 60);
      b.fillRect(654, fy - 154, 38, 5);
    } else if (r === 4) {
      // a trunk, boxes
      b.fillRect(190, fy - 46, 86, 46); this.knockOne(this.B, (c) => { c.fillRect(196, fy - 30, 74, 3); });
      p.fillStyle = this.tp(0.5); p.fillRect(30, fy - 30, 40, 30); p.fillRect(36, fy - 52, 30, 22);
      b.lineWidth = 2; b.strokeRect(30, fy - 30, 40, 30); b.strokeRect(36, fy - 52, 30, 22);
    } else {
      // desk, teen bed, a window
      b.fillRect(600, fy - 64, 90, 8); b.fillRect(604, fy - 56, 6, 56); b.fillRect(682, fy - 56, 6, 56);
      b.fillRect(660, fy - 40, 120, 14); b.fillRect(660, fy - 26, 8, 26); b.fillRect(772, fy - 70, 8, 70);
      p.fillStyle = this.tp(0.5); rr(p, 670, fy - 52, 102, 14, 5); p.fill();
      b.fillRect(440, fy - 42, 50, 42);
    }
  }

  window(x, y0, w, h) {
    const b = this.b;
    b.fillStyle = this.tb(0.7); b.fillRect(x, y0, w, h);
    b.fillStyle = INK.blue; b.fillRect(x - 5, y0 - 5, w + 10, 5); b.fillRect(x - 5, y0 + h, w + 10, 8);
    b.fillRect(x - 5, y0, 5, h); b.fillRect(x + w, y0, 5, h); b.fillRect(x + w / 2 - 2, y0, 4, h); b.fillRect(x, y0 + h / 2 - 2, w, 4);
  }

  // =============================================================== haunted things
  objects(g, time) {
    for (const o of g.objects) this.object(o, time, g);
  }
  object(o, time, g) {
    const { b, p, y } = this;
    const fy = floorY(o.f), x = o.x;
    const a = o.anim > 0 ? 1 - o.anim / 1.6 : -1;   // 0..1 while haunted
    const on = a >= 0;
    const sh = on ? Math.sin(time * 60) * 2.5 * (1 - a) : 0;
    b.fillStyle = INK.blue; b.strokeStyle = INK.blue; p.fillStyle = INK.pink; p.strokeStyle = INK.pink;
    switch (o.id) {
      case 'kettle': {
        const kx = x + sh, ky = fy - 92;
        b.beginPath(); b.moveTo(kx - 22, ky); b.quadraticCurveTo(kx - 24, ky - 34, kx, ky - 34); b.quadraticCurveTo(kx + 24, ky - 34, kx + 22, ky); b.fill();
        b.fillRect(kx + 18, ky - 22, 18, 5); b.lineWidth = 4; b.beginPath(); b.arc(kx, ky - 34, 12, Math.PI, 0); b.stroke();
        if (on) { p.fillStyle = this.tp(0.5); for (let i = 0; i < 4; i++) { const t = (a * 2 + i / 4) % 1; circ(p, kx + 40 + t * 30, ky - 26 - t * 60, 6 + t * 12); p.fill(); } this.zig(kx + 30, ky - 70, 60, a); }
        break;
      }
      case 'cupboard': {
        const cx = x - 40, cy = fy - 230, w = 80, h = 92;
        b.fillRect(cx - 4, cy - 4, w + 8, h + 8);
        this.knockOne(this.B, (c) => c.fillRect(cx + 4, cy + 4, w - 8, h - 8));
        p.fillStyle = this.tp(0.35); p.fillRect(cx + 4, cy + 4, w - 8, h - 8);
        b.fillRect(cx + 4, cy + h / 2 - 2, w - 8, 4);
        for (let i = 0; i < 3; i++) { circ(b, cx + 18 + i * 22, cy + h / 2 - 12, 9); b.fill(); }
        // the doors: shut, or flung open
        const open = on ? Math.min(1, a * 6) * (1 - Math.max(0, a - 0.75) * 4) : 0;
        const dw = (w / 2) * (1 - open * 0.85);
        b.fillRect(cx, cy, dw, h); b.fillRect(cx + w - dw, cy, dw, h);
        if (open > 0.3) { b.fillRect(cx - 34 * open, cy, 34 * open, h); b.fillRect(cx + w, cy, 34 * open, h); }
        break;
      }
      case 'cups': {
        b.fillRect(x - 40, fy - 140, 80, 6);
        for (let i = 0; i < 3; i++) {
          const j = on ? Math.sin(time * 50 + i * 2) * 3 * (1 - a) : 0;
          const cx = x - 26 + i * 26, cy = fy - 140 + (on ? -Math.abs(j) : 0);
          b.beginPath(); b.moveTo(cx - 9 + j, cy - 18); b.lineTo(cx + 9 + j, cy - 18); b.lineTo(cx + 6 + j, cy); b.lineTo(cx - 6 + j, cy); b.fill();
          b.lineWidth = 3; b.beginPath(); b.arc(cx + 10 + j, cy - 10, 5, -1.4, 1.4); b.stroke();
          p.fillStyle = INK.pink; circ(p, cx + j, cy - 10, 3); p.fill();
        }
        if (on) this.zig(x, fy - 175, 50, a);
        break;
      }
      case 'clock': {
        const cx = x + sh;
        b.fillRect(cx - 18, fy - 200, 36, 200); b.fillRect(cx - 24, fy - 206, 48, 10); b.fillRect(cx - 22, fy - 8, 44, 8);
        this.knockOne(this.B, (c) => { circ(c, cx, fy - 174, 15); c.fill(); c.fillRect(cx - 10, fy - 140, 20, 100); });
        b.lineWidth = 2.5; const hh = (g.hour % 12) / 12 * Math.PI * 2, mm = (g.hour % 1) * Math.PI * 2;
        line(b, [cx, fy - 174, cx + Math.sin(hh) * 8, fy - 174 - Math.cos(hh) * 8], 3);
        line(b, [cx, fy - 174, cx + Math.sin(mm) * 12, fy - 174 - Math.cos(mm) * 12], 2);
        const sw = Math.sin(time * 3.2) * (on ? 0.7 : 0.3);
        line(b, [cx, fy - 140, cx + Math.sin(sw) * 50, fy - 140 + Math.cos(sw) * 50], 2);
        p.fillStyle = INK.pink; circ(p, cx + Math.sin(sw) * 54, fy - 140 + Math.cos(sw) * 54, 7); p.fill();
        if (on) { p.lineWidth = 4; for (let i = 0; i < 3; i++) { const t = (a * 3 + i / 3) % 1; p.globalAlpha = 1 - t; circ(p, cx, fy - 174, 20 + t * 70); p.stroke(); } p.globalAlpha = 1; }
        break;
      }
      case 'lamp1': case 'lamp2': case 'lamp3': {
        const tall = o.id === 'lamp1' ? 130 : o.id === 'lamp2' ? 70 : 64;
        const by = fy - (o.id === 'lamp1' ? 0 : o.id === 'lamp3' ? 64 : 0);
        if (o.id === 'lamp2') { b.fillRect(x - 22, fy - 46, 44, 46); }
        const base = o.id === 'lamp2' ? fy - 46 : by;
        b.fillRect(x - 3, base - tall + 30, 6, tall - 30); b.fillRect(x - 14, base - 6, 28, 6);
        const flick = on ? (Math.sin(time * 37) > 0.1 ? 1 : 0) : 1;
        const shadeY = base - tall;
        b.beginPath(); b.moveTo(x - 14, shadeY); b.lineTo(x + 14, shadeY); b.lineTo(x + 24, shadeY + 32); b.lineTo(x - 24, shadeY + 32); b.fill();
        p.fillStyle = this.tp(0.5); p.beginPath(); p.moveTo(x - 14, shadeY); p.lineTo(x + 14, shadeY); p.lineTo(x + 24, shadeY + 32); p.lineTo(x - 24, shadeY + 32); p.fill();
        if (flick) { y.fillStyle = this.ty(0.35); y.beginPath(); y.moveTo(x - 24, shadeY + 32); y.lineTo(x + 24, shadeY + 32); y.lineTo(x + 70, base); y.lineTo(x - 70, base); y.fill(); }
        break;
      }
      case 'portrait': {
        const px = x, py = fy - 170;
        b.fillRect(px - 36, py - 46, 72, 92);
        this.knockOne(this.B, (c) => { rr(c, px - 26, py - 36, 52, 72, 26); c.fill(); });
        p.fillStyle = this.tp(0.35); rr(p, px - 26, py - 36, 52, 72, 26); p.fill();
        // a stern great-aunt
        b.fillStyle = INK.blue; circ(b, px, py - 8, 15); b.fill(); b.fillRect(px - 20, py + 10, 40, 26);
        circ(b, px, py - 26, 10); b.fill();
        const look = on ? Math.sin(a * Math.PI * 4) * 4 : Math.sin(time * 0.3) * 0.5;
        this.knockOne(this.B, (c) => { circ(c, px - 6, py - 9, 4.5); c.fill(); circ(c, px + 6, py - 9, 4.5); c.fill(); });
        p.fillStyle = INK.pink; circ(p, px - 6 + look, py - 9 + (on ? -1.5 : 0), 2.4); p.fill(); circ(p, px + 6 + look, py - 9 + (on ? -1.5 : 0), 2.4); p.fill();
        break;
      }
      case 'radio': {
        const rx = x + sh, ry = fy - 46;
        b.fillRect(rx - 34, fy - 46, 68, 46); b.fillRect(rx - 40, fy - 6, 8, 6); b.fillRect(rx + 32, fy - 6, 8, 6);
        rr(b, rx - 30, ry - 46, 60, 50, [26, 26, 0, 0]); b.fill();
        this.knockOne(this.B, (c) => { rr(c, rx - 20, ry - 34, 40, 30, [16, 16, 0, 0]); c.fill(); });
        p.fillStyle = this.tp(0.5); rr(p, rx - 20, ry - 34, 40, 30, [16, 16, 0, 0]); p.fill();
        b.lineWidth = 2; for (let i = -14; i <= 14; i += 7) line(b, [rx + i, ry - 30, rx + i, ry - 6], 2);
        if (on) { this.zig(rx - 40, ry - 70, 40, a); this.zig(rx + 10, ry - 80, 40, (a + 0.3) % 1); }
        break;
      }
      case 'wardrobe': {
        const wx = x - 30, wy = fy - 200;
        b.fillRect(wx, wy, 70, 200); b.fillRect(wx - 6, wy - 8, 82, 10);
        const open = on ? Math.min(1, a * 4) * (1 - Math.max(0, a - 0.7) * 3.3) : 0;
        if (open > 0) {
          this.knockOne(this.B, (c) => c.fillRect(wx + 36, wy + 10, 28 * open, 176));
          b.fillStyle = this.tb(0.7); b.fillRect(wx + 36, wy + 10, 28 * open, 176);
          // two eyes in the dark
          this.knockOne(this.B, (c) => { circ(c, wx + 44, wy + 70, 3.5); c.fill(); circ(c, wx + 54, wy + 70, 3.5); c.fill(); });
          b.fillStyle = INK.blue; b.fillRect(wx + 36 + 28 * open, wy + 10, 10, 176);
        }
        this.knockOne(this.B, (c) => { c.fillRect(wx + 34, wy + 6, 2, 184); });
        p.fillStyle = INK.pink; circ(p, wx + 30, wy + 100, 4); p.fill(); circ(p, wx + 40, wy + 100, 4); p.fill();
        break;
      }
      case 'curtain': {
        const cx = x, cy = fy - 230;
        this.window(cx - 40, cy, 80, 96);
        const bill = on ? Math.sin(a * Math.PI) * 26 : Math.sin(time * 0.7) * 2;
        p.fillStyle = INK.pink;
        for (const s of [-1, 1]) {
          const ex = cx + s * 54;
          p.beginPath(); p.moveTo(ex, cy - 10); p.lineTo(ex - s * 22, cy - 10);
          p.quadraticCurveTo(ex - s * (22 + bill * 0.6), cy + 60, ex - s * (14 + bill), cy + 112);
          p.lineTo(ex, cy + 112); p.fill();
        }
        b.fillRect(cx - 62, cy - 14, 124, 6);
        break;
      }
      case 'taps': {
        b.fillRect(x - 4, fy - 76, 8, 22); b.fillRect(x - 4, fy - 80, 26, 8); b.fillRect(x - 10, fy - 88, 20, 6);
        if (on) { b.fillStyle = this.tb(0.5); b.fillRect(x + 16, fy - 72, 6, 30); p.fillStyle = this.tp(0.35); for (let i = 0; i < 3; i++) { circ(p, x + 19 + (i - 1) * 8, fy - 44 - Math.abs(Math.sin(time * 9 + i)) * 10, 3); p.fill(); } }
        break;
      }
      case 'duck': {
        const hop = on ? Math.abs(Math.sin(a * Math.PI * 4)) * 26 * (1 - a) : 0;
        const dy = fy - 56 - hop;
        p.fillStyle = INK.yellow; this.y.fillStyle = INK.yellow;
        this.y.beginPath(); this.y.ellipse(x, dy - 8, 14, 9, 0, 0, 7); this.y.fill(); circ(this.y, x + 8, dy - 20, 7); this.y.fill();
        p.fillStyle = INK.pink; p.beginPath(); p.moveTo(x + 14, dy - 21); p.lineTo(x + 22, dy - 18); p.lineTo(x + 14, dy - 16); p.fill();
        b.fillStyle = INK.blue; circ(b, x + 10, dy - 22, 1.6); b.fill();
        if (on) this.zig(x, dy - 50, 30, a);
        break;
      }
      case 'mirror': {
        const mx = x, my = fy - 160;
        b.fillRect(mx - 30, my - 40, 60, 80);
        this.knockOne(this.B, (c) => { rr(c, mx - 24, my - 34, 48, 68, 4); c.fill(); });
        b.fillStyle = this.tb(0.2); rr(b, mx - 24, my - 34, 48, 68, 4); b.fill();
        if (on || o.used) {
          const fade = on ? Math.min(1, a * 3) : 0.25;
          p.globalAlpha = fade; p.fillStyle = INK.pink; p.font = '700 15px Caprasimo, Georgia, serif'; p.textAlign = 'center';
          p.fillText(['LEAVE', 'GO', 'MINE', 'OUT'][o.used % 4], mx, my + 6); p.globalAlpha = 1; p.textAlign = 'left';
        }
        break;
      }
      case 'rocker': {
        const rock = on ? Math.sin(a * Math.PI * 6) * 0.35 * (1 - a * 0.6) : Math.sin(time * 0.6) * 0.03;
        b.save(); b.translate(x, fy - 4); b.rotate(rock);
        b.lineWidth = 6; b.beginPath(); b.arc(0, -160, 162, Math.PI / 2 - 0.26, Math.PI / 2 + 0.26); b.stroke();
        b.fillRect(-26, -46, 56, 8); b.fillRect(-26, -46, 6, 44); b.fillRect(22, -46, 6, 44);
        b.save(); b.translate(22, -46); b.rotate(0.18); b.fillRect(0, -76, 7, 76); b.fillRect(-4, -80, 16, 8);
        for (let i = 0; i < 3; i++) b.fillRect(0, -70 + i * 20, 8, 3);
        b.restore(); b.restore();
        p.fillStyle = this.tp(0.5); p.save(); p.translate(x, fy - 4); p.rotate(rock); rr(p, -24, -56, 48, 12, 5); p.fill(); p.restore();
        break;
      }
      case 'musicbox': {
        const by = fy - 46;
        b.fillRect(x - 22, by - 24, 44, 24);
        const lid = on ? Math.min(1, a * 5) : 0;
        b.save(); b.translate(x - 22, by - 24); b.rotate(-lid * 1.9); b.fillRect(0, -6, 44, 6); b.restore();
        p.fillStyle = INK.pink; p.fillRect(x - 20, by - 18, 40, 4);
        if (on) {
          const spin = Math.sin(time * 8);
          b.fillRect(x - 1, by - 50, 2, 26); circ(b, x, by - 54, 4); b.fill();
          p.beginPath(); p.ellipse(x, by - 36, 10 * Math.abs(spin) + 2, 5, 0, 0, 7); p.fill();
          this.notes(x + 10, by - 60, a);
        }
        break;
      }
      case 'dummy': {
        b.fillRect(x - 3, fy - 70, 6, 70); b.fillRect(x - 20, fy - 6, 40, 6);
        p.fillStyle = INK.pink; p.beginPath(); p.moveTo(x - 20, fy - 140); p.quadraticCurveTo(x - 30, fy - 110, x - 18, fy - 70); p.lineTo(x + 18, fy - 70); p.quadraticCurveTo(x + 30, fy - 110, x + 20, fy - 140); p.fill();
        b.fillRect(x - 4, fy - 152, 8, 14);
        circ(b, x, fy - 166, 15); b.fill();
        const turn = on ? Math.min(1, a * 3) * (1 - Math.max(0, a - 0.8) * 5) : 0;
        if (turn > 0.2) {
          this.knockOne(this.B, (c) => { circ(c, x - 6 + turn * 3, fy - 168, 3.4); c.fill(); circ(c, x + 6 + turn * 3, fy - 168, 3.4); c.fill(); c.fillRect(x - 5 + turn * 3, fy - 159, 10, 2.5); });
        }
        break;
      }
      case 'record': {
        const ry = fy - 42;
        b.fillRect(x - 32, ry - 10, 64, 10);
        const sp = on ? time * 14 : 0;
        b.beginPath(); b.ellipse(x - 4, ry - 13, 26, 6, 0, 0, 7); b.fill();
        p.fillStyle = INK.pink; circ(p, x - 4 + Math.cos(sp) * 10, ry - 13 + Math.sin(sp) * 2, 3); p.fill();
        b.lineWidth = 3; line(b, [x + 26, ry - 10, x + 26, ry - 26, x + 6, ry - 18], 3);
        // the big flower horn
        b.beginPath(); b.moveTo(x + 18, ry - 24); b.lineTo(x + 34, ry - 76); b.lineTo(x + 2, ry - 70); b.closePath(); b.fill();
        p.fillStyle = this.tp(0.5); circ(p, x + 18, ry - 74, 17); p.fill();
        if (on) this.notes(x + 30, ry - 94, a);
        break;
      }
      case 'shutters': {
        const sy = fy - 230;
        this.window(x - 30, sy, 60, 90);
        const swing = on ? Math.abs(Math.sin(a * Math.PI * 5)) * (1 - a * 0.5) : 0.04;
        b.fillStyle = INK.blue;
        b.fillRect(x - 30 - 28 * (1 - swing), sy, 28 * (1 - swing) + 2, 90);
        b.fillRect(x + 30 - 2, sy, 28 * (1 - swing) + 2, 90);
        if (on) this.zig(x, sy - 30, 60, a);
        break;
      }
    }
  }

  // "!!" zigzags that say noise in comics
  zig(x, y0, w, a) {
    const p = this.p;
    p.lineWidth = 3.5; p.strokeStyle = INK.pink;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - 1) * 0.6, r0 = 14 + a * 10, r1 = r0 + 16;
      line(p, [x + Math.cos(ang) * r0, y0 + Math.sin(ang) * r0 + 20, x + Math.cos(ang) * r1, y0 + Math.sin(ang) * r1 + 20], 3.5);
    }
  }
  notes(x, y0, a) {
    const p = this.p; p.fillStyle = INK.pink;
    for (let i = 0; i < 3; i++) {
      const t = (a * 2 + i / 3) % 1, nx = x + Math.sin(t * 6 + i) * 10 + i * 8, ny = y0 - t * 40;
      p.globalAlpha = 1 - t; p.beginPath(); p.ellipse(nx, ny, 5, 3.6, -0.4, 0, 7); p.fill(); p.fillRect(nx + 3.5, ny - 16, 2, 16);
    }
    p.globalAlpha = 1;
  }

  // =============================================================== people
  gaze(g, p0, time) {
    if (p0.gone || p0.asleep || p0.role === 'toddler' || g.room(p0) < 0) return;
    const p = this.p;
    const eyeY = this.eyeY(p0);
    if (p0.role === 'dog') {
      // he sees the whole room
      const r = g.room(p0), x0 = (r & 1) * RW, fy = floorY(r >> 1);
      p.fillStyle = this.tp(0.2); p.fillRect(x0, fy - FH + 14, RW, FH - 14);
      return;
    }
    const view = (p0.role === 'torch' && p0.state === 'search') ? TORCH_VIEW : VIEW;
    const x0 = (g.room(p0) & 1) * RW;
    const ex = Math.max(x0 + 2, Math.min(x0 + RW - 2, p0.x + p0.face * view));
    p.save(); p.beginPath(); p.rect(x0, floorY(p0.f) - FH + 14, RW, FH - 14); p.clip();
    p.fillStyle = this.tp(p0.role === 'torch' && p0.state === 'search' ? 0.35 : 0.2);
    p.beginPath(); p.moveTo(p0.x + p0.face * 6, eyeY);
    p.lineTo(ex, eyeY - 70); p.lineTo(ex, eyeY + 120); p.closePath(); p.fill();
    p.beginPath(); circ(p, p0.x, eyeY, 42); p.fill();
    p.restore();
    if (p0.role === 'torch' && p0.state === 'search') {
      const y = this.y; y.fillStyle = this.ty(0.7);
      y.beginPath(); y.moveTo(p0.x + p0.face * 20, eyeY + 20); y.lineTo(ex, eyeY - 40); y.lineTo(ex, eyeY + 60); y.fill();
    }
  }

  eyeY(q) {
    const fy = q.y;
    const pose = this.pose(q);
    const h = q.role === 'toddler' ? 52 : q.role === 'dog' ? 30 : 92;
    if (pose === 'lie') return fy - 60;
    if (pose === 'bath') return fy - 64;
    if (pose === 'sit') return fy - h + 18;
    return fy - h + 6;
  }
  pose(q) {
    if (q.path || q.leaving) return 'walk';
    if (q.awakeT > 0) return 'situp';
    if (q.atAct && q.act && ACTS[q.act]) return ACTS[q.act].pose;
    return 'stand';
  }

  // lift a soft patch of ink from behind someone so they stand out from the wallpaper
  halo(g, q) {
    if (q.gone || q.x > HW || q.x < 0) return;
    const pose = this.pose(q), small = q.role === 'toddler' || q.role === 'dog';
    const cy = pose === 'lie' ? q.y - 52 : pose === 'bath' ? q.y - 62 : q.y - (small ? 26 : 52);
    const rx = pose === 'lie' ? 50 : small ? 34 : 36, ry = pose === 'lie' ? 26 : small ? 30 : 56;
    for (const L of [this.B, this.P, this.Y]) {
      const c = L.c; c.save(); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = L === this.B ? 0.75 : 0.9;
      c.beginPath(); c.ellipse(q.x, cy, rx, ry, 0, 0, 7); c.fill(); c.restore();
    }
  }

  person(g, q, time) {
    if (q.gone) return;
    const { b, p, y } = this;
    const pose = this.pose(q);
    const f = q.face;
    const jump = q.jump > 0 ? Math.sin(q.jump / 0.45 * Math.PI) * 14 : 0;
    const x = q.x, fy = q.y - jump;
    const walk = pose === 'walk' ? Math.sin(q.walkT) : 0;
    b.fillStyle = INK.blue; b.strokeStyle = INK.blue; p.fillStyle = INK.pink;
    if (q.role === 'dog') { this.dog(q, x, fy, f, walk, time); return; }
    const small = q.role === 'toddler';
    const S = small ? 0.56 : 1;
    const big = q.look === 'ron' ? 1.25 : 1;
    const tall = q.look === 'gordon' || q.look === 'femi' ? 1.07 : 1;
    const shake = q.mood === 2 ? Math.sin(time * 40) * 1.2 : 0;

    b.save(); p.save(); y.save();
    b.translate(x + shake, fy); p.translate(x + shake, fy); y.translate(x + shake, fy);
    b.scale(f * S, S * tall); p.scale(f * S, S * tall); y.scale(f * S, S * tall);

    let headY = -84, bodyTop = -66, hip = -36;
    if (pose === 'lie') {
      // tucked up in bed: just a head on the pillow and a lump under the covers
      b.restore(); p.restore(); y.restore();
      const hx = x + (q.act === 'sleepA' ? -22 : q.act === 'sleepB' ? 24 : 0) * (small ? 0.5 : 1);
      b.save(); p.save(); b.translate(hx, fy); p.translate(hx, fy);
      const hy = small ? -40 : -60;
      p.fillStyle = this.tp(0.7); rr(p, -40 * (q.act === 'sleepA' ? -1 : 1) - 32, hy + 4, 64, 22, 10); p.fill();
      b.fillStyle = INK.blue; circ(b, 0, hy, small ? 8 : 12); b.fill();
      this.hair(q, b, p, 0, hy, small ? 0.66 : 1, 1);
      b.restore(); p.restore();
      if (q.asleep) this.zzz(hx + 10, fy + hy - 20, time);
      return;
    }
    if (pose === 'bath') {
      headY = -64; bodyTop = -50;
      b.fillRect(-16, bodyTop, 32, 22);
      p.fillStyle = this.tp(0.5); for (let i = -2; i <= 2; i++) { circ(p, i * 12, -46 + Math.sin(time * 3 + i) * 2, 8); p.fill(); }
    } else if (pose === 'sit' || pose === 'situp') {
      headY = -76; bodyTop = -60; hip = -30;
      if (pose === 'situp') { headY = -78; }
      // thighs forward, shins down
      b.fillRect(-4, hip - 8, 34, 14); b.fillRect(22, hip - 6, 10, 36);
      this.torso(q, b, p, bodyTop, hip, big);
    } else {
      // standing or walking legs
      const l = walk * 12;
      line(b, [0, hip, l * 0.6, -18, l, 0], 11);
      line(b, [0, hip, -l * 0.6, -18, -l, 0], 11);
      this.torso(q, b, p, bodyTop, hip, big);
      // arms swing
      b.lineWidth = 9;
      if (q.role === 'torch' && q.state === 'search') { line(b, [2, bodyTop + 8, 22, bodyTop + 14, 34, bodyTop + 10], 9); b.fillRect(28, bodyTop + 4, 16, 10); }
      else if (q.mood === 2 && !q.leaving) { line(b, [0, bodyTop + 6, 16, bodyTop - 8, 10, headY - 6], 8); }
      else line(b, [0, bodyTop + 6, walk * 10, bodyTop + 22, walk * 14 + 4, bodyTop + 36], 8);
      if (q.leaving && !small) { b.fillRect(-36, bodyTop + 26, 26, 22); p.fillStyle = INK.pink; p.fillRect(-34, bodyTop + 28, 22, 6); }
    }
    // head
    b.fillStyle = INK.blue; circ(b, 2, headY, 14); b.fill();
    this.hair(q, b, p, 2, headY, 1, 0);
    b.restore(); p.restore(); y.restore();
    // face: knocked-out eyes, so they read as paper whites
    const ex = x + shake + f * (2 + 6) * S, ey = fy + headY * S * tall;
    const fearEyes = q.mood === 2 ? 3.4 : q.mood === 1 ? 2.8 : 2.3;
    this.knockOne(this.B, (c) => {
      circ(c, ex, ey - 1, fearEyes * S); c.fill();
      circ(c, ex - f * 7 * S, ey - 1, fearEyes * S); c.fill();
      if (q.mood === 2 || q.jump > 0.1) { c.beginPath(); c.ellipse(ex - f * 3 * S, ey + 7 * S, 3 * S, 4 * S, 0, 0, 7); c.fill(); }
    });
    if (q.look === 'hobb' || q.look === 'femi') { b.lineWidth = 1.6; circ(b, ex, ey - 1, 5); b.stroke(); circ(b, ex - f * 7, ey - 1, 5); b.stroke(); }
    if (small) { p.fillStyle = INK.pink; circ(p, ex + f * 1, ey + 5 * S, 2.5); p.fill(); }
  }

  torso(q, b, p, top, hip, big) {
    b.fillStyle = INK.blue;
    const w = 15 * big;
    rr(b, -w, top, w * 2, hip - top + 6, [12, 12, 6, 6]); b.fill();
    p.fillStyle = INK.pink;
    switch (q.look) {
      case 'hobb': p.fillStyle = this.tp(0.5); rr(p, -w, top, w * 2, hip - top + 6, 10); p.fill(); break;
      case 'ruth': case 'ada': p.beginPath(); p.moveTo(-w, top + 10); p.lineTo(w, top + 10); p.lineTo(w + 8, hip + 18); p.lineTo(-w - 8, hip + 18); p.fill(); break;
      case 'gordon': for (let i = 0; i < 3; i++) p.fillRect(-w, top + 8 + i * 10, w * 2, 4); break;
      case 'dee': p.fillRect(-w, top + 2, w * 2, 8); p.fillRect(w - 6, top + 2, 6, 26); break;
      case 'ron': p.fillStyle = this.tp(0.35); rr(p, -w, top, w * 2, hip - top + 6, 10); p.fill(); break;
      case 'kit': p.fillStyle = this.tp(0.7); rr(p, -w, top, w * 2, hip - top + 6, 10); p.fill(); break;
      case 'femi': p.fillRect(-3, top + 2, 6, hip - top); break;
      case 'bea': p.fillStyle = this.tp(0.7); rr(p, -w, top, w * 2, hip - top + 30, 10); p.fill(); break;
    }
  }

  hair(q, b, p, hx, hy, s, lying) {
    b.fillStyle = INK.blue; p.fillStyle = INK.pink;
    switch (q.look) {
      case 'hobb': p.fillStyle = this.tp(0.5); circ(p, hx - 12 * s, hy - 2 * s, 5 * s); p.fill(); break;
      case 'ruth': circ(b, hx - 12 * s, hy - 10 * s, 8 * s); b.fill(); break;
      case 'gordon': if (!lying) { b.fillRect(hx - 15 * s, hy - 16 * s, 30 * s, 7 * s); b.fillRect(hx, hy - 12 * s, 20 * s, 4 * s); p.fillRect(hx - 15 * s, hy - 16 * s, 30 * s, 3 * s); } break;
      case 'dee': for (let i = 0; i < 5; i++) { circ(b, hx - 12 * s + i * 5 * s, hy - 12 * s - (i % 2) * 3 * s, 7 * s); b.fill(); } break;
      case 'ron': b.beginPath(); b.ellipse(hx + 6 * s, hy + 10 * s, 10 * s, 8 * s, 0, 0, 7); b.fill(); break;
      case 'kit': if (!lying) { p.lineWidth = 4 * s; p.strokeStyle = INK.pink; p.beginPath(); p.arc(hx, hy, 16 * s, Math.PI * 1.05, Math.PI * 1.95); p.stroke(); p.fillRect(hx - 18 * s, hy - 6 * s, 7 * s, 12 * s); } b.beginPath(); b.arc(hx, hy, 15 * s, Math.PI * 0.9, Math.PI * 2.1); b.lineTo(hx + 15 * s, hy + 10 * s); b.fill(); break;
      case 'ada': p.beginPath(); p.ellipse(hx - 2 * s, hy - 14 * s, 15 * s, 10 * s, -0.2, 0, 7); p.fill(); break;
      case 'femi': b.fillRect(hx - 12 * s, hy - 15 * s, 24 * s, 6 * s); break;
      case 'bea': circ(b, hx - 12 * s, hy - 12 * s, 6 * s); b.fill(); circ(b, hx + 12 * s, hy - 12 * s, 6 * s); b.fill(); p.fillRect(hx - 16 * s, hy - 16 * s, 6 * s, 4 * s); break;
    }
  }

  dog(q, x, fy, f, walk, time) {
    const { b, p } = this;
    b.save(); p.save(); b.translate(x, fy); p.translate(x, fy); b.scale(f, 1); p.scale(f, 1);
    if (q.asleep) {
      b.fillStyle = INK.blue; b.beginPath(); b.ellipse(0, -12, 26, 12, 0, 0, 7); b.fill(); circ(b, 20, -14, 10); b.fill();
      p.fillStyle = INK.pink; b.restore(); p.restore(); this.zzz(x + 10, fy - 36, time); return;
    }
    const l = walk * 8;
    b.fillStyle = INK.blue;
    rr(b, -22, -34, 44, 18, 9); b.fill();
    line(b, [-14, -20, -14 + l, 0], 6); line(b, [14, -20, 14 - l, 0], 6); line(b, [-8, -20, -8 - l, 0], 6); line(b, [18, -20, 18 + l, 0], 6);
    circ(b, 24, -42, 11); b.fill(); rr(b, 26, -42, 16, 9, 4); b.fill();
    const wag = Math.sin(time * (q.jump > 0 ? 30 : 10)) * 0.6;
    b.save(); b.translate(-22, -30); b.rotate(-0.8 + wag); b.fillRect(-3, -18, 5, 18); b.restore();
    p.fillStyle = INK.pink; b.save(); p.beginPath(); p.ellipse(18, -40, 5, 10, 0.4, 0, 7); p.fill();
    p.fillRect(14, -32, 16, 4);
    b.restore();
    b.restore(); p.restore();
    this.knockOne(this.B, (c) => { circ(c, x + f * 27, fy - 45, 2.4); c.fill(); });
  }

  zzz(x, y0, time) {
    const b = this.b;
    b.fillStyle = INK.blue; b.font = '700 15px Caprasimo, Georgia, serif';
    for (let i = 0; i < 3; i++) { const t = (time * 0.5 + i / 3) % 1; b.globalAlpha = 1 - t; b.fillText('z', x + t * 18 + i * 3, y0 - t * 36); }
    b.globalAlpha = 1;
  }

  // =============================================================== the ghost
  ghost(g, time) {
    const gh = g.ghost, p = this.p;
    const x = gh.x, y0 = gh.y + Math.sin(time * 2.2) * 6;
    const busy = !!gh.target;
    p.fillStyle = INK.pink;
    p.beginPath();
    p.moveTo(x - 22, y0 + 20);
    p.arc(x, y0 - 4, 22, Math.PI, 0);
    p.lineTo(x + 22, y0 + 20);
    for (let i = 0; i < 4; i++) { const xx = x + 22 - (i + 0.5) * 11; p.quadraticCurveTo(xx + 3, y0 + 30 + Math.sin(time * 6 + i) * 4, xx - 5.5, y0 + 20); }
    p.closePath(); p.fill();
    p.fillStyle = this.tp(0.35);
    for (let i = 1; i < 4; i++) { circ(p, x - Math.sin(time * 1.5) * 10 * i, y0 + 26 + i * 12, 9 - i * 2); p.fill(); }
    this.knockOne(this.P, (c) => {
      circ(c, x - 8, y0 - 6, busy ? 5 : 4); c.fill(); circ(c, x + 8, y0 - 6, busy ? 5 : 4); c.fill();
      c.beginPath(); c.ellipse(x, y0 + 8, busy ? 6 : 3, busy ? 6 : 2, 0, 0, 7); c.fill();
    });
  }

  // markers on things: an eye if someone's watching, a little clock if it's still settling
  marks(g, time, hover, ring) {
    const { b, p } = this;
    for (const o of g.objects) {
      const mx = o.x, my = floorY(o.f) - o.hy - 46;
      const watched = g.watched(o);
      if (o === ring) {
        p.strokeStyle = INK.pink; p.lineWidth = 4; p.setLineDash([8, 7]); p.lineDashOffset = -time * 30;
        circ(p, o.x, floorY(o.f) - o.hy + 10, 56 + Math.sin(time * 5) * 5); p.stroke(); p.setLineDash([]);
      }
      if (o === hover) {
        b.strokeStyle = INK.blue; b.lineWidth = 3; b.setLineDash([5, 6]);
        circ(b, o.x, floorY(o.f) - o.hy + 10, 48); b.stroke(); b.setLineDash([]);
      }
      if (watched) {
        // an open eye
        b.fillStyle = INK.blue;
        b.beginPath(); b.moveTo(mx - 15, my); b.quadraticCurveTo(mx, my - 13, mx + 15, my); b.quadraticCurveTo(mx, my + 13, mx - 15, my); b.fill();
        this.knockOne(this.B, (c) => { circ(c, mx, my, 5.5); c.fill(); });
        p.fillStyle = INK.pink; circ(p, mx, my, 3.4); p.fill();
      } else if (o.cool > 0) {
        p.fillStyle = this.tp(0.5); p.beginPath(); p.moveTo(mx, my); p.arc(mx, my, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (o.cool / 7)); p.closePath(); p.fill();
        p.strokeStyle = INK.pink; p.lineWidth = 2; circ(p, mx, my, 10); p.stroke();
      }
    }
  }

  // screen-space overlays drawn into the inks: fear meters and speech
  overlays(g, view, toScreen, time) {
    const k = view.dpr;
    for (const L of this.layers) L.c.setTransform(k, 0, 0, k, 0, 0);
    const { b, p } = this;
    const fs = Math.round(Math.max(11, Math.min(15, view.s * 18)));
    b.font = `600 ${fs}px Literata, Georgia, serif`;
    for (const q of g.people) {
      if (q.gone) continue;
      const [sx, sy] = toScreen(q.x, this.eyeY(q) - 40);
      if (q.resident && !q.leaving) {
        const w = Math.max(30, view.s * 54), h = 7;
        const bx = sx - w / 2, by = sy - 4;
        this.knock((c) => { rr(c, bx - 2, by - 2, w + 4, h + 4, 4); c.fill(); });
        b.strokeStyle = INK.blue; b.lineWidth = 1.6; rr(b, bx, by, w, h, 3); b.stroke();
        p.fillStyle = INK.pink; rr(p, bx + 1.5, by + 1.5, Math.max(0, (w - 3) * Math.min(1, q.shown / 100)), h - 3, 2); p.fill();
      }
      if (q.say) {
        const text = q.say;
        const tw = b.measureText(text).width + 14, th = fs + 10;
        let bx = Math.max(4, Math.min(view.w / k - tw - 4, sx - tw / 2)), by = sy - th - 14;
        by = Math.max(view.top + 2, by);
        this.knock((c) => { rr(c, bx, by, tw, th, 8); c.fill(); c.beginPath(); c.moveTo(sx - 6, by + th - 1); c.lineTo(sx, by + th + 8); c.lineTo(sx + 6, by + th - 1); c.fill(); });
        b.strokeStyle = INK.blue; b.lineWidth = 1.8; rr(b, bx, by, tw, th, 8); b.stroke();
        b.fillStyle = INK.blue; b.textBaseline = 'middle'; b.fillText(text, bx + 7, by + th / 2 + 1);
      }
    }
  }
}

// draw one family member's head and shoulders into a small card canvas
export function portrait(cv, look, role, mood = 0) {
  const pt = new Painter();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 44, H = cv.clientHeight || 52;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  // head and shoulders: the slice of the figure from just over the head to the waist
  const [top, bot, left, right] = role === 'dog' ? [-58, 2, -28, 46] : role === 'toddler' ? [-66, -14, -16, 20] : [-106, -34, -24, 28];
  const k = dpr * Math.min(H / (bot - top), W / (right - left));
  const v = { k, ox: cv.width / 2 - (left + right) / 2 * k, oy: -top * k + (cv.height - (bot - top) * k) / 2, w: cv.width, h: cv.height };
  pt.begin(v);
  const q = { look, role, x: 0, y: 0, face: 1, mood, jump: 0, walkT: 0, state: 'idle', gone: false, path: null, atAct: false, act: null, awakeT: 0 };
  pt.person({ room: () => 0 }, q, 0);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = 'multiply';
  for (const L of pt.layers) c.drawImage(L.cv, L.off[0], L.off[1]);
  c.globalCompositeOperation = 'source-over';
}
