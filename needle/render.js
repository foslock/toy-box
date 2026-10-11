// Needle: drawing. Everything is in turntable units (record radius 100) under one transform, so the same
// numbers drive the sim and the picture. The vinyl itself is painted once per size into an offscreen canvas
// and spun with drawImage; the sheen stays put in the room's light while the record turns under it.
import { R_REC, R_OUT, R_IN, R_LABEL, PARTS, DUST } from './levels.js';

const TAU = Math.PI * 2;
export const FONT = "'Big Shoulders Display', 'Arial Narrow', sans-serif";
export const SERIF = "'Old Standard TT', Georgia, serif";

// label colours per record: [paper, ink, accent]
export const LABELS = {
  lesson: ['#efe3c4', '#2a2420', '#c8402a'],
  shuffle: ['#1d3c78', '#f2e6cc', '#ee8a2c'],
  stomp: ['#efb52a', '#1b1714', '#c8302a'],
  rag: ['#6e1d1f', '#f1d48a', '#f1d48a'],
};

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.cx = canvas.getContext('2d');
    this.k = 1; this.ox = 0; this.oy = 0; this.dpr = 1;
    this.fx = []; this.popups = [];
    this.recCanvas = null; this.recKey = '';
    this.sel = null; this.hi = []; this.ghost = null; this.hoverSlot = -1;
    this.shake = 0; this.wood = null;
  }

  resize(w, h, box) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = h;
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    // fit the plinth (±142) into the box the HUD and tray leave free
    const half = 142;
    this.k = Math.min(box.w / (half * 2), box.h / (half * 2));
    this.ox = box.x + box.w / 2; this.oy = box.y + box.h / 2;
    this.recKey = ''; this.wood = null;
  }
  toWorld(px, py) { return { x: (px - this.ox) / this.k, y: (py - this.oy) / this.k }; }
  toScreen(x, y) { return { x: this.ox + x * this.k, y: this.oy + y * this.k }; }

  // ---------- the vinyl, painted once
  paintRecord(g) {
    const key = g.rec.id + ':' + this.k + ':' + this.dpr + ':' + (document.fonts?.status || '');
    if (this.recKey === key) return;
    this.recKey = key;
    const px = this.k * this.dpr, S = Math.ceil(R_REC * 2 * px) + 4;
    const c = this.recCanvas || (this.recCanvas = document.createElement('canvas'));
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.setTransform(px, 0, 0, px, S / 2, S / 2);
    // body
    x.fillStyle = '#0d0c0e'; x.beginPath(); x.arc(0, 0, R_REC, 0, TAU); x.fill();
    // fine grooves, with the bands between tracks left smooth
    const n = g.tracks, bandW = (R_OUT - R_IN) / n;
    x.lineWidth = 0.35;
    for (let r = R_IN; r <= R_OUT + 3; r += 0.9) {
      const inBand = r < R_OUT && ((R_OUT - r) % bandW) > bandW - 1.6 && r > R_IN + 1;
      x.strokeStyle = inBand ? 'rgba(255,255,255,0.0)' : `rgba(255,255,255,${0.03 + 0.025 * Math.sin(r * 2.3) ** 2})`;
      x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke();
    }
    // run-out and lead-in
    x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 0.4;
    for (let r = R_LABEL + 1.5; r < R_IN - 1; r += 2.4) { x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth = 1.2;
    x.beginPath(); x.arc(0, 0, R_REC - 0.8, 0, TAU); x.stroke();
    // the groove the dust walks: a faint lighter spiral, so you can read the path
    x.strokeStyle = 'rgba(232,214,170,0.13)'; x.lineWidth = 1.1;
    x.beginPath();
    for (let phi = 0; phi <= g.phiMax; phi += 0.03) {
      const r = g.rAt(phi), a = g.localAt(phi);
      phi === 0 ? x.moveTo(Math.cos(a) * r, Math.sin(a) * r) : x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.stroke();
    // lead-in mark where the dust comes on
    const a0 = g.localAt(0);
    x.save(); x.rotate(a0);
    x.fillStyle = 'rgba(240,226,190,0.55)';
    x.beginPath(); x.moveTo(R_REC - 1, -4); x.lineTo(R_REC - 1, 4); x.lineTo(R_OUT - 2, 0); x.closePath(); x.fill();
    x.restore();
    // scratches: bright scrapes across the grooves
    for (const s of g.rec.scratches) {
      x.save(); x.rotate(s.a);
      x.strokeStyle = 'rgba(250,240,220,0.55)'; x.lineWidth = 0.7;
      x.beginPath(); x.moveTo(s.r1, -0.6); x.quadraticCurveTo((s.r1 + s.r2) / 2, 2.2, s.r2, 0.4); x.stroke();
      x.strokeStyle = 'rgba(250,240,220,0.2)'; x.lineWidth = 2.4;
      x.beginPath(); x.moveTo(s.r1, -0.6); x.quadraticCurveTo((s.r1 + s.r2) / 2, 2.2, s.r2, 0.4); x.stroke();
      x.restore();
    }
    // warps: a wavy sheen across a wedge
    for (const w of g.rec.warps) {
      for (let i = 0; i < 5; i++) {
        x.strokeStyle = `rgba(150,170,255,${0.08 + 0.03 * i})`; x.lineWidth = 2;
        x.beginPath();
        for (let a = w.a1; a <= w.a2; a += 0.02) {
          const r = R_IN + 4 + (R_OUT - R_IN - 8) * (i + 0.5) / 5 + Math.sin((a - w.a1) * 12) * 2.5;
          a === w.a1 ? x.moveTo(Math.cos(a) * r, Math.sin(a) * r) : x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        x.stroke();
      }
    }
    // label
    const [paper, ink, acc] = LABELS[g.rec.id];
    x.fillStyle = paper; x.beginPath(); x.arc(0, 0, R_LABEL, 0, TAU); x.fill();
    x.strokeStyle = acc; x.lineWidth = 1.3; x.beginPath(); x.arc(0, 0, R_LABEL - 3, 0, TAU); x.stroke();
    x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
    // title around the top of the label
    const title = g.song.title.toUpperCase();
    x.font = `800 7px ${FONT}`;
    const span = Math.min(2.6, title.length * 0.17);
    for (let i = 0; i < title.length; i++) {
      const a = -Math.PI / 2 - span / 2 + span * (i + 0.5) / title.length;
      x.save(); x.rotate(a + Math.PI / 2); x.fillText(title[i], 0, -(R_LABEL - 9)); x.restore();
    }
    x.font = `700 5px ${FONT}`; x.fillStyle = acc;
    x.fillText(`${g.rec.rpm === 33 ? '33⅓' : g.rec.rpm} RPM`, 0, 13);
    x.font = `italic 4.2px ${SERIF}`; x.fillStyle = ink;
    x.fillText(`Side A · ${g.tracks} tracks`, 0, 19.5);
    // spindle hole
    x.fillStyle = '#c9c4b8'; x.beginPath(); x.arc(0, 0, 2.2, 0, TAU); x.fill();
  }

  paintWood() {
    if (this.wood) return;
    const px = this.k * this.dpr, S = Math.ceil(290 * px);
    const c = this.wood = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.setTransform(px, 0, 0, px, S / 2, S / 2);
    const gr = x.createLinearGradient(-145, -145, 145, 145);
    gr.addColorStop(0, '#6b3f22'); gr.addColorStop(0.5, '#59321b'); gr.addColorStop(1, '#4a2915');
    x.fillStyle = gr; rr(x, -145, -145, 290, 290, 14); x.fill();
    // grain
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    x.save(); rr(x, -145, -145, 290, 290, 14); x.clip();
    for (let i = 0; i < 90; i++) {
      const y0 = -150 + rnd() * 300, amp = 2 + rnd() * 6, f = 0.01 + rnd() * 0.03, ph = rnd() * 6;
      x.strokeStyle = rnd() < 0.5 ? `rgba(30,14,6,${0.08 + rnd() * 0.14})` : `rgba(160,100,55,${0.05 + rnd() * 0.08})`;
      x.lineWidth = 0.3 + rnd() * 1.4;
      x.beginPath();
      for (let X = -150; X <= 150; X += 4) { const Y = y0 + Math.sin(X * f + ph) * amp + Math.sin(X * f * 3.1) * amp * 0.25; X === -150 ? x.moveTo(X, Y) : x.lineTo(X, Y); }
      x.stroke();
    }
    x.restore();
    // a bevel
    x.strokeStyle = 'rgba(255,220,170,0.18)'; x.lineWidth = 1.5; rr(x, -144, -144, 288, 288, 13); x.stroke();
    // the deck: dark brushed metal inset
    x.fillStyle = '#1c1a19'; rr(x, -136, -136, 272, 272, 8); x.fill();
    for (let i = 0; i < 220; i++) { x.strokeStyle = `rgba(255,255,255,${0.008 + rnd() * 0.02})`; x.lineWidth = 0.4; const y = -136 + rnd() * 272; x.beginPath(); x.moveTo(-136, y); x.lineTo(136, y); x.stroke(); }
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 1; rr(x, -136, -136, 272, 272, 8); x.stroke();
    // printed bits on the deck
    x.fillStyle = 'rgba(232,214,170,0.55)'; x.font = `800 7px ${FONT}`; x.textAlign = 'left';
    x.fillText('NEEDLE', -128, 128); x.font = `italic 4.6px ${SERIF}`; x.fillText('direct drive · quartz lock', -103, 128);
  }

  // ---------- one frame
  draw(g, dt, now) {
    const x = this.cx, k = this.k, d = this.dpr;
    this.paintRecord(g); this.paintWood();
    x.setTransform(d, 0, 0, d, 0, 0);
    // the room: a warm lamp up and to the left, falling off to near black
    const bg = x.createRadialGradient(this.w * 0.25, this.h * 0.1, 10, this.w * 0.4, this.h * 0.4, Math.max(this.w, this.h) * 0.9);
    bg.addColorStop(0, '#5a3524'); bg.addColorStop(0.45, '#2a1813'); bg.addColorStop(1, '#0f0908');
    x.fillStyle = bg; x.fillRect(0, 0, this.w, this.h);

    let sx = 0, sy = 0;
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 3); sx = (Math.random() - 0.5) * this.shake * 6; sy = (Math.random() - 0.5) * this.shake * 6; }
    x.setTransform(d * k, 0, 0, d * k, d * (this.ox + sx), d * (this.oy + sy));
    // plinth shadow and wood
    x.save(); x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 30 * k * d; x.shadowOffsetY = 10 * k * d;
    x.fillStyle = '#2a170c'; rr(x, -145, -145, 290, 290, 14); x.fill(); x.restore();
    x.drawImage(this.wood, -145, -145, 290, 290);

    // platter: aluminium rim with strobe dots that turn with it
    x.fillStyle = '#8f8b84'; x.beginPath(); x.arc(0, 0, R_REC + 6, 0, TAU); x.fill();
    const pl = x.createLinearGradient(-106, -106, 106, 106);
    pl.addColorStop(0, '#d9d5cc'); pl.addColorStop(0.45, '#8a867f'); pl.addColorStop(0.55, '#b9b5ad'); pl.addColorStop(1, '#5d5a55');
    x.strokeStyle = pl; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, R_REC + 4, 0, TAU); x.stroke();
    x.fillStyle = 'rgba(30,30,30,0.7)';
    for (let i = 0; i < 72; i++) { const a = g.angle + i * TAU / 72; x.fillRect(Math.cos(a) * (R_REC + 4.5) - 0.6, Math.sin(a) * (R_REC + 4.5) - 0.6, 1.2, 1.2); }

    // the record, turning
    x.save(); x.rotate(g.angle);
    x.drawImage(this.recCanvas, -R_REC - 2 / (k * d), -R_REC - 2 / (k * d), (R_REC * 2) + 4 / (k * d), (R_REC * 2) + 4 / (k * d));
    x.restore();
    // sheen: two soft wedges of lamp light that stay put while the record spins under them
    this.sheen(x);

    // range of the selected tower or the ghost being placed
    const showRange = (tx, ty, r, col) => {
      x.fillStyle = col + '22'; x.strokeStyle = col + 'aa'; x.lineWidth = 0.8; x.setLineDash([3, 3]);
      x.beginPath(); x.arc(tx, ty, r, 0, TAU); x.fill(); x.stroke(); x.setLineDash([]);
    };
    if (this.sel) { const P = PARTS[this.sel.part]; showRange(this.sel.x, this.sel.y, P.range[this.sel.lvl - 1], P.color); }
    if (this.ghost && this.ghost.slot >= 0) { const s = g.slots[this.ghost.slot], P = PARTS[this.ghost.part]; showRange(s.x, s.y, P.range[0], P.color); }

    // bridges
    for (const b of g.rec.bridges) this.bridge(x, b);
    // empty slots
    g.slots.forEach((s, i) => { if (!g.towerAt(i)) this.socket(x, s, this.hi.includes(i), i === this.hoverSlot, now); });

    // dust
    for (const dd of g.dust) this.dust(x, dd, now);
    // shells (kick): a ball lobbed in an arc
    for (const s of g.shells) {
      const f = s.t / s.T, px = s.x0 + (s.tx - s.x0) * f, py = s.y0 + (s.ty - s.y0) * f, h = Math.sin(f * Math.PI) * 14;
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.arc(px + 2, py + 3, 2.6, 0, TAU); x.fill();
      x.fillStyle = PARTS.kick.color; x.beginPath(); x.arc(px, py - h, 3.2, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,230,200,0.7)'; x.beginPath(); x.arc(px - 1, py - h - 1, 1.1, 0, TAU); x.fill();
    }
    // towers
    for (const t of g.towers) this.tower(x, t, t === this.sel, now);
    if (this.ghost) {
      const s = this.ghost.slot >= 0 ? g.slots[this.ghost.slot] : this.ghost;
      x.globalAlpha = 0.75; this.tower(x, { part: this.ghost.part, lvl: 1, x: s.x, y: s.y, flash: 0, aim: 0 }, false, now); x.globalAlpha = 1;
    }
    // the tone arm
    this.arm(x, g);
    // effects
    this.fx = this.fx.filter(f => (f.t += dt) < f.T);
    for (const f of this.fx) this.effect(x, f);
    // popups
    this.popups = this.popups.filter(p => (p.t += dt) < 1.1);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const p of this.popups) {
      const a = 1 - p.t / 1.1;
      x.globalAlpha = Math.min(1, a * 2);
      x.font = `800 ${p.size || 9}px ${FONT}`;
      x.lineWidth = 2.5; x.strokeStyle = 'rgba(15,10,8,0.85)'; x.strokeText(p.text, p.x, p.y - p.t * 16);
      x.fillStyle = p.color || '#f2e2b8'; x.fillText(p.text, p.x, p.y - p.t * 16);
    }
    x.globalAlpha = 1;
  }

  sheen(x) {
    for (const [a, w] of [[-2.3, 0.5], [0.84, 0.42]]) {
      for (let i = 0; i < 6; i++) {
        const ww = w * (1 - i / 7);
        x.fillStyle = `rgba(255,236,205,${0.022})`;
        x.beginPath(); x.moveTo(Math.cos(a - ww) * R_LABEL, Math.sin(a - ww) * R_LABEL);
        x.arc(0, 0, R_REC - 1, a - ww, a + ww); x.arc(0, 0, R_LABEL + 1, a + ww, a - ww, true); x.fill();
      }
    }
  }

  bridge(x, b) {
    const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1), len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
    x.save(); x.translate(b.x1, b.y1); x.rotate(ang);
    x.fillStyle = 'rgba(0,0,0,0.45)'; rr(x, -4, -4, len + 8, 12, 3); x.fill();
    const gr = x.createLinearGradient(0, -6, 0, 6);
    gr.addColorStop(0, '#e9e3d4'); gr.addColorStop(0.4, '#9a958b'); gr.addColorStop(1, '#55524d');
    x.fillStyle = gr; rr(x, -6, -5, len + 12, 10, 3); x.fill();
    x.fillStyle = '#3a3733';
    for (const e of [-2, len + 2]) { x.beginPath(); x.arc(e, 0, 1.4, 0, TAU); x.fill(); }
    x.restore();
  }

  socket(x, s, hi, hover, now) {
    const pulse = hi ? 0.5 + 0.5 * Math.sin(now * 6) : 0;
    if (hi) { x.fillStyle = `rgba(255,214,120,${0.18 + 0.25 * pulse})`; x.beginPath(); x.arc(s.x, s.y, 15 + pulse * 3, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.arc(s.x + 1, s.y + 2, 10, 0, TAU); x.fill();
    const gr = x.createRadialGradient(s.x - 3, s.y - 3, 1, s.x, s.y, 10);
    gr.addColorStop(0, '#f3d58e'); gr.addColorStop(0.6, '#b78a3e'); gr.addColorStop(1, '#6b4b1c');
    x.fillStyle = gr; x.beginPath(); x.arc(s.x, s.y, 9, 0, TAU); x.fill();
    x.fillStyle = '#17120e'; x.beginPath(); x.arc(s.x, s.y, 5.5, 0, TAU); x.fill();
    x.strokeStyle = hover ? '#fff3cf' : 'rgba(255,240,200,0.25)'; x.lineWidth = hover ? 1.4 : 0.6;
    x.beginPath(); x.arc(s.x, s.y, 9, 0, TAU); x.stroke();
    x.fillStyle = 'rgba(255,240,200,0.5)'; x.font = `800 6px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('+', s.x, s.y + 0.3);
  }

  tower(x, t, sel, now) {
    const P = PARTS[t.part], f = Math.max(0, t.flash || 0), pop = 1 + f * 0.9;
    x.save(); x.translate(t.x, t.y);
    // shadow
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.arc(1.5, 2.5, 12, 0, TAU); x.fill();
    // brass base with a chrome ring
    const gr = x.createRadialGradient(-4, -4, 1, 0, 0, 12);
    gr.addColorStop(0, '#f6dc98'); gr.addColorStop(0.55, '#c0913f'); gr.addColorStop(1, '#6e4c1a');
    x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 11.5, 0, TAU); x.fill();
    x.strokeStyle = sel ? '#fff6dc' : 'rgba(40,25,10,0.8)'; x.lineWidth = sel ? 1.6 : 0.8; x.stroke();
    // level jewels round the rim, like jukebox bulbs
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.55 + Math.PI;
      const on = i < t.lvl;
      x.fillStyle = on ? P.color : 'rgba(30,20,10,0.6)';
      x.beginPath(); x.arc(Math.cos(a) * 9.6, Math.sin(a) * 9.6, 1.5, 0, TAU); x.fill();
      if (on && f > 0) { x.fillStyle = 'rgba(255,255,230,0.8)'; x.beginPath(); x.arc(Math.cos(a) * 9.6, Math.sin(a) * 9.6, 0.8, 0, TAU); x.fill(); }
    }
    x.scale(pop, pop);
    if (t.part === 'kick') {
      // a bass drum seen from above: cream head, red hoop, a felt beater
      x.fillStyle = P.color; x.beginPath(); x.arc(0, 0, 7.5, 0, TAU); x.fill();
      x.fillStyle = '#f2e8d2'; x.beginPath(); x.arc(0, 0, 6, 0, TAU); x.fill();
      x.fillStyle = 'rgba(200,64,42,0.25)'; x.beginPath(); x.arc(0, 0, 2.6, 0, TAU); x.fill();
      x.rotate(t.aim); x.fillStyle = '#3a2a20'; x.fillRect(2, -0.7, 7, 1.4); x.fillStyle = '#e8dcc4'; x.beginPath(); x.arc(9, 0, 1.9, 0, TAU); x.fill();
    } else if (t.part === 'snare') {
      x.fillStyle = '#d9d6cf'; x.beginPath(); x.arc(0, 0, 7.5, 0, TAU); x.fill();
      x.fillStyle = '#f8f0dc'; x.beginPath(); x.arc(0, 0, 6.2, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(80,70,60,0.45)'; x.lineWidth = 0.35;
      x.rotate(t.aim);
      for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(-5, i * 1.1); x.lineTo(5, i * 1.1); x.stroke(); }
      x.fillStyle = P.color; x.fillRect(2, -0.5, 8, 1); x.fillRect(2, 1.6, 8, 1);
    } else if (t.part === 'hat') {
      const tilt = f * 6;
      x.fillStyle = '#8a6a25'; x.beginPath(); x.ellipse(0.8, 0.8, 7.5, 7.5, 0, 0, TAU); x.fill();
      const cg = x.createRadialGradient(-2, -2 - tilt * 0.2, 0.5, 0, 0, 7.5);
      cg.addColorStop(0, '#fff2b8'); cg.addColorStop(0.5, '#d9b04e'); cg.addColorStop(1, '#9c7428');
      x.fillStyle = cg; x.beginPath(); x.ellipse(0, -tilt * 0.3, 7.2, 7.2 - tilt * 0.4, 0, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(90,60,20,0.35)'; x.lineWidth = 0.3;
      for (let r = 2; r < 7; r += 1.2) { x.beginPath(); x.arc(0, -tilt * 0.3, r, 0, TAU); x.stroke(); }
      x.fillStyle = P.color; x.beginPath(); x.arc(0, -tilt * 0.3, 1.4, 0, TAU); x.fill();
    } else {
      // a speaker cone
      x.fillStyle = '#222'; x.beginPath(); x.arc(0, 0, 8, 0, TAU); x.fill();
      const cg = x.createRadialGradient(0, 0, 1, 0, 0, 7);
      cg.addColorStop(0, '#5b4a6e'); cg.addColorStop(1, '#151218');
      x.fillStyle = cg; x.beginPath(); x.arc(0, 0, 6.8 + f * 2, 0, TAU); x.fill();
      x.strokeStyle = P.color; x.lineWidth = 0.8; x.beginPath(); x.arc(0, 0, 7.2, 0, TAU); x.stroke();
      x.fillStyle = '#c9b8e4'; x.beginPath(); x.arc(0, 0, 2.2, 0, TAU); x.fill();
    }
    x.restore();
  }

  dust(x, d, now) {
    const D = DUST[d.kind], r = D.r, hit = d.hit > 0;
    x.save(); x.translate(d.x, d.y);
    const wob = now * 9 + d.wob;
    if (d.slowT > 0) { x.strokeStyle = 'rgba(170,130,230,0.7)'; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, r + 3, 0, TAU); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(1.2, 2, r, r * 0.8, 0, 0, TAU); x.fill();
    if (d.kind === 'lint') {
      // a fluffy ball with legs
      x.strokeStyle = '#7d7a75'; x.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.5, l = Math.sin(wob + i * 2) * 1.2; x.beginPath(); x.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); x.lineTo(Math.cos(a) * (r + 1.8 + l), Math.sin(a) * (r + 1.8 + l)); x.stroke(); }
      x.fillStyle = hit ? '#fff' : '#bdb8ae';
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + d.wob; x.beginPath(); x.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.62, 0, TAU); x.fill(); }
      x.fillStyle = hit ? '#fff' : '#d8d3c8'; x.beginPath(); x.arc(-0.6, -0.8, r * 0.6, 0, TAU); x.fill();
      this.eyes(x, 0, -0.4, r * 0.3, now, d);
    } else if (d.kind === 'hair') {
      x.strokeStyle = hit ? '#fff' : '#2c241e'; x.lineWidth = 1.3; x.lineCap = 'round';
      x.beginPath();
      for (let i = 0; i <= 16; i++) { const u = i / 16, a = u * 7 + wob * 0.6; const px = (u - 0.5) * r * 3, py = Math.sin(a) * r * 0.5; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
      x.strokeStyle = hit ? '#fff' : '#7a6150'; x.lineWidth = 0.5; x.stroke();
      x.fillStyle = '#e8dccb'; x.beginPath(); x.arc(r * 1.5, Math.sin(7 + wob * 0.6) * r * 0.5, 2.4, 0, TAU); x.fill();
      this.eyes(x, r * 1.5, Math.sin(7 + wob * 0.6) * r * 0.5, 1, now, d);
    } else if (d.kind === 'crumb') {
      x.rotate(d.wob);
      x.fillStyle = hit ? '#fff' : '#c58a3e';
      x.beginPath(); const pts = 7;
      for (let i = 0; i < pts; i++) { const a = i * TAU / pts, rr2 = r * (0.8 + 0.25 * Math.sin(i * 2.7 + d.wob * 3)); i ? x.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : x.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,220,150,0.5)'; x.beginPath(); x.arc(-2, -2, r * 0.35, 0, TAU); x.fill();
      x.fillStyle = 'rgba(90,50,20,0.5)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(Math.cos(i * 1.7) * r * 0.5, Math.sin(i * 1.7) * r * 0.5, 0.7, 0, TAU); x.fill(); }
      x.rotate(-d.wob);
      this.eyes(x, 0, 0, r * 0.3, now, d);
    } else if (d.kind === 'spark') {
      const fl = 0.6 + 0.4 * Math.sin(now * 40 + d.wob * 7);
      x.strokeStyle = hit ? '#fff' : `rgba(160,210,255,${fl})`; x.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + now * 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); x.lineTo(Math.cos(a + 0.3) * r * 1.3, Math.sin(a + 0.3) * r * 1.3); x.stroke(); }
      x.fillStyle = '#e8f4ff'; x.beginPath(); x.arc(0, 0, r * 0.55, 0, TAU); x.fill();
      this.eyes(x, 0, 0, r * 0.25, now, d);
    } else {
      // a greasy thumbprint, whorled
      x.rotate(d.wob);
      x.fillStyle = hit ? 'rgba(255,255,255,0.5)' : 'rgba(190,175,150,0.28)'; x.beginPath(); x.ellipse(0, 0, r, r * 1.25, 0, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(225,210,185,0.55)'; x.lineWidth = 0.7;
      for (let i = 1; i < 6; i++) { x.beginPath(); x.ellipse(0.4 * i, 0, r * i / 6, r * 1.25 * i / 6, 0, 0.3, TAU - 0.3); x.stroke(); }
      x.rotate(-d.wob);
      this.eyes(x, 0, -2, 2.6, now, d);
    }
    // health, once hurt
    if (d.hp < d.max) {
      const f = Math.max(0, d.hp / d.max);
      x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r + 2.5, -Math.PI * 0.8, -Math.PI * 0.2); x.stroke();
      x.strokeStyle = f > 0.5 ? '#e9e0c0' : f > 0.25 ? '#efb24a' : '#e2553a'; x.lineWidth = 1.2;
      x.beginPath(); x.arc(0, 0, r + 2.5, -Math.PI * 0.8, -Math.PI * 0.8 + Math.PI * 0.6 * f); x.stroke();
    }
    x.restore();
  }
  eyes(x, cx, cy, s, now, d) {
    const blink = ((now + d.wob) % 3.2) < 0.12;
    const look = Math.atan2(-d.y, -d.x);   // they all stare at the label
    for (const e of [-1, 1]) {
      const ex = cx + e * s * 1.1, ey = cy;
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(ex, ey, s * 0.85, blink ? s * 0.15 : s * 0.9, 0, 0, TAU); x.fill();
      if (!blink) { x.fillStyle = '#111'; x.beginPath(); x.arc(ex + Math.cos(look) * s * 0.35, ey + Math.sin(look) * s * 0.35, s * 0.42, 0, TAU); x.fill(); }
    }
  }

  arm(x, g) {
    // pivot in the top-right corner; the needle sits in the band of the track that's playing
    const px = 118, py = -118, L = 150;
    const n = g.tracks;
    let prog = g.track < 0 ? 0 : g.track + 1;
    if (g.state === 'track' && this.trackTotal) prog = g.track + Math.min(1, 1 - (g.queue.length + g.dust.length) / this.trackTotal);
    if (g.state === 'won') prog = n;
    const target = g.state === 'between' && g.track < 0 ? R_REC + 4 : R_OUT - (R_OUT - R_IN) * Math.min(1, prog / n) - 1;
    this.armR = this.armR == null ? target : this.armR + (target - this.armR) * 0.06;
    const r = this.armR, D = Math.hypot(px, py);
    // circle(origin, r) ∩ circle(pivot, L)
    const a = (D * D + r * r - L * L) / (2 * D), h = Math.sqrt(Math.max(0, r * r - a * a));
    const ux = px / D, uy = py / D;
    const nx = ux * a - uy * h, ny = uy * a + ux * h;
    // shadow
    x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(px + 4, py + 6); x.lineTo(nx + 4, ny + 6); x.stroke();
    // base
    x.fillStyle = '#2a2826'; x.beginPath(); x.arc(px, py, 13, 0, TAU); x.fill();
    const bg = x.createRadialGradient(px - 3, py - 3, 1, px, py, 10);
    bg.addColorStop(0, '#f0ece2'); bg.addColorStop(1, '#77736b');
    x.fillStyle = bg; x.beginPath(); x.arc(px, py, 9, 0, TAU); x.fill();
    // counterweight
    const bx = px + (px - nx) / L * 18, by = py + (py - ny) / L * 18;
    x.strokeStyle = '#cfcac0'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(px, py); x.lineTo(bx, by); x.stroke();
    x.fillStyle = '#3b3936'; x.beginPath(); x.arc(bx, by, 5, 0, TAU); x.fill();
    // arm
    const ag = x.createLinearGradient(px, py, nx, ny);
    ag.addColorStop(0, '#f2eee6'); ag.addColorStop(1, '#a7a299');
    x.strokeStyle = ag; x.lineWidth = 2.4; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
    // headshell
    const ang = Math.atan2(ny - py, nx - px);
    x.save(); x.translate(nx, ny); x.rotate(ang + 0.35);
    x.fillStyle = '#1c1b1a'; rr(x, -3, -3.5, 10, 7, 1.5); x.fill();
    x.fillStyle = '#c8402a'; x.fillRect(1, -1, 3, 2);
    x.restore();
  }

  effect(x, f) {
    const u = f.t / f.T;
    if (f.kind === 'boom') {
      x.strokeStyle = `rgba(255,170,120,${1 - u})`; x.lineWidth = 2 * (1 - u) + 0.4;
      x.beginPath(); x.arc(f.x, f.y, f.r * (0.4 + u * 0.8), 0, TAU); x.stroke();
      x.fillStyle = `rgba(255,220,180,${0.3 * (1 - u)})`; x.beginPath(); x.arc(f.x, f.y, f.r * 0.6 * (1 - u), 0, TAU); x.fill();
    } else if (f.kind === 'crack') {
      x.strokeStyle = `rgba(255,244,210,${1 - u})`; x.lineWidth = 1.4 * (1 - u) + 0.3;
      x.beginPath(); x.moveTo(f.x0, f.y0);
      const n = 5;
      for (let i = 1; i < n; i++) { const t = i / n; x.lineTo(f.x0 + (f.x - f.x0) * t + f.j[i] * 4, f.y0 + (f.y - f.y0) * t + f.j[i + 5] * 4); }
      x.lineTo(f.x, f.y); x.stroke();
    } else if (f.kind === 'tick') {
      x.strokeStyle = `rgba(150,230,220,${1 - u})`; x.lineWidth = 0.9;
      const t0 = Math.max(0, u * 1.6 - 0.6), t1 = Math.min(1, u * 1.6);
      x.beginPath(); x.moveTo(f.x0 + (f.x - f.x0) * t0, f.y0 + (f.y - f.y0) * t0); x.lineTo(f.x0 + (f.x - f.x0) * t1, f.y0 + (f.y - f.y0) * t1); x.stroke();
    } else if (f.kind === 'wave') {
      x.strokeStyle = `rgba(190,150,250,${0.7 * (1 - u)})`; x.lineWidth = 2.2 * (1 - u) + 0.3;
      x.beginPath(); x.arc(f.x, f.y, 10 + (f.r - 10) * u, 0, TAU); x.stroke();
    } else if (f.kind === 'puff') {
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + f.seed, rr2 = 3 + u * 12;
        x.fillStyle = `rgba(220,210,190,${0.6 * (1 - u)})`;
        x.beginPath(); x.arc(f.x + Math.cos(a) * rr2, f.y + Math.sin(a) * rr2, 2.2 * (1 - u) + 0.5, 0, TAU); x.fill();
      }
    } else if (f.kind === 'skip') {
      x.strokeStyle = `rgba(255,90,60,${1 - u})`; x.lineWidth = 2.5;
      x.beginPath(); x.arc(0, 0, R_LABEL + 2 + u * 12, 0, TAU); x.stroke();
    } else if (f.kind === 'blink') {
      x.fillStyle = `rgba(170,215,255,${0.8 * (1 - u)})`; x.beginPath(); x.arc(f.x, f.y, 3 + 8 * u, 0, TAU); x.fill();
    }
  }
}

export function rr(x, X, Y, w, h, r) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}
