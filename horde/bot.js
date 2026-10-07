// Horde: a stand-in for you, for ?demo, ?autoplay and the balance runs. It raises monsters at the rim through the same
// spawn() a tap uses and works the flag through setFlag()/hunt(). Three temperaments:
//   naive   raises imps wherever, whenever it can, and sends everything straight in
//   decent  mixes what it has and comes from a different side each time, always hunting
//   smart   masses a horde at a flag on the far side of the field, then sends it all in at once and raises more on
//           the flanks while it hits; picks monsters against the hero's kit
import { MOBS } from './data.js';

const TAU = Math.PI * 2;

// where a ray from (x, y) at angle a leaves the arena
function rim(W, H, x, y, a) {
  const c = Math.cos(a), s = Math.sin(a);
  let t = 1e9;
  if (c > 1e-6) t = Math.min(t, (W - 2 - x) / c); else if (c < -1e-6) t = Math.min(t, (2 - x) / c);
  if (s > 1e-6) t = Math.min(t, (H - 2 - y) / s); else if (s < -1e-6) t = Math.min(t, (2 - y) / s);
  return [x + c * t, y + s * t];
}

export class Bot {
  constructor(opt = {}) {
    this.kind = opt.kind || 'decent'; this.rand = opt.rand || Math.random;
    this.think = opt.think ?? 0.3; this.wait = 0.5; this.ang = this.rand() * TAU;
    this.phase = 'gather'; this.rally = null; this.phaseT = 0; this.charged = 0;
  }
  pickType(g, budget) {
    const R = g.roster.filter(k => MOBS[k].cost <= budget);
    if (!R.length) return null;
    if (this.kind === 'naive') return R.includes('imp') ? 'imp' : R[0];
    const h = g.hero, has = id => h.weapons.some(w => w.id === id);
    const w = {};
    for (const k of R) w[k] = 1;
    if (w.imp) w.imp = 3;
    if (w.bat) w.bat = 1.4;
    if (this.kind === 'smart') {
      if (has('garlic') || has('books')) { if (w.imp) w.imp *= 0.5; if (w.brute) w.brute *= 1.8; if (w.bloat) w.bloat *= 1.6; if (w.hag) w.hag *= 1.5; }
      if (has('knife') || has('fire') || has('axe')) { if (w.shield) w.shield *= 2.2; if (w.bat) w.bat *= 1.8; }
      if (has('bolt')) { if (w.bat) w.bat *= 1.5; if (w.brute) w.brute *= 1.4; }
      let hags = 0; for (const m of g.mobs) if (m.type === 'hag' && !m.dead) hags++;
      if (w.hag && hags >= 3) w.hag = 0.05;
      if (h.armor >= 2 && w.imp) w.imp *= 0.5;
    }
    let sum = 0; for (const k in w) sum += w[k];
    let r = this.rand() * sum;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return R[0];
  }
  spawnAt(g, type, a) {
    const h = g.hero;
    for (let k = 0; k < 6; k++) {
      const [x, y] = rim(g.W, g.H, h.x, h.y, a + k * 0.5 * (k % 2 ? 1 : -1));
      if (g.spawn(type, x, y)) return true;
    }
    return false;
  }
  tick(g, dt) {
    if (g.state !== 'play') return;
    this.phaseT += dt;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = this.think * (0.6 + this.rand() * 0.8);
    if (this.kind === 'smart') return this.smart(g);
    if (!g.flag.hunt) g.hunt();
    const type = this.pickType(g, g.ess);
    if (!type) return;
    if (this.kind === 'naive') { this.spawnAt(g, type, this.rand() * TAU); return; }
    this.ang += 2.39996;   // the golden angle: every summons from somewhere new
    this.spawnAt(g, type, this.ang);
  }
  army(g) { let v = 0; for (const m of g.mobs) if (!m.dead) v += m.M.cost / m.M.n; return v; }
  // an ambush: just outside the lantern's reach, ahead of where the hero is walking
  pickRally(g) {
    const h = g.hero, W = g.W, H = g.H, d = h.see + 40;
    let best = null, bs = -1e9;
    for (let i = 0; i < 10; i++) {
      const a = Math.atan2(h.dy, h.dx) + (this.rand() - 0.5) * 2.4;
      const x = Math.max(24, Math.min(W - 24, h.x + Math.cos(a) * d)), y = Math.max(24, Math.min(H - 24, h.y + Math.sin(a) * d));
      const far = Math.hypot(x - h.x, y - h.y), rim = Math.min(x, W - x, y, H - y);
      const s = -Math.abs(far - d) * 2 - rim * 0.5 + (this.rand() * 10);
      if (far > h.see + 12 && s > bs) { bs = s; best = { x, y }; }
    }
    return best || { x: h.x < W / 2 ? W - 30 : 30, y: h.y < H / 2 ? H - 30 : 30 };
  }
  smart(g) {
    const h = g.hero;
    if (this.phase === 'gather') {
      const dh = this.rally ? Math.hypot(this.rally.x - h.x, this.rally.y - h.y) : 0;
      const army = this.army(g), want = 70 + g.t * 0.9;
      // the hero walked into it: spring it
      if (this.rally && dh < h.see + 8 && army > want * 0.35) { this.phase = 'charge'; this.phaseT = 0; this.charged = army; g.hunt(); return; }
      if (!this.rally || dh < h.see + 4 || (this.phaseT > 6 && dh > h.see + 110)) { this.rally = this.pickRally(g); g.setFlag(this.rally.x, this.rally.y); }
      if (g.flag.hunt) g.setFlag(this.rally.x, this.rally.y);
      const type = this.pickType(g, g.ess);
      if (type) g.spawn(type, this.rally.x, this.rally.y);
      if ((army > want && this.phaseT > 6) || this.phaseT > 28) { this.phase = 'charge'; this.phaseT = 0; this.charged = army; g.hunt(); }
      return;
    }
    // the charge: everything goes, and more comes up on the far sides of the hero to cut it off
    if (!g.flag.hunt) g.hunt();
    const type = this.pickType(g, g.ess);
    if (type) { this.ang += 2.39996; this.spawnAt(g, type, this.ang); }
    if ((this.phaseT > 5 && this.army(g) < this.charged * 0.3) || this.phaseT > 20) { this.phase = 'gather'; this.phaseT = 0; this.rally = null; }
  }
}
