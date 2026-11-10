// Mirror Knight — ink-on-black canvas renderer.
import { ARENA_R, habitCount } from './game.js';

const TAU = Math.PI * 2;
export const INK = '#0b0b0a', BONE = '#ebe5d6', BLOOD = '#c02a1d';
const BLADE = { sword: 44, great: 60, spear: 86, bow: 0, seal: 0 };

function noiseCanvas(n = 192) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d'), d = x.createImageData(n, n);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
}

export class View {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, s: 1 }; this.fx = []; this.trails = []; this.ghosts = []; this.shake = 0;
    this.noise = noiseCanvas(); this.arenaKey = ''; this.flash = 0;
    this.grain = null;
  }
  resize(w, h, dpr, pad) {
    this.w = w; this.h = h; this.dpr = dpr; this.pad = pad;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
    this.grain = this.x.createPattern(this.noise, 'repeat');
  }
  playRect() { const p = this.pad || { t: 0, b: 0 }; return { x: 0, y: p.t, w: this.w, h: Math.max(100, this.h - p.t - p.b) }; }

  // ------------------------------------------------------ arena, baked once per scale
  bakeArena(s) {
    const key = s.toFixed(3) + ':' + this.dpr;
    if (key === this.arenaKey) return; this.arenaKey = key;
    const R = ARENA_R + 70, px = Math.ceil(R * 2 * s * this.dpr);
    const c = this.arena = document.createElement('canvas'); c.width = c.height = px;
    const x = c.getContext('2d'); x.scale(s * this.dpr, s * this.dpr); x.translate(R, R);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // floor stones
    x.fillStyle = '#151513'; x.beginPath(); x.arc(0, 0, ARENA_R, 0, TAU); x.fill();
    const rings = [0, 70, 140, 215, ARENA_R];
    for (let i = 1; i < rings.length; i++) {
      const r0 = rings[i - 1], r1 = rings[i], n = i === 1 ? 1 : 8 + i * 6, off = rnd() * TAU;
      for (let j = 0; j < n; j++) {
        const a0 = off + j / n * TAU, a1 = off + (j + 1) / n * TAU;
        const v = 20 + Math.floor(rnd() * 10);
        x.fillStyle = `rgb(${v},${v},${v - 2})`;
        x.beginPath(); x.arc(0, 0, r1 - 1.5, a0 + .004, a1 - .004); if (r0 > 0) x.arc(0, 0, r0 + 1.5, a1 - .004, a0 + .004, true); else x.lineTo(0, 0); x.closePath(); x.fill();
        // wear marks
        for (let m = 0; m < 3; m++) {
          const a = a0 + rnd() * (a1 - a0), r = r0 + rnd() * (r1 - r0);
          x.strokeStyle = `rgba(235,229,214,${.03 + rnd() * .04})`; x.lineWidth = .8;
          x.beginPath(); x.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          const L = 6 + rnd() * 16, b = rnd() * TAU; x.lineTo(Math.cos(a) * r + Math.cos(b) * L, Math.sin(a) * r + Math.sin(b) * L); x.stroke();
        }
      }
    }
    // the mirror sigil in the middle
    x.strokeStyle = 'rgba(235,229,214,.16)'; x.lineWidth = 2;
    x.beginPath(); x.arc(0, 0, 46, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(0, -60); x.lineTo(0, 60); x.stroke();
    x.beginPath(); x.arc(-14, 0, 22, Math.PI * .5, Math.PI * 1.5); x.stroke();
    x.beginPath(); x.arc(14, 0, 22, -Math.PI * .5, Math.PI * .5); x.stroke();
    // chalk edge
    x.strokeStyle = 'rgba(235,229,214,.55)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, ARENA_R, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(235,229,214,.18)'; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, ARENA_R - 8, 0, TAU); x.stroke();
    // pillars
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU + .1, r = ARENA_R + 34, px2 = Math.cos(a) * r, py = Math.sin(a) * r;
      x.fillStyle = 'rgba(0,0,0,.6)'; x.beginPath(); x.ellipse(px2 + 6, py + 8, 20, 18, 0, 0, TAU); x.fill();
      x.fillStyle = '#d9d2c1'; x.strokeStyle = INK; x.lineWidth = 2.5;
      x.beginPath(); x.arc(px2, py, 19, 0, TAU); x.fill(); x.stroke();
      // hatching on the shadowed side
      x.save(); x.beginPath(); x.arc(px2, py, 17.5, 0, TAU); x.clip();
      x.strokeStyle = 'rgba(11,11,10,.55)'; x.lineWidth = 1.4;
      for (let h = -24; h < 24; h += 4.5) { x.beginPath(); x.moveTo(px2 + h, py + 20); x.lineTo(px2 + h + 20, py - 20); x.stroke(); }
      x.restore();
      x.fillStyle = '#d9d2c1'; x.beginPath(); x.arc(px2 - 4, py - 4, 11, 0, TAU); x.fill();
      x.strokeStyle = INK; x.lineWidth = 1.5; x.beginPath(); x.arc(px2 - 4, py - 4, 11, 0, TAU); x.stroke();
    }
    this.arenaR = R;
  }

  // ------------------------------------------------------ effects from events
  ingest(g, events) {
    for (const e of events) {
      if (e.type === 'act' && (e.kind === 'melee' || e.kind === 'whirl' || e.kind === 'nova' || e.kind === 'triple')) {
        const f = e.who === 'p' ? g.p : g.k;
        this.trails.push({ f, t: 0, life: .26, face: e.face, arc: e.kind === 'nova' || e.kind === 'whirl' ? 360 : e.arc, reach: e.reach, accent: f.w.accent, nova: e.kind === 'nova', thrust: (e.arc || 0) < 40 });
      } else if (e.type === 'hit') {
        const n = e.who === 'k' ? 9 : 12;
        for (let i = 0; i < n; i++) {
          const a = (e.ang ?? Math.random() * TAU) + (Math.random() - .5) * 1.6, sp = 80 + Math.random() * 200;
          this.fx.push({ k: e.who === 'k' ? 'shard' : 'blood', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: .35 + Math.random() * .4, r: 1.5 + Math.random() * 3, rot: Math.random() * TAU });
        }
        if (e.who === 'p') for (let i = 0; i < 4; i++) this.fx.push({ k: 'stain', x: e.x + (Math.random() - .5) * 30, y: e.y + (Math.random() - .5) * 30, t: 0, life: 6, r: 2 + Math.random() * 4 });
        this.shake = Math.max(this.shake, e.heavy ? 9 : 5);
      } else if (e.type === 'evade') {
        this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, life: .3, r: 22, col: 'rgba(235,229,214,' });
      } else if (e.type === 'dodge') {
        const f = e.who === 'p' ? g.p : g.k;
        for (let i = 0; i < 6; i++) this.fx.push({ k: 'dust', x: f.x + (Math.random() - .5) * 16, y: f.y + (Math.random() - .5) * 16, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, t: 0, life: .5, r: 4 + Math.random() * 5 });
      } else if (e.type === 'phase' || e.type === 'break') {
        this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, life: e.type === 'phase' ? .8 : .45, r: e.type === 'phase' ? 160 : 60, col: 'rgba(235,229,214,' });
        this.shake = 12; this.flash = e.type === 'phase' ? .5 : .2;
        if (e.type === 'phase') for (let i = 0; i < 24; i++) { const a = Math.random() * TAU, sp = 120 + Math.random() * 240; this.fx.push({ k: 'shard', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: .6 + Math.random() * .5, r: 2 + Math.random() * 3, rot: a }); }
      } else if (e.type === 'zone') {
        this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, life: .35, r: e.kind === 'slam' ? 95 : 55, col: 'rgba(235,229,214,' });
        this.shake = Math.max(this.shake, 6);
      } else if (e.type === 'heal') {
        this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, life: .5, r: 30, col: 'rgba(233,162,59,' });
      } else if (e.type === 'won') {
        for (let i = 0; i < 70; i++) { const a = Math.random() * TAU, sp = 60 + Math.random() * 380; this.fx.push({ k: 'shard', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 1 + Math.random() * 1.4, r: 2 + Math.random() * 5, rot: a }); }
        this.flash = 1; this.shake = 16;
      }
    }
  }

  // ------------------------------------------------------ frame
  frame(g, dt, opt = {}) {
    const x = this.x, { w, h, dpr } = this;
    const pr = this.playRect();
    // camera: frame both fighters, lean on the player
    const s = Math.max(.5, Math.min(1.8, Math.min(pr.w, pr.h) / 470));
    const tx = g.p.x * .55 + g.k.x * .45, ty = g.p.y * .55 + g.k.y * .45;
    const lim = Math.max(0, ARENA_R + 40 - Math.min(pr.w, pr.h) / s / 2);
    const cx = Math.max(-lim, Math.min(lim, tx)), cy = Math.max(-lim, Math.min(lim, ty));
    const k = 1 - Math.pow(.02, dt);
    this.cam.x += (cx - this.cam.x) * k; this.cam.y += (cy - this.cam.y) * k; this.cam.s = s;
    if (opt.snap) { this.cam.x = cx; this.cam.y = cy; }
    this.bakeArena(s);
    this.shake = Math.max(0, this.shake - dt * 40); this.flash = Math.max(0, this.flash - dt * 1.6);
    const sh = this.shake * (opt.reduce ? .3 : 1);
    const ox = pr.x + pr.w / 2 - this.cam.x * s + (Math.random() - .5) * sh, oy = pr.y + pr.h / 2 - this.cam.y * s + (Math.random() - .5) * sh;

    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#050505'; x.fillRect(0, 0, w, h);
    x.drawImage(this.arena, ox - this.arenaR * s, oy - this.arenaR * s, this.arenaR * 2 * s, this.arenaR * 2 * s);
    x.setTransform(dpr * s, 0, 0, dpr * s, ox * dpr, oy * dpr);

    // floor-level effects
    for (const f of this.fx) if (f.k === 'stain') { x.fillStyle = `rgba(150,30,22,${.5 * Math.min(1, (f.life - f.t) / 2)})`; x.beginPath(); x.arc(f.x, f.y, f.r, 0, TAU); x.fill(); }
    if (opt.mark) this.drawMark(opt.mark, g.t);
    this.drawZones(g);
    this.drawTelegraph(g, g.k);
    if (opt.showPlayerTelegraph) this.drawTelegraph(g, g.p);
    // ghosts (dodge afterimages)
    for (const f of [g.p, g.k]) if (f.state === 'dodge' && Math.random() < .9) this.ghosts.push({ x: f.x, y: f.y, face: f.face, t: 0, k: f.side });
    for (const gh of this.ghosts) { gh.t += dt; x.globalAlpha = Math.max(0, .35 - gh.t * 1.3); this.body(gh.k === 'k' ? g.k : g.p, gh.x, gh.y, gh.face, true); }
    x.globalAlpha = 1; this.ghosts = this.ghosts.filter(gh => gh.t < .28);
    // trails under bodies
    for (const t of this.trails) { t.t += dt; this.drawTrail(t); }
    this.trails = this.trails.filter(t => t.t < t.life);
    // bodies: draw the one further up first
    const order = g.p.y < g.k.y ? [g.p, g.k] : [g.k, g.p];
    for (const f of order) this.drawFighter(g, f);
    this.drawShots(g);
    // particles
    for (const f of this.fx) {
      f.t += dt; if (f.k === 'stain') continue;
      const u = f.t / f.life;
      if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.pow(.02, dt); f.vy *= Math.pow(.02, dt); }
      if (f.k === 'shard') {
        x.save(); x.translate(f.x, f.y); x.rotate(f.rot + f.t * 6); x.globalAlpha = 1 - u;
        x.fillStyle = BONE; x.beginPath(); x.moveTo(-f.r, -f.r * .4); x.lineTo(f.r * 1.4, 0); x.lineTo(-f.r * .4, f.r); x.closePath(); x.fill(); x.restore();
      } else if (f.k === 'blood') {
        x.fillStyle = `rgba(192,42,29,${1 - u})`; x.beginPath(); x.arc(f.x, f.y, f.r * (1 - u * .5), 0, TAU); x.fill();
      } else if (f.k === 'dust') {
        x.fillStyle = `rgba(235,229,214,${.18 * (1 - u)})`; x.beginPath(); x.arc(f.x, f.y, f.r * (1 + u), 0, TAU); x.fill();
      } else if (f.k === 'ring') {
        x.strokeStyle = f.col + (1 - u) * .8 + ')'; x.lineWidth = 3 * (1 - u) + .5;
        x.beginPath(); x.arc(f.x, f.y, f.r * (.3 + u * .9), 0, TAU); x.stroke();
      }
    }
    this.fx = this.fx.filter(f => f.t < f.life);

    // screen layers: vignette, flash, grain
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = x.createRadialGradient(w / 2, pr.y + pr.h / 2, Math.min(w, h) * .3, w / 2, pr.y + pr.h / 2, Math.max(w, h) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)');
    x.fillStyle = vg; x.fillRect(0, 0, w, h);
    if (g.p.hp > 0 && g.p.hp < 30 && !g.over) { x.fillStyle = `rgba(150,20,14,${.12 + .06 * Math.sin(g.t * 6)})`; x.fillRect(0, 0, w, h); }
    if (this.flash > 0) { x.fillStyle = `rgba(235,229,214,${this.flash * .5})`; x.fillRect(0, 0, w, h); }
    x.globalAlpha = .07; x.fillStyle = this.grain; x.save(); x.translate((Math.random() * 192) | 0, (Math.random() * 192) | 0); x.fillRect(-192, -192, w + 384, h + 384); x.restore(); x.globalAlpha = 1;
  }

  drawMark(m, t) {
    const x = this.x, pulse = 1 + Math.sin(t * 4) * .06;
    x.strokeStyle = 'rgba(235,229,214,.8)'; x.lineWidth = 2; x.setLineDash([6, 6]); x.lineDashOffset = -t * 20;
    x.beginPath(); x.arc(m.x, m.y, m.r * pulse, 0, TAU); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(235,229,214,.08)'; x.beginPath(); x.arc(m.x, m.y, m.r * pulse, 0, TAU); x.fill();
  }

  drawZones(g) {
    const x = this.x;
    for (const z of g.zones) {
      if (z.t < 0) {
        const u = 1 - Math.min(1, -z.t / .8);
        x.strokeStyle = z.accent; x.globalAlpha = .4 + u * .5; x.lineWidth = 2; x.setLineDash([5, 5]);
        x.beginPath(); x.arc(z.x, z.y, z.r, 0, TAU); x.stroke(); x.setLineDash([]);
        x.fillStyle = z.accent; x.globalAlpha = u * .25; x.beginPath(); x.arc(z.x, z.y, z.r * u, 0, TAU); x.fill(); x.globalAlpha = 1;
      } else {
        const u = z.t / (z.life + .4);
        const gr = x.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
        gr.addColorStop(0, BONE); gr.addColorStop(.5, z.accent); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.globalAlpha = Math.max(0, 1 - u); x.fillStyle = gr; x.beginPath(); x.arc(z.x, z.y, z.r, 0, TAU); x.fill(); x.globalAlpha = 1;
      }
    }
  }

  drawTelegraph(g, f) {
    if (!f.a || f.a.ph !== 'wind' || f.state !== 'attack') return;
    const x = this.x, a = f.a, def = a.def, wind = g.windOf(f, def), u = Math.min(1, a.t / wind);
    const big = a.tag !== 'light' && a.tag !== 'bash';
    x.save(); x.translate(f.x, f.y); x.rotate(f.face);
    x.strokeStyle = f.w.accent; x.fillStyle = f.w.accent;
    if (a.tag === 'lunge') {
      const L = def.step + def.reach, wd = 26;
      x.globalAlpha = .2 + .25 * u; x.fillRect(0, -wd, L * u, wd * 2);
      x.globalAlpha = .7; x.lineWidth = 1.5; x.setLineDash([6, 5]); x.strokeRect(0, -wd, L, wd * 2); x.setLineDash([]);
    } else if (def.kind === 'melee' || def.kind === 'whirl' || def.kind === 'nova' || def.kind === 'triple') {
      const r = def.reach + (def.kind === 'triple' ? def.step * .5 : 0), half = Math.min(Math.PI, (def.arc || 360) / 2 * Math.PI / 180);
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, r, -half, half); x.closePath();
      x.globalAlpha = big ? .1 + .3 * u : .08 + .1 * u; x.fill();
      x.globalAlpha = big ? .85 : .4; x.lineWidth = big ? 2 : 1.2; if (!big) x.setLineDash([4, 5]); x.stroke(); x.setLineDash([]);
    } else if (def.kind === 'slam') {
      x.translate(def.reach * .8, 0);
      x.globalAlpha = .1 + .3 * u; x.beginPath(); x.arc(0, 0, def.radius * u, 0, TAU); x.fill();
      x.globalAlpha = .85; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, def.radius, 0, TAU); x.stroke();
    } else if (def.kind === 'shot' || def.kind === 'volley') {
      x.globalAlpha = .25 + .4 * u; x.lineWidth = big ? 2 : 1; x.setLineDash([3, 7]);
      const spreads = def.kind === 'volley' ? [-.32, -.16, 0, .16, .32] : [0];
      for (const sp of spreads) { x.beginPath(); x.moveTo(20, 0); x.lineTo(Math.cos(sp) * 260, Math.sin(sp) * 260); x.stroke(); }
      x.setLineDash([]);
    }
    x.restore();
    // glint on the weapon at the start of every wind-up
    if (a.t < .2 && f.side === 'k') {
      const tip = this.tip(f), gs = (1 - a.t / .2) * (big ? 14 : 9);
      this.star(tip.x, tip.y, gs, big ? f.w.accent : BONE);
    }
  }

  star(cx, cy, r, col) {
    const x = this.x; x.fillStyle = col; x.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .22 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fill();
  }

  // weapon angle (world) and extension for the current pose
  pose(f) {
    const a = f.a, def = a?.def;
    let ang = f.face + .55, ext = 0;
    if (f.state === 'attack' && def) {
      const half = (def.arc || 90) / 2 * Math.PI / 180;
      const thrust = def.kind === 'triple' || (def.arc && def.arc < 40) || f.w.id === 'spear' && def.kind === 'melee';
      if (def.kind === 'whirl') ang = f.face + .3;
      else if (thrust) { ang = f.face; ext = a.ph === 'wind' ? -12 : a.ph === 'act' ? 14 : 4; }
      else if (def.kind === 'melee') {
        const sw = Math.min(half, Math.PI * .8);
        if (a.ph === 'wind') ang = f.face - sw - .3;
        else if (a.ph === 'act') ang = f.face - sw + 2 * sw * Math.min(1, a.t / def.act);
        else ang = f.face + sw;
      } else ang = f.face;
    }
    return { ang, ext };
  }
  tip(f) {
    const { ang, ext } = this.pose(f), L = (BLADE[f.w.id] || 18) + ext;
    const hx = f.x + Math.cos(f.face + 1.1) * f.r * .8, hy = f.y + Math.sin(f.face + 1.1) * f.r * .8;
    return { x: hx + Math.cos(ang) * L, y: hy + Math.sin(ang) * L };
  }

  drawTrail(t) {
    const x = this.x, f = t.f, u = t.t / t.life;
    x.save(); x.translate(f.x, f.y);
    x.globalAlpha = (1 - u) * .7;
    if (t.nova) {
      x.strokeStyle = t.accent; x.lineWidth = 10 * (1 - u) + 2; x.beginPath(); x.arc(0, 0, t.reach * (.5 + u * .5), 0, TAU); x.stroke();
    } else if (t.thrust) {
      x.rotate(f.face); x.fillStyle = t.accent;
      x.beginPath(); x.moveTo(f.r, -3); x.lineTo(t.reach + 6, 0); x.lineTo(f.r, 3); x.closePath(); x.fill();
    } else {
      const half = Math.min(Math.PI, t.arc / 2 * Math.PI / 180);
      x.rotate(t.arc >= 360 ? f.face : t.face);
      x.fillStyle = t.accent;
      x.beginPath(); x.arc(0, 0, t.reach, -half, half); x.arc(0, 0, t.reach * .55, half, -half, true); x.closePath(); x.fill();
      x.strokeStyle = BONE; x.globalAlpha = (1 - u) * .9; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, t.reach, -half, half); x.stroke();
    }
    x.restore();
  }

  drawShots(g) {
    const x = this.x;
    for (const s of g.shots) {
      const a = Math.atan2(s.vy, s.vx);
      x.save(); x.translate(s.x, s.y); x.rotate(a);
      if (s.kind === 'seal') {
        x.fillStyle = s.accent; x.globalAlpha = .35; x.beginPath(); x.arc(0, 0, 9, 0, TAU); x.fill();
        x.globalAlpha = 1; x.fillStyle = BONE; x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill();
        x.strokeStyle = s.accent; x.lineWidth = 2; x.beginPath(); x.moveTo(-4, 0); x.lineTo(-22, 0); x.stroke();
      } else {
        x.strokeStyle = BONE; x.lineWidth = s.heavy ? 3 : 2; x.beginPath(); x.moveTo(-18, 0); x.lineTo(6, 0); x.stroke();
        x.fillStyle = s.accent; x.beginPath(); x.moveTo(10, 0); x.lineTo(3, -4); x.lineTo(3, 4); x.closePath(); x.fill();
        x.strokeStyle = s.accent; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-18, -4); x.lineTo(-13, 0); x.lineTo(-18, 4); x.stroke();
      }
      x.restore();
    }
  }

  body(f, px, py, face, ghost) {
    const x = this.x, r = f.r, knight = f.side === 'k';
    x.save(); x.translate(px, py); x.rotate(face);
    const fill = knight ? INK : BONE, line = knight ? BONE : INK;
    if (ghost) { x.fillStyle = knight ? BONE : BONE; x.beginPath(); x.ellipse(0, 0, r * .62, r * 1.08, 0, 0, TAU); x.fill(); x.restore(); return; }
    // cape / cloak trailing behind
    x.fillStyle = knight ? '#1d1d1b' : '#cfc7b4'; x.strokeStyle = line; x.lineWidth = 2;
    x.beginPath(); x.moveTo(-r * .2, -r * .95); x.quadraticCurveTo(-r * 1.6, 0, -r * .2, r * .95); x.closePath(); x.fill(); x.stroke();
    // shoulders
    x.fillStyle = fill; x.beginPath(); x.ellipse(0, 0, r * .62, r * 1.08, 0, 0, TAU); x.fill(); x.stroke();
    if (knight) {
      // pauldrons
      x.beginPath(); x.arc(0, -r * .78, r * .38, 0, TAU); x.fill(); x.stroke();
      x.beginPath(); x.arc(0, r * .78, r * .38, 0, TAU); x.fill(); x.stroke();
    }
    // head
    x.fillStyle = fill; x.beginPath(); x.arc(r * .12, 0, r * .48, 0, TAU); x.fill(); x.stroke();
    if (knight) {
      // the mirror visor
      x.strokeStyle = BONE; x.lineWidth = 2.5; x.beginPath(); x.moveTo(r * .48, -r * .3); x.lineTo(r * .48, r * .3); x.stroke();
    } else {
      x.fillStyle = INK; x.beginPath(); x.arc(r * .3, 0, r * .12, 0, TAU); x.fill();
    }
    x.restore();
  }

  drawWeapon(f) {
    const x = this.x, { ang, ext } = this.pose(f), id = f.w.id;
    const hx = f.x + Math.cos(f.face + 1.1) * f.r * .8, hy = f.y + Math.sin(f.face + 1.1) * f.r * .8;
    const line = f.side === 'k' ? BONE : INK;
    x.save(); x.translate(hx, hy); x.rotate(ang);
    if (id === 'bow') {
      x.rotate(f.face - ang);
      const drawn = f.a && f.a.ph === 'wind' ? Math.min(1, f.a.t / .3) : 0;
      x.strokeStyle = line; x.lineWidth = 4.5; x.beginPath(); x.arc(-4, 0, 16, -1.1, 1.1); x.stroke();
      x.strokeStyle = f.w.accent; x.lineWidth = 2.5; x.beginPath(); x.arc(-4, 0, 16, -1.1, 1.1); x.stroke();
      x.strokeStyle = 'rgba(235,229,214,.8)'; x.lineWidth = 1;
      const ex = -4 + Math.cos(1.1) * 16, ey = Math.sin(1.1) * 16;
      x.beginPath(); x.moveTo(ex, -ey); x.lineTo(ex - drawn * 12, 0); x.lineTo(ex, ey); x.stroke();
    } else if (id === 'seal') {
      const glow = f.a && f.a.ph !== 'rec' ? 1 : .4;
      x.fillStyle = f.w.accent; x.globalAlpha = .3 * glow; x.beginPath(); x.arc(10, 0, 12, 0, TAU); x.fill(); x.globalAlpha = 1;
      x.fillStyle = f.side === 'k' ? INK : BONE; x.strokeStyle = f.w.accent; x.lineWidth = 2.5;
      x.beginPath(); x.arc(10, 0, 6.5, 0, TAU); x.fill(); x.stroke();
      x.strokeStyle = line; x.lineWidth = 1.2; x.beginPath(); x.moveTo(10, -4); x.lineTo(10, 4); x.moveTo(6, 0); x.lineTo(14, 0); x.stroke();
    } else {
      const L = BLADE[id] + ext, wdt = id === 'great' ? 5.5 : id === 'spear' ? 2.6 : 3.6;
      // hilt
      x.strokeStyle = line; x.lineWidth = 3; x.beginPath(); x.moveTo(-6, 0); x.lineTo(4, 0); x.stroke();
      if (id !== 'spear') { x.lineWidth = 3; x.beginPath(); x.moveTo(4, -6); x.lineTo(4, 6); x.stroke(); }
      // blade: dark outline, bone body, accent edge
      x.fillStyle = f.side === 'k' ? '#2a2a28' : BONE; x.strokeStyle = line; x.lineWidth = 1.6;
      x.beginPath();
      if (id === 'spear') { x.rect(4, -wdt / 2, L - 14, wdt); x.fill(); x.stroke(); x.beginPath(); x.moveTo(L - 12, -5); x.lineTo(L + 4, 0); x.lineTo(L - 12, 5); x.closePath(); }
      else { x.moveTo(5, -wdt); x.lineTo(L - 6, -wdt); x.lineTo(L, 0); x.lineTo(L - 6, wdt); x.lineTo(5, wdt); x.closePath(); }
      x.fill(); x.stroke();
      x.strokeStyle = f.w.accent; x.lineWidth = 1.6; x.beginPath();
      if (id === 'spear') { x.moveTo(L - 12, -5); x.lineTo(L + 4, 0); } else { x.moveTo(8, -wdt + .8); x.lineTo(L - 6, -wdt + .8); x.lineTo(L, 0); }
      x.stroke();
    }
    x.restore();
  }

  drawFighter(g, f) {
    const x = this.x;
    if (f.state === 'dead' && f.side === 'k') return; // shattered
    // shadow
    x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.ellipse(f.x + 4, f.y + 6, f.r * 1.15, f.r * 1.05, 0, 0, TAU); x.fill();
    if (f.state === 'dead') {
      x.save(); x.translate(f.x, f.y); x.rotate(f.face); x.globalAlpha = .9;
      x.fillStyle = '#7c776c'; x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.ellipse(0, 0, f.r * .9, f.r * 1.1, 0, 0, TAU); x.fill(); x.stroke();
      x.restore(); return;
    }
    if (f.dummy) return this.drawDummy(g, f);
    // weapon drawn under the body when held back, over it when swinging
    const swinging = f.state === 'attack' && f.a && f.a.ph !== 'wind';
    if (!swinging) this.drawWeapon(f);
    this.body(f, f.x, f.y, f.face);
    if (swinging) this.drawWeapon(f);
    if (f.side === 'k') this.drawCracks(g, f);
    // states
    if (f.hurtT > 0) { x.fillStyle = f.side === 'k' ? `rgba(235,229,214,${f.hurtT * 4})` : `rgba(192,42,29,${f.hurtT * 4})`; x.beginPath(); x.arc(f.x, f.y, f.r * 1.05, 0, TAU); x.fill(); }
    if (f.state === 'stagger' && f.side === 'k') {
      for (let i = 0; i < 3; i++) { const a = g.t * 4 + i * TAU / 3; this.star(f.x + Math.cos(a) * 24, f.y + Math.sin(a) * 24 - 4, 5, BONE); }
    }
    if (f.state === 'rise') { x.strokeStyle = `rgba(235,229,214,${.5 + .5 * Math.sin(g.t * 20)})`; x.lineWidth = 2; x.beginPath(); x.arc(f.x, f.y, f.r + 8, 0, TAU); x.stroke(); }
    if (f.state === 'drink') { x.fillStyle = 'rgba(233,162,59,.85)'; x.beginPath(); x.arc(f.x + Math.cos(f.face) * f.r * .9, f.y + Math.sin(f.face) * f.r * .9, 4.5, 0, TAU); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.5; x.stroke(); }
  }

  drawCracks(g, f) {
    const n = habitCount(g.habits); if (!n) return;
    const x = this.x, r = f.r;
    x.save(); x.translate(f.x, f.y); x.rotate(f.face);
    const glow = g.phase === 3;
    x.strokeStyle = glow ? f.w.accent : BONE; x.lineWidth = glow ? 1.8 : 1.2;
    if (glow) { x.shadowColor = f.w.accent; x.shadowBlur = 8; }
    const spots = [[-.1, -.85, 2.2], [0, .85, -2], [-.35, -.2, 3], [.1, .45, -1], [-.3, .55, 2.6], [.2, -.5, 1], [-.5, 0, 3.5]];
    for (let i = 0; i < n; i++) {
      const [sx, sy, a] = spots[i];
      let px = sx * r, py = sy * r;
      x.beginPath(); x.moveTo(px, py);
      for (let j = 0; j < 3; j++) { const aa = a + (j % 2 ? .7 : -.6); px += Math.cos(aa) * r * .28; py += Math.sin(aa) * r * .28; x.lineTo(px, py); }
      x.stroke();
    }
    x.restore();
  }

  drawDummy(g, f) {
    const x = this.x, r = f.r;
    // a post with a mirror and one swinging arm
    x.fillStyle = '#6b5a45'; x.strokeStyle = INK; x.lineWidth = 2.5;
    x.beginPath(); x.arc(f.x, f.y, r * .7, 0, TAU); x.fill(); x.stroke();
    const swing = f.state === 'attack' && f.a;
    const armA = swing ? (f.a.ph === 'wind' ? f.face - .4 - f.a.t * 1.2 : f.a.ph === 'act' ? f.face + f.a.t * 50 : f.face) : g.t * .4;
    x.save(); x.translate(f.x, f.y); x.rotate(armA);
    x.strokeStyle = INK; x.lineWidth = 6; x.beginPath(); x.moveTo(0, 0); x.lineTo(r + 46, 0); x.stroke();
    x.strokeStyle = '#8a7558'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(0, 0); x.lineTo(r + 46, 0); x.stroke();
    x.restore();
    x.fillStyle = BONE; x.strokeStyle = INK; x.lineWidth = 2;
    x.beginPath(); x.arc(f.x, f.y, r * .45, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = 'rgba(11,11,10,.25)'; x.beginPath(); x.arc(f.x + 2, f.y + 2, r * .3, 0, TAU); x.fill();
    if (f.hurtT > 0) { x.fillStyle = `rgba(235,229,214,${f.hurtT * 5})`; x.beginPath(); x.arc(f.x, f.y, r, 0, TAU); x.fill(); }
  }
}
