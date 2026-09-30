// The narrator's brain, with no page in it. A scene pushes beats onto a queue (lines to say, pauses, things to do) and the
// queue plays out in order on a clock; what the page senses arrives as events, and the scene's handlers (or the defaults
// in story.js) answer them, either by slipping a few lines in ahead of the queue or by moving to another scene.
// view.js draws it; check.mjs plays it with no page at all.

export const TYPE_MS = 22;

// Text → what's typed, and how long each character takes. "|" is a beat of silence, for timing a joke.
export function prep(raw) {
  let text = '', weights = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i], nx = raw[i + 1];
    if (c === '|') { if (weights.length) weights[weights.length - 1] += 380; continue; }
    let ms = TYPE_MS;
    if (c === ',' || c === ';' || c === ':') ms += 110;
    else if (c === '—') ms += 140;
    else if (c === '…') ms += 300;
    else if ((c === '.' || c === '!' || c === '?') && (nx === undefined || nx === ' ' || nx === '”' || nx === '’')) ms += 240;
    text += c; weights.push(ms);
  }
  return { text, weights, typeMs: weights.reduce((a, b) => a + b, 0) };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const holdFor = text => clamp(420 + text.length * 26, 800, 4600);

export function createGame({ view, store, story }) {
  let now = 0, queue = [], cur = null, settled = false, settledAt = 0, lastInput = 0;
  const g = {
    view, store, story, scene: null, mode: 'play', lookName: 'corp', btn: null, flags: {},
    prev: store.prev, s: null,
    get settled() { return settled; },
    now: () => now,
    env: () => ({ hour: store.hour(), day: store.today() }),
  };
  const fresh = () => ({ step: 1, idle: 0, ready: true, agreed: false, era: 0, lit: new Set(), interacted: false });
  g.s = fresh();

  // --- beats -----------------------------------------------------------------------------------------------------
  const asBeat = it => {
    if (typeof it === 'string' || typeof it === 'function') return { k: 'say', t: it };
    if (it && it.k) return it;
    return { k: 'say', ...it };
  };
  const push = beats => { queue.push(...beats); return g; };
  g.say = (...items) => push(items.map(asBeat));
  g.pause = ms => push([{ k: 'wait', ms }]);
  g.do = fn => push([{ k: 'do', fn }]);
  g.until = (test, max = 60000) => push([{ k: 'until', test, max }]);
  g.look = (name, opts = {}) => g.do(() => { g.lookName = name; view.look(name, opts); });
  g.step = n => g.do(() => { g.s.step = n; view.step(n); });
  g.button = spec => g.do(() => { g.btn = spec; view.button(spec); });
  g.buttonNow = spec => { g.btn = spec; view.button(spec); };
  g.chain = (id, arg) => g.do(() => g.go(id, arg));
  g.end = id => g.do(() => finish(id));

  // Lines that cut in: the one being said is let go a moment early, then these, then the scene carries on.
  g.interject = (...items) => {
    queue.unshift(...items.map(asBeat));
    if (cur && cur.k !== 'until') cur.end = Math.min(cur.end, Math.max(now + 250, (cur.typeEnd || now) + 300));
    return g;
  };

  g.go = (id, arg) => {
    const sc = story.scenes[id];
    if (!sc) throw new Error('no scene ' + id);
    g.prevScene = g.scene; g.scene = id; queue = [];
    if (id !== 'first') g.s.ready = true;   // the first-visit intro can be cut short; nothing else holds the button back
    if (cur && cur.k === 'say') cur.end = Math.min(cur.end, Math.max(now + 250, cur.typeEnd + 300));
    else cur = null;
    settled = false;
    sc.enter && sc.enter(g, arg || {});
    return g;
  };
  g.resume = arg => g.go('step' + g.s.step, { resume: true, ...arg });

  function finish(id) {
    g.mode = 'ending'; g.s.ended = id;
    const isNew = store.addEnding(id);
    view.ending({ id, isNew, found: store.count(), total: store.total });
  }

  // --- the clock -------------------------------------------------------------------------------------------------
  function start(b) {
    settled = false;
    if (b.k === 'say') {
      const text = typeof b.t === 'function' ? b.t(g) : b.t;
      const p = prep(text), hold = b.hold ?? holdFor(p.text) * (b.fast ? 0.6 : 1);
      cur = { k: 'say', typeEnd: now + p.typeMs, end: now + p.typeMs + hold };
      g.said = p.text;
      view.say({ text: p.text, weights: p.weights, who: b.who, hold });
    } else if (b.k === 'wait') cur = { k: 'wait', end: now + b.ms };
    else if (b.k === 'until') cur = { k: 'until', test: b.test, end: now + b.max };
    else if (b.k === 'do') { b.fn(g); }
  }
  function pump() {
    for (let guard = 0; guard < 400; guard++) {
      if (cur) {
        const done = cur.k === 'until' ? (cur.test(g) || now >= cur.end) : now >= cur.end;
        if (!done) return;
        cur = null;
      }
      if (!queue.length) {
        if (!settled) { settled = true; settledAt = now; view.settled && view.settled(); }
        return;
      }
      start(queue.shift());
    }
  }
  g.tick = dt => {
    now += dt;
    pump();
    if (settled && g.mode === 'play') idleCheck();
  };
  g.run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) g.tick(step); };
  // Tap on the caption: finish typing, then (tapped again) move on.
  g.skip = () => {
    if (!cur || cur.k !== 'say') return;
    if (now < cur.typeEnd) { cur.end -= cur.typeEnd - now; cur.typeEnd = now; view.finishTyping && view.finishTyping(); }
    else cur.end = now;
    pump();
  };

  // --- what the page senses --------------------------------------------------------------------------------------
  g.input = () => { lastInput = now; g.s.idle = 0; g.s.interacted = true; };
  g.on = (type, data = {}) => {
    if (g.mode !== 'play') return;
    const sc = story.scenes[g.scene] || {};
    const h = (sc.on && sc.on[type]) || story.on[type];
    if (h) h(g, data);
    pump();
  };
  function idleCheck() {
    const sc = story.scenes[g.scene];
    if (!sc || sc.idle === false) return;
    const gap = story.idle.gaps[Math.min(g.s.idle, story.idle.gaps.length - 1)];
    if (now - Math.max(lastInput, settledAt) >= gap) {
      const i = g.s.idle++;
      story.idle.run(g, i);
      pump();
    }
  }

  // --- lifecycle -------------------------------------------------------------------------------------------------
  g.boot = () => { g.go('start', {}); pump(); };
  g.restart = () => {
    const was = g.s.ended;
    g.prev = { ...g.prev, visits: Math.max(1, (g.prev.visits || 0) + 1), lastAct: was ? 'ended:' + was : g.prev.lastAct };
    const keep = { interacted: true };
    g.s = { ...fresh(), ...keep };
    queue = []; cur = null; settled = false; g.mode = 'play'; g.lookName = 'corp'; g.btn = null; g.flags = {};
    view.reset();
    g.go('start', { restart: true }); pump();
  };
  return g;
}
