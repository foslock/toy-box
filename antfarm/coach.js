// The walkthrough's pointing hand: it shows a move (a tap somewhere, or a drag from one place to another) over and
// over until the next hint. What the steps are, and when each is done, lives in main.js.
const smooth = x => x * x * (3 - 2 * x);

export class Coach {
  constructor(hand, ring) { this.hand = hand; this.ring = ring; this.g = null; this.t = 0; this.shown = false; }
  // { kind: 'tap', at() } or { kind: 'swipe', from(), to() }, where each function returns a point on screen (or null to
  // hide the hand for now). null stops it.
  show(g) { this.g = g; this.t = 0; this.cycle = -1; }
  update(dt, busy) {
    const g = this.g, el = this.hand;
    if (!g || busy) { if (this.shown) { el.style.opacity = 0; this.shown = false; } this.t = 0; this.cycle = -1; return; }
    this.t += dt;
    let p, s = 1, o = 1;
    if (g.kind === 'tap') {
      const T = 1.4, k = this.t % T, n = Math.floor(this.t / T);
      p = g.at();
      if (p && k > .42 && this.cycle !== n) { this.cycle = n; this.pulse(p); }
      o = k < .2 ? k / .2 : k > 1.1 ? Math.max(0, 1 - (k - 1.1) / .2) : 1;
      s = k < .3 ? 1.1 - k / .3 * .1 : k < .42 ? 1 - (k - .3) / .12 * .16 : k < .6 ? .84 + (k - .42) / .18 * .16 : 1;
    } else {
      const T = 2.3, k = this.t % T, a = g.from(), b = g.to();
      if (a && b) { const m = k < .4 ? 0 : k < 1.4 ? smooth((k - .4) / 1) : 1; p = { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }; }
      o = k < .22 ? k / .22 : k < 1.55 ? 1 : k < 1.8 ? 1 - (k - 1.55) / .25 : 0;
      s = k < .25 ? 1.1 : k < .4 ? 1.1 - (k - .25) / .15 * .22 : k < 1.4 ? .88 : k < 1.55 ? .88 + (k - 1.4) / .15 * .12 : 1;
    }
    if (!p) { el.style.opacity = 0; this.shown = false; return; }
    el.style.opacity = o; this.shown = o > 0;
    el.style.transform = `translate(${p.x - 22}px, ${p.y - 3}px) scale(${s})`;
  }
  pulse(p) { const r = this.ring; r.style.left = p.x + 'px'; r.style.top = p.y + 'px'; r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); }
  stop() { this.g = null; this.hand.style.opacity = 0; this.shown = false; }
}
