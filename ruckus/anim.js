// One running scene: a letter's routine. It owns the clock and the parts every scene shares: the stage (centred on the
// scene, so scenes draw around 0,0), the entrance pulse, the exit (everything collapses while the hero letter flies
// off to its place in the text) and the hero frame that scenes draw their letter in.
//
// A scene is { color, textColor (optional: the colour the letter takes in the text, if not its own), bg, dur, back(a, t), draw(a, t) }.
// It has two layers: back(a, t), its environment (sunburst, hills, water, big shapes), which sits under the text and
// which the next scene's colour wipe paints over, and draw(a, t), its characters, props and confetti, which sit over the
// text and over the other scenes.
import { bind, hash, lerp, sat, seg, E, K, pulse, spray, glyphOf, HERO } from './kit.js';

export const EXIT = 0.5;              // seconds the exit takes
export const LOUD = 1.85;             // the exaggeration an uppercase letter gets

export class Anim {
  // def: the scene; o: { ch, X (1 or LOUD), w, h, u, cx, cy, seed, fx, flip, slot: {x, y, h} }
  constructor(def, o) {
    this.def = def; this.ch = o.ch; this.g = glyphOf(o.ch); this.X = o.X; this.big = o.X > 1; this.flip = o.flip || 1;
    this.w = o.w; this.h = o.h; this.bw = o.bw ?? o.w * 1.8; this.bh = o.bh ?? o.h * 1.8;      // bw, bh: wide enough to bleed off the screen wherever the scene sits
    this.u = o.u; this.k = o.u / 100; this.cx = o.cx; this.cy = o.cy; this.seed = o.seed | 0; this.fx = o.fx ?? 1;
    this.slot = o.slot; this.hs = 1 + (o.X - 1) * 0.36;                    // the hero letter's size: uppercase is bigger
    this.dur = def.dur;
    this.t = 0; this.exitAt = this.dur - EXIT; this.exitLen = EXIT; this.noLand = false;
    if (def.light) { this.exitAt = this.dur; this.exitLen = 0; }          // the short scenes just end
    this.ss = 1; this.land = 0; this.ak = 1; this.done = false; this.base = null; this.ctx = null;
  }
  r(i, j = 0) { return hash(this.seed, i, j); }
  n(count) { return Math.max(1, Math.round(count * (1 + (this.X - 1) * 0.8) * this.fx)); }     // a count that grows for uppercase and shrinks under load
  x(v) { return 1 + (this.X - 1) * v; }                                                        // a size or strength that grows for uppercase: x(0.5) is +50% of the extra
  get p() { return sat(this.t / this.exitAt); }                                                // how far through the main action

  step(dt) {
    this.t += dt;
    if (this.t >= this.exitAt + this.exitLen) this.done = true;
  }
  // Cut short: start the exit now (quickly if the letter has been taken away).
  leave(quick) {
    if (this.exitAt > this.t) { this.exitAt = this.t; this.exitLen = quick ? 0.22 : Math.min(EXIT, 0.36); }
    if (quick) this.noLand = true;
  }
  get leaving() { return this.t >= this.exitAt; }

  // where the exit has got to: the stage shrinks away (with a little wind-up first) while the letter flies to its slot
  env() {
    const e = this.exitLen > 0 ? seg(this.t, this.exitAt, this.exitAt + this.exitLen) : 0;
    this.ss = e > 0 ? Math.max(0, 1 - E.inBack(e)) : 1;
    this.land = e > 0 && !this.noLand ? E.io(seg(e, 0.04, 0.96)) : 0;
    this.ak = 1 - sat(this.land * 1.8);
  }
  drawBack(c) {
    if (!this.def.back) return;
    bind(c); this.ctx = c; this.env();
    c.save(); c.translate(this.cx, this.cy); c.scale(this.ss, this.ss);
    this.def.back(this, this.t);
    c.restore();
  }
  draw(c) {
    bind(c); this.ctx = c; this.env();
    const t = this.t;
    this.base = c.getTransform();
    c.save(); c.translate(this.cx, this.cy); c.scale(this.ss, this.ss);
    this.def.draw(this, t);
    if (!this.def.light) this.entrance(t);
    c.restore();
  }
  // Every keystroke lands with a couple of rings, and an uppercase one with more and a spray.
  entrance(t) {
    const u = this.u;
    pulse(0, 0, t, 0, 0.36, u * 0.5 * this.hs, u * 0.045, K.white);
    pulse(0, 0, t, 0.06, 0.45, u * 0.8 * this.hs, u * 0.028, this.def.bg);
    if (this.big) {
      pulse(0, 0, t, 0.02, 0.55, u * 1.2, u * 0.04, K.white);
      pulse(0, 0, t, 0.1, 0.6, u * 1.6, u * 0.025, this.def.color);
      spray(this, t, { x: 0, y: 0, n: this.n(12), t0: 0.03, life: 0.9, v0: u * 1.2, v1: u * 2.6, g: 900, s0: 7, s1: 16, seed: 9000, cols: [K.white, this.def.color, K.yellow, this.def.bg] });
    }
  }

  /* --- the hero frame ---
     begin(x, y, s, rot, sx, sy) puts the letter's own frame on the canvas: origin at the middle of the letter, one unit
     is a pixel at the size where the letter is `u` tall. Draw the glyph and whatever hangs off it inside, then end().
     While the letter is flying to its place in the text this blends the pose toward the slot on its own. */
  begin(x = 0, y = 0, s = 1, rot = 0, sx = 1, sy = 1) {
    const L = this.land, ss = this.ss, sl = this.slot, c = this.ctx;
    let X = this.cx + x * ss, Y = this.cy + y * ss, Sc = s * this.hs, R = rot, SX = sx, SY = sy;
    if (L > 0) {
      X = lerp(X, sl.x, L); Y = lerp(Y, sl.y, L); Sc = lerp(Sc, sl.h / this.u, L); R *= 1 - L; SX = lerp(SX, 1, L); SY = lerp(SY, 1, L);
    }
    c.save(); c.setTransform(this.base); c.translate(X, Y); c.rotate(R); c.scale(Sc * SX, Sc * SY);
    const un = Math.max(this.ak, 0.004);                                    // as the letter lands, whatever hangs off it shrinks into it and its warps ease out (see HERO in kit.js)
    if (un < 1) c.scale(un, un);
    HERO.relax = L; HERO.un = un; HERO.color = this.def.textColor || this.def.color;
  }
  end() { HERO.relax = 0; HERO.un = 1; this.ctx.restore(); }
}
