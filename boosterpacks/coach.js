// A new player's first pack, walked through. At each new move a hand shows how (a swipe across the tear line, a drag
// up, a tap on the card) while the hint under the pack says what it does, in a gold-edged box with a way out. It
// covers tearing the pack, pulling the cards and going through them, selling one or keeping them, and finding them in
// the binder afterwards.
const LINES = {
  tear: touch => `${touch ? 'Swipe' : 'Drag'} across the dotted line to rip the pack open!`,
  pull: () => 'Now pull the cards up out of the pack',
  flip: () => 'Rares and shiny cards come face down. Tap to flip it!',
  swipe: touch => touch ? 'Swipe the card away to see the next one' : 'Swipe the card away (or click it) for the next one',
  all: () => 'That’s the last one. Tap to see all nine together',
  sell: () => 'Every card is worth money. Tap <b>Sell</b> under any card you don’t want',
  keep: () => 'The cards you keep go in your binder. Tap the gold button when you’re ready',
  binder: () => 'Your cards are in your binder now. Take a look!',
};
const smooth = x => x * x * (3 - 2 * x);

export class Coach {
  // o.touch: a touch screen (says swipe, not drag); o.busy(): a finger or button is down, so the hand steps aside;
  // o.done: steps done already (before a reload); o.onFinish(step): a step has just been done
  constructor(o) {
    this.touch = o.touch; this.busy = o.busy; this.onFinish = o.onFinish;
    this.hand = document.getElementById('coachHand'); this.ring = document.getElementById('coachTap');
    this.done = new Set(o.done ?? []); this.g = null; this.t = 0; this.shown = false;
  }
  // The words for a step (with the tutorial's tag and a way out), or null once that step is done.
  line(step) {
    const f = LINES[step];
    if (!f || this.done.has(step)) return null;
    return `<span class="coach-tag">Tutorial</span>${f(this.touch)}<button class="coach-skip" type="button">Skip tutorial</button>`;
  }
  finish(step) { if (this.done.has(step)) return; this.done.add(step); this.onFinish?.(step); }
  did(step) { return this.done.has(step); }
  // Show a move, over and over until the next hint: { kind: 'tap', at() } or { kind: 'swipe', from(), to() }, where
  // each function returns a point on the screen (or null to hide the hand). null stops it.
  show(g) { this.g = g; this.t = 0; this.cycle = -1; }
  update(dt) {
    const g = this.g, el = this.hand;
    if (!g || this.busy?.()) { if (this.shown) { el.style.opacity = 0; this.shown = false; } this.t = 0; this.cycle = -1; return; }
    this.t += dt;
    let p, s = 1, o = 1;
    if (g.kind === 'tap') {
      const T = 1.4, k = this.t % T, n = Math.floor(this.t / T);
      p = g.at();
      if (p && k > .42 && this.cycle !== n) { this.cycle = n; this.pulse(p); }
      o = k < .2 ? k / .2 : k > 1.1 ? Math.max(0, 1 - (k - 1.1) / .2) : 1;
      s = k < .3 ? 1.1 - k / .3 * .1 : k < .42 ? 1 - (k - .3) / .12 * .16 : k < .6 ? .84 + (k - .42) / .18 * .16 : 1;
    } else {   // swipe: appear, press, slide across, lift, fade, wait
      const T = 2.1, k = this.t % T, a = g.from(), b = g.to();
      if (a && b) { const m = k < .4 ? 0 : k < 1.2 ? smooth((k - .4) / .8) : 1; p = { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }; }
      o = k < .22 ? k / .22 : k < 1.35 ? 1 : k < 1.6 ? 1 - (k - 1.35) / .25 : 0;
      s = k < .25 ? 1.1 : k < .4 ? 1.1 - (k - .25) / .15 * .22 : k < 1.2 ? .88 : k < 1.35 ? .88 + (k - 1.2) / .15 * .12 : 1;
    }
    if (!p) { el.style.opacity = 0; this.shown = false; return; }
    el.style.opacity = o; this.shown = o > 0;
    el.style.transform = `translate(${p.x - 22}px, ${p.y - 3}px) scale(${s})`;
  }
  pulse(p) { const r = this.ring; r.style.left = p.x + 'px'; r.style.top = p.y + 'px'; r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); }
  stop() { this.g = null; this.hand.style.opacity = 0; this.shown = false; }
}
