// The house, the family and the haunting. No DOM in here, so the balance sim runs it in Node.
//
// The house is a cutaway seen from the side: three floors of two rooms each, and a
// stairwell up the right-hand side with the front door at the bottom. x runs 0..800 across
// the rooms (the stairwell is 800..890), y grows downward and each floor's boards sit at
// floorY(f). People only ever look left or right, along their floor, so "is anyone watching
// this?" is a question about who's in the room and which way they face.

export const RW = 400, FH = 270, BASE = 840, HW = 800, SW = 90;
export const floorY = (f) => BASE - f * FH;
export const roomOf = (f, x) => (x >= HW || x < 0 || f < 0) ? -1 : f * 2 + (x >= RW ? 1 : 0);
export const NIGHT_START = 20, NIGHT_END = 30;      // 8 pm to 6 am
export const VIEW = 240, TORCH_VIEW = 400, NEAR = 42;
export const COMBO_WIN = 3.6;                         // seconds after a trick that the next one chains
export const COMBO_MULT = [1, 1, 1.35, 1.7, 2.1, 2.5];
export const ECTO_MAX = 4, ECTO_REGEN = 1 / 4.4;      // tricks in hand, and how fast they come back
export const COOLDOWN = 7;
export const FLEE_AT = 100;
export const TUNE = { fright: 0.55, habit: 0.58, decay: 0.7, calm: 9, forget: 1 / 45, contagion: 8, sceptic: 0.3, scepticCombo: 1.6 };

export const ROOMS = [
  { name: 'Kitchen', f: 0, side: 0 }, { name: 'Parlour', f: 0, side: 1 },
  { name: 'Bedroom', f: 1, side: 0 }, { name: 'Bathroom', f: 1, side: 1 },
  { name: 'Attic', f: 2, side: 0 }, { name: 'Box room', f: 2, side: 1 },
];
// rooms that hear a loud trick: the other room on the floor, and the rooms straight above and below
export function adjacent(a, b) {
  if (a < 0 || b < 0 || a === b) return false;
  const fa = a >> 1, fb = b >> 1, sa = a & 1, sb = b & 1;
  return (fa === fb) || (sa === sb && Math.abs(fa - fb) === 1);
}

// Every haunted object. x is where it stands; h is how tall it is above the boards (or, for
// things on the wall, hy is how high its middle sits). base is the fright it gives a stranger.
export const OBJECTS = [
  { id: 'kettle',    room: 0, x: 58,  hy: 112, kind: 'kettle',   base: 17, loud: true,  verb: 'Shriek the kettle' },
  { id: 'cupboard',  room: 0, x: 165, hy: 175, kind: 'cupboard', base: 13, loud: false, verb: 'Fling the cupboard open' },
  { id: 'cups',      room: 0, x: 365, hy: 150, kind: 'cups',     base: 12, loud: false, verb: 'Rattle the teacups' },
  { id: 'clock',     room: 1, x: 428, hy: 110, kind: 'clock',    base: 16, loud: true,  verb: 'Strike thirteen' },
  { id: 'lamp1',     room: 1, x: 545, hy: 135, kind: 'lamp',     base: 12, loud: false, verb: 'Flicker the lamp' },
  { id: 'portrait',  room: 1, x: 640, hy: 170, kind: 'portrait', base: 14, loud: false, verb: 'Roll the portrait’s eyes' },
  { id: 'radio',     room: 1, x: 752, hy: 70,  kind: 'radio',    base: 15, loud: true,  verb: 'Tune the radio to nothing' },
  { id: 'wardrobe',  room: 2, x: 48,  hy: 110, kind: 'wardrobe', base: 14, loud: false, verb: 'Creak the wardrobe' },
  { id: 'curtain',   room: 2, x: 192, hy: 170, kind: 'curtain',  base: 13, loud: false, verb: 'Billow the curtains' },
  { id: 'lamp2',     room: 2, x: 352, hy: 90,  kind: 'lamp',     base: 12, loud: false, verb: 'Flicker the lamp' },
  { id: 'taps',      room: 3, x: 438, hy: 90,  kind: 'taps',     base: 13, loud: false, verb: 'Run the taps' },
  { id: 'duck',      room: 3, x: 568, hy: 74,  kind: 'duck',     base: 11, loud: false, verb: 'Squeak the duck' },
  { id: 'mirror',    room: 3, x: 738, hy: 160, kind: 'mirror',   base: 15, loud: false, verb: 'Write on the mirror' },
  { id: 'rocker',    room: 4, x: 92,  hy: 70,  kind: 'rocker',   base: 15, loud: false, verb: 'Rock the chair' },
  { id: 'musicbox',  room: 4, x: 232, hy: 66,  kind: 'musicbox', base: 14, loud: false, verb: 'Wind the music box' },
  { id: 'dummy',     room: 4, x: 345, hy: 100, kind: 'dummy',    base: 19, loud: false, verb: 'Turn the dummy’s head' },
  { id: 'record',    room: 5, x: 458, hy: 72,  kind: 'record',   base: 14, loud: true,  verb: 'Play it backwards' },
  { id: 'lamp3',     room: 5, x: 612, hy: 82,  kind: 'lamp',     base: 12, loud: false, verb: 'Flicker the lamp' },
  { id: 'shutters',  room: 5, x: 762, hy: 165, kind: 'shutters', base: 15, loud: true,  verb: 'Bang the shutters' },
];
for (const o of OBJECTS) { o.f = o.room >> 1; }

// Places people go to do things. face is the way they look while they're at it.
export const ACTS = {
  cook:    { f: 0, x: 98,  face: -1, pose: 'stand', label: 'cooking' },
  eat1:    { f: 0, x: 248, face: 1,  pose: 'sit',   label: 'having supper' },
  eat2:    { f: 0, x: 318, face: -1, pose: 'sit',   label: 'having supper' },
  basket:  { f: 0, x: 215, face: -1, pose: 'lie',   label: 'in the basket', sleep: true },
  read:    { f: 0, x: 488, face: 1,  pose: 'sit',   label: 'reading' },
  sofa:    { f: 0, x: 640, face: -1, pose: 'sit',   label: 'on the sofa' },
  dress:   { f: 1, x: 92,  face: -1, pose: 'stand', label: 'hanging up clothes' },
  sleepA:  { f: 1, x: 150, face: 1,  pose: 'lie',   label: 'asleep', sleep: true },
  sleepB:  { f: 1, x: 240, face: -1, pose: 'lie',   label: 'asleep', sleep: true },
  cot:     { f: 1, x: 318, face: -1, pose: 'lie',   label: 'asleep in the cot', sleep: true },
  bath:    { f: 1, x: 512, face: 1,  pose: 'bath',  label: 'in the bath' },
  brush:   { f: 1, x: 702, face: 1,  pose: 'stand', label: 'brushing teeth' },
  rummage: { f: 2, x: 196, face: -1, pose: 'stand', label: 'rummaging' },
  attic2:  { f: 2, x: 300, face: 1,  pose: 'stand', label: 'poking about' },
  records: { f: 2, x: 512, face: -1, pose: 'sit',   label: 'playing records' },
  desk:    { f: 2, x: 650, face: -1, pose: 'sit',   label: 'at the desk' },
  teenbed: { f: 2, x: 712, face: -1, pose: 'lie',   label: 'asleep (allegedly)', sleep: true },
};

// --------------------------------------------------------------- the families
// Each family member: a look for the painter, a role, and an evening routine of [hour, act].
// Hours past midnight run on past 24 (1 am is 25). The last entry lasts until dawn.
export const NIGHTS = [
  {
    id: 'hobb', title: 'Mr Hobb', sub: 'A practice haunting', tutorial: true, nerve: 1.5,
    members: [
      { name: 'Mr Hobb', look: 'hobb', role: 'adult',
        quirk: 'A retired piano tuner. Jumpy.', sched: [[20, 'eat1']] },
    ],
    todo: [],
  },
  {
    id: 'pims', title: 'The Pims', sub: 'Night one', nerve: 0.72,
    members: [
      { name: 'Ruth', look: 'ruth', role: 'adult', quirk: 'Takes a long bath at eleven.',
        sched: [[20, 'cook'], [21, 'eat2'], [21.7, 'sofa'], [22.9, 'bath'], [23.7, 'sleepA'], [27.6, 'cook'], [27.9, 'sleepA']] },
      { name: 'Gordon', look: 'gordon', role: 'adult', quirk: 'Potters in the attic after supper.',
        sched: [[20, 'read'], [21, 'eat1'], [21.7, 'read'], [22.3, 'rummage'], [23.2, 'brush'], [23.8, 'sleepB'], [26.3, 'brush'], [26.6, 'sleepB']] },
    ],
    todo: [
      { id: 'bath', text: 'Give someone a fright in the bath' },
      { id: 'combo3', text: 'Pull off a three-trick combo' },
      { id: 'early', text: 'Empty the house before 1 am' },
    ],
  },
  {
    id: 'hales', title: 'The Hales', sub: 'Night two', nerve: 1.15,
    members: [
      { name: 'Dee', look: 'dee', role: 'adult', quirk: 'Never misses the radio quiz.',
        sched: [[20, 'cook'], [20.9, 'eat2'], [21.6, 'sofa'], [23, 'brush'], [23.4, 'sleepA'], [27, 'cook'], [27.3, 'sleepA']] },
      { name: 'Ron', look: 'ron', role: 'adult', quirk: 'Snores. Sleeps like a log.',
        sched: [[20, 'read'], [20.9, 'eat1'], [21.6, 'rummage'], [22.4, 'bath'], [23.1, 'sleepB'], [26.5, 'brush'], [26.8, 'sleepB']], heavy: true },
      { name: 'Kit', look: 'kit', role: 'sceptic', quirk: 'Sceptic. One trick at a time won’t do it.',
        sched: [[20, 'records'], [21.65, 'eat1'], [22.3, 'desk'], [23.2, 'brush'], [23.6, 'records'], [24.3, 'desk'], [25.2, 'teenbed'], [27, 'eat1'], [27.4, 'teenbed']] },
    ],
    todo: [
      { id: 'kit', text: 'Make Kit jump with a combo' },
      { id: 'wake', text: 'Wake a sleeper with a fright' },
      { id: 'double', text: 'Scare two people with one trick' },
    ],
  },
  {
    id: 'okafors', title: 'The Okafors', sub: 'Night three', nerve: 0.72,
    members: [
      { name: 'Ada', look: 'ada', role: 'adult', quirk: 'Never far from Bea.',
        sched: [[20, 'cook'], [20.8, 'eat2'], [21.4, 'dress'], [22, 'sofa'], [23.3, 'bath'], [24, 'sleepA'], [27.2, 'cook'], [27.5, 'sleepA']] },
      { name: 'Femi', look: 'femi', role: 'torch', quirk: 'Has a torch. Goes and looks.',
        sched: [[20, 'read'], [20.8, 'eat1'], [21.4, 'attic2'], [22.2, 'read'], [23.6, 'brush'], [24, 'sleepB'],
          [25.5, 'read'], [25.8, 'eat1'], [26.1, 'rummage'], [26.4, 'records'], [26.7, 'sleepB']] },
      { name: 'Bea', look: 'bea', role: 'toddler', quirk: 'Two. Thinks you’re hilarious, so nobody worries near her.',
        follow: 0, sched: [[20, 'follow'], [23.2, 'cot']] },
      { name: 'Biscuit', look: 'dog', role: 'dog', quirk: 'Dog. Can see you. Never haunt a room he’s in.',
        sched: [[20, 'follow'], [23.8, 'basket']] },
    ],
    todo: [
      { id: 'nodog', text: 'Never get barked at' },
      { id: 'torch', text: 'Startle Femi while he’s searching' },
      { id: 'combo4', text: 'Pull off a four-trick combo' },
    ],
  },
];

// residents have to go; Bea and Biscuit just go with them
const RESIDENT = { adult: true, sceptic: true, torch: true };

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LINES = {
  startle: ['What was that?', 'Hello?', 'Oh!', 'Who’s there?', 'Eep!', 'Not again…', 'Did you hear that?'],
  scared: ['I don’t like this house.', 'Something’s WRONG here.', 'Please stop.', 'Mummy…', 'I want to go home.'],
  spotted: ['Huh. Loose hinge.', 'Just the pipes.', 'Draughty old place.', 'Ha. Old houses.', 'Must be the wind.'],
  sceptic: ['lol', 'Nice try.', 'Is that it?', 'Mild.', 'Boring.'],
  scepticHit: ['OK what WAS that', 'Nope. Nope.', 'That’s not funny!'],
  flee: ['That’s IT. I’m off!', 'I’m sleeping at Mum’s!', 'Get me OUT!', 'We’re LEAVING!'],
  gasp: ['Wait for me!', 'They’ve gone?!'],
  giggle: ['hee hee!', 'again!', 'AGAIN!', 'ghostie!'],
  bark: ['WOOF!', 'Woof woof!', 'GRRuff!'],
  hush: ['Hush, Biscuit.', 'Silly dog.'],
  wake: ['Wh—what?!', 'Huh?! Who’s…', 'Gah!'],
  torch: ['Right. Let’s have a look.', 'I’ll check.'],
};

export class Game {
  constructor(nightIndex, opts = {}) {
    this.night = NIGHTS[nightIndex];
    this.nightIndex = nightIndex;
    this.rand = rng(opts.seed ?? 1);
    this.hourLen = opts.hourLen ?? 21;          // real seconds per hour of the night
    this.hour = NIGHT_START;
    this.t = 0;
    this.clockOn = !this.night.tutorial;
    this.events = [];
    this.chain = 0; this.lastTrick = -99; this.lastRoom = -1;
    this.bestChain = 0;
    this.ecto = ECTO_MAX;
    this.ectoRegen = opts.ectoRegen ?? ECTO_REGEN;
    this.spotted = 0; this.barked = 0;
    this.done = new Set();                      // to-do items ticked off
    this.result = null;                         // 'won' | 'lost'
    this.wonHour = null;
    this.tutCap = opts.tutCap ?? 0;             // in the tutorial, fear can't pass this until released
    this.objects = OBJECTS.map((o) => ({ ...o, cool: 0, anim: 0, used: 0 }));
    this.ghost = { x: 200, y: floorY(2) - 120, tx: 200, ty: floorY(2) - 120, target: null, bob: 0 };
    this.people = this.night.members.map((m, i) => {
      const p = {
        i, name: m.name, look: m.look, role: m.role, quirk: m.quirk, sched: m.sched, follow: m.follow, heavy: !!m.heavy,
        resident: !!RESIDENT[m.role], f: 0, x: 0, y: 0, face: 1, path: null, state: 'idle', timer: 0, act: null, atAct: false,
        fear: 0, shown: 0, habit: {}, lastScare: -99, glance: 3 + this.rand() * 5, glancing: 0, asleep: false, gone: false,
        say: null, sayT: 0, jump: 0, walkT: 0, focus: null, awakeT: 0, leaving: false, mood: 0,
      };
      const a = ACTS[m.sched[0][1]] || ACTS.read;
      p.f = a.f; p.x = a.x + (m.sched[0][1] === 'follow' ? 30 + i * 18 : 0); p.y = floorY(p.f); p.face = a.face;
      return p;
    });
    for (const p of this.people) if (p.role === 'dog') p.follow = 0;
    // place the followers next to whoever they follow
    for (const p of this.people) if (p.sched[0][1] === 'follow') {
      const q = this.people[p.follow];
      p.f = q.f; p.x = q.x + (p.role === 'dog' ? -40 : 34); p.y = floorY(p.f);
    }
  }

  emit(type, data = {}) { this.events.push({ type, t: this.t, ...data }); }
  say(p, key, force) {
    if (!force && p.sayT > 0.6 && p.say) return;
    const list = LINES[key]; p.say = list[Math.floor(this.rand() * list.length)]; p.sayT = 2.4;
  }
  sayText(p, text) { p.say = text; p.sayT = 2.6; }

  room(p) { return p.gone ? -1 : roomOf(p.f, p.x); }
  residents() { return this.people.filter((p) => p.resident); }
  left() { return this.people.filter((p) => p.resident && !p.gone && !p.leaving).length; }
  hourText(h = this.hour) {
    const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60 / 10) * 10;
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
  }

  // ------------------------------------------------------------- watching
  // who would see this object move right now?
  watchers(o) {
    const out = [];
    for (const p of this.people) {
      if (p.gone || p.asleep || this.room(p) !== o.room) continue;
      if (p.role === 'dog') { out.push(p); continue; }
      if (p.role === 'toddler') continue;       // Bea watches everything and tells no one
      const dx = o.x - p.x;
      const view = (p.role === 'torch' && p.state === 'search') ? TORCH_VIEW : VIEW;
      if (Math.abs(dx) < NEAR || (Math.sign(dx) === p.face && Math.abs(dx) <= view)) out.push(p);
    }
    return out;
  }
  watched(o) { return this.watchers(o).length > 0; }

  // ------------------------------------------------------------- haunting
  haunt(id) {
    const o = typeof id === 'string' ? this.objects.find((q) => q.id === id) : id;
    if (!o || this.result) return { ok: false };
    if (o.cool > 0) { this.emit('cooling', { o }); return { ok: false, why: 'cool' }; }
    if (this.ecto < 1) { this.emit('tired', { o }); return { ok: false, why: 'ecto' }; }
    this.ecto -= 1;
    o.cool = COOLDOWN; o.anim = 1.6; o.used++;
    this.ghost.tx = o.x; this.ghost.ty = floorY(o.f) - o.hy - 30; this.ghost.target = o;
    const w = this.watchers(o);
    if (w.length) {
      // seen: it's just a loose hinge, and they get a little braver
      this.chain = 0; this.lastTrick = -99; this.spotted++;
      const dog = w.find((p) => p.role === 'dog');
      if (dog) {
        this.barked++; dog.jump = 0.4; this.say(dog, 'bark', true);
        for (const p of this.people) if (!p.gone && p !== dog && this.room(p) === o.room && !p.asleep) {
          p.fear = Math.max(0, p.fear - 6); this.say(p, 'hush');
        }
        this.emit('bark', { o, p: dog });
      }
      for (const p of w) if (p.role !== 'dog') {
        p.fear = Math.max(0, p.fear - 8); p.habit[o.kind] = (p.habit[o.kind] || 0) + 1; this.say(p, 'spotted', true);
        p.face = Math.sign(o.x - p.x) || p.face;
      }
      this.emit('spotted', { o, who: w });
      return { ok: true, spotted: true };
    }
    // only tricks in the same room stack up: the lamp flickers WHILE the clock strikes
    if (this.t - this.lastTrick <= COMBO_WIN && this.lastRoom === o.room) this.chain++; else this.chain = 1;
    this.lastTrick = this.t; this.lastRoom = o.room;
    this.bestChain = Math.max(this.bestChain, this.chain);
    const mult = COMBO_MULT[Math.min(this.chain, COMBO_MULT.length - 1)];
    if (this.chain >= 3) this.tick3 = true;

    // is Bea in there laughing? then nobody in that room takes it seriously
    const bea = this.people.find((p) => p.role === 'toddler' && !p.gone && !p.asleep && this.room(p) === o.room);
    if (bea) { this.say(bea, 'giggle', true); bea.jump = 0.35; this.emit('giggle', { p: bea }); }
    const hits = [];
    for (const p of this.people) {
      if (p.gone || p.leaving || !p.resident) continue;
      const r = this.room(p);
      let k;
      if (r === o.room) k = p.asleep ? (p.heavy ? (o.loud ? 1.2 : 0.4) : 1.35) : 1;
      else if (o.loud && adjacent(r, o.room) && (!p.asleep || p.heavy)) k = 0.4;
      else continue;
      if (k === 0) continue;
      if (bea && r === o.room) k *= 0.3;
      const n = p.habit[o.kind] || 0;
      let gain = o.base * TUNE.fright * (this.night.nerve ?? 1) * k * mult * Math.pow(TUNE.habit, n);
      if (p.role === 'sceptic') gain *= this.chain >= 2 ? TUNE.scepticCombo : TUNE.sceptic;
      if (p.state === 'search') gain *= 0.8;          // he's braced for it
      const wasAsleep = p.asleep, wasSearching = p.state === 'search';
      // a sceptic laughs off a lone trick, so it doesn't wear off on them either
      if (r === o.room && !(p.role === 'sceptic' && this.chain < 2)) p.habit[o.kind] = n + 1;
      p.fear += gain; p.lastScare = this.t;
      if (this.tutCap) p.fear = Math.min(p.fear, this.tutCap);
      hits.push({ p, gain, near: r === o.room });
      if (r === o.room && o.room === 3 && p.act === 'bath' && p.atAct) this.done.add('bath');
      if (p.role === 'sceptic' && this.chain >= 2 && r === o.room) this.done.add('kit');
      if (wasAsleep && r === o.room) this.done.add('wake');
      if (wasSearching) this.done.add('torch');
      this.react(p, o, r === o.room, gain, wasAsleep);
    }
    if (hits.filter((h) => h.near).length >= 2) this.done.add('double');
    if (this.chain >= 3) this.done.add('combo3');
    if (this.chain >= 4) this.done.add('combo4');
    // the dog wakes up for anything loud in his room
    for (const p of this.people) if (p.role === 'dog' && p.asleep && this.room(p) === o.room && o.loud) { p.asleep = false; p.awakeT = 8; this.say(p, 'bark', true); }
    this.emit('haunt', { o, chain: this.chain, mult, hits });
    return { ok: true, chain: this.chain, hits };
  }

  react(p, o, near, gain, wasAsleep) {
    p.jump = near ? 0.45 : 0.2;
    if (p.fear >= FLEE_AT) { this.flee(p); return; }
    if (p.role === 'sceptic' && this.chain < 2) { if (near) this.say(p, 'sceptic', true); return; }
    if (wasAsleep) {
      p.asleep = false; p.awakeT = 7 + this.rand() * 3; p.face = Math.sign(o.x - p.x) || p.face;
      this.say(p, p.role === 'sceptic' ? 'scepticHit' : 'wake', true);
      this.emit('wake', { p });
      return;
    }
    if (p.role === 'sceptic') this.say(p, 'scepticHit', true);
    else this.say(p, p.fear > 62 ? 'scared' : 'startle', true);
    if (p.asleep || p.awakeT > 0) { p.face = Math.sign(o.x - p.x) || p.face; return; }
    if (!near) {
      // heard it through the wall: the curious and the torch-bearers come and look
      if (p.role === 'torch' || (p.fear < 35 && this.rand() < 0.5)) this.investigate(p, o, 0.6);
      return;
    }
    p.face = Math.sign(o.x - p.x) || p.face;
    if (p.role === 'torch' || p.fear < 58) this.investigate(p, o, 0.5);
    else this.seekCompany(p);
  }

  investigate(p, o, delay) {
    if (p.role === 'torch') this.say(p, 'torch');
    p.state = 'startle'; p.timer = delay; p.focus = o;
  }
  seekCompany(p) {
    const others = this.people.filter((q) => q !== p && !q.gone && !q.leaving && q.role !== 'dog');
    let best = null, bd = 1e9;
    for (const q of others) { const d = Math.abs(q.f - p.f) * 600 + Math.abs(q.x - p.x); if (this.room(q) !== this.room(p) && d < bd) { bd = d; best = q; } }
    if (!best) { p.state = 'startle'; p.timer = 0.5; p.focus = null; return; }
    p.state = 'company'; p.timer = 9; p.atAct = false;
    p.path = this.route(p, best.f, best.x + (best.x > 400 ? -40 : 40));
  }
  flee(p) {
    if (p.leaving) return;
    p.leaving = true; p.state = 'flee'; p.asleep = false; p.awakeT = 0; p.atAct = false;
    this.say(p, 'flee', true);
    p.path = this.route(p, 0, HW + 5).concat([{ x: HW + SW + 70, y: floorY(0), f: 0 }]);
    this.emit('flee', { p });
    // seeing someone bolt is frightening in itself
    for (const q of this.people) if (q !== p && q.resident && !q.gone && !q.leaving) {
      q.fear += TUNE.contagion; q.lastScare = this.t; this.say(q, 'gasp', true);
      if (q.fear >= FLEE_AT) this.flee(q);
    }
    if (this.left() === 0) {
      // the last grown-up out takes the little one and the dog
      for (const q of this.people) if (!q.resident && !q.leaving) {
        q.leaving = true; q.state = 'flee'; q.asleep = false; q.atAct = false;
        q.path = this.route(q, 0, HW + 5).concat([{ x: HW + SW + 70, y: floorY(0), f: 0 }]);
      }
    }
  }

  // a path of points from p to (f, x), by way of the stairwell if it changes floor
  route(p, f2, x2) {
    const pts = [];
    let f = p.f;
    if (p.f !== f2 || p.x >= HW) {
      pts.push({ x: HW + 12, y: floorY(f), f });
      while (f !== f2) {
        const up = f2 > f;
        pts.push({ x: HW + SW - 14, y: floorY(f) - (up ? FH / 2 : -FH / 2), f: -1, stair: true });
        f += up ? 1 : -1;
        pts.push({ x: HW + 12, y: floorY(f), f, stair: true });
      }
    }
    pts.push({ x: x2, y: floorY(f2), f: f2 });
    return pts;
  }

  // what this person is meant to be doing at this hour
  scheduled(p) {
    let a = p.sched[0][1];
    for (const [h, id] of p.sched) if (this.hour >= h) a = id;
    return a;
  }

  // ------------------------------------------------------------- the clock
  tick(dt) {
    if (this.result) { this.moveAll(dt); return; }
    this.t += dt;
    this.ecto = Math.min(ECTO_MAX, this.ecto + dt * this.ectoRegen);
    if (this.clockOn) this.hour = Math.min(NIGHT_END, this.hour + dt / this.hourLen);
    for (const o of this.objects) { o.cool = Math.max(0, o.cool - dt); o.anim = Math.max(0, o.anim - dt); }
    const gh = this.ghost; gh.bob += dt;
    gh.x += (gh.tx - gh.x) * Math.min(1, dt * 5); gh.y += (gh.ty - gh.y) * Math.min(1, dt * 5);
    if (gh.target && gh.target.anim <= 0) { gh.target = null; }
    for (const p of this.people) this.think(p, dt);
    this.moveAll(dt);
    if (this.left() === 0 && this.people.every((p) => p.gone)) {
      this.result = 'won'; this.wonHour = this.hour;
      if (this.hour < 25) this.done.add('early');
      if (this.barked === 0 && this.night.id === 'okafors') this.done.add('nodog');
      this.emit('won');
    } else if (this.hour >= NIGHT_END && this.left() > 0) {
      this.result = 'lost'; this.emit('lost');
    }
  }

  think(p, dt) {
    if (p.gone) return;
    p.sayT = Math.max(0, p.sayT - dt); if (p.sayT === 0) p.say = null;
    p.jump = Math.max(0, p.jump - dt);
    p.shown += (p.fear - p.shown) * Math.min(1, dt * 4);
    if (p.leaving) return;
    // calm down slowly once nothing has happened for a while
    if (this.t - p.lastScare > TUNE.calm) p.fear = Math.max(0, p.fear - dt * TUNE.decay * (p.asleep ? 0.6 : 1));
    // and slowly forget what they've got used to
    for (const k in p.habit) p.habit[k] = Math.max(0, p.habit[k] - dt * TUNE.forget);
    p.mood = p.fear > 62 ? 2 : p.fear > 28 ? 1 : 0;

    if (p.awakeT > 0) {
      // sat up in bed, looking about, until they drop off again
      p.awakeT -= dt;
      p.glance -= dt;
      if (p.glance <= 0) { p.face = -p.face; p.glance = 1.4 + this.rand(); }
      if (p.awakeT <= 0) { p.awakeT = 0; if (ACTS[p.act]?.sleep && p.atAct) p.asleep = true; }
      return;
    }
    if (p.state === 'startle') {
      p.timer -= dt;
      if (p.timer <= 0) {
        if (p.focus) {
          const o = p.focus;
          const side = p.x < o.x ? -1 : 1;
          const tx = Math.max(15, Math.min(HW - 15, o.x + side * 46));
          p.path = this.route(p, o.f, tx); p.state = p.role === 'torch' ? 'search' : 'look'; p.timer = 3.2; p.atAct = false; p.asleep = false;
        } else { p.state = 'idle'; }
      }
      return;
    }
    if (p.state === 'look' || p.state === 'search') {
      if (p.path) return;
      p.face = Math.sign(p.focus.x - p.x) || p.face;
      p.timer -= dt;
      if (p.timer <= 0) { p.state = 'idle'; p.focus = null; }
      return;
    }
    if (p.state === 'company') {
      if (p.path) return;
      p.timer -= dt; p.glance -= dt;
      if (p.glance <= 0) { p.face = -p.face; p.glance = 1.2 + this.rand() * 1.5; }
      if (p.timer <= 0) p.state = 'idle';
      return;
    }
    // ---- the routine
    const want = this.scheduled(p);
    if (want === 'follow') {
      const q = this.people[p.follow];
      if (!q || q.gone || q.leaving) return;
      const off = p.role === 'dog' ? -38 : 34;
      const tx = Math.max(20, Math.min(HW - 20, q.x + off * (q.face || 1) * -1));
      const far = q.f !== p.f || Math.abs(tx - p.x) > 70;
      if (far && !p.path) p.path = this.route(p, q.f, tx);
      if (!p.path) { p.face = Math.sign(q.x - p.x) || p.face; }
      if (p.role === 'dog') { p.glance -= dt; if (p.glance <= 0) { p.glance = 9 + this.rand() * 10; const others = this.people.filter((r) => r.resident && !r.gone && !r.leaving); if (others.length) p.follow = others[Math.floor(this.rand() * others.length)].i; } }
      p.act = null; p.asleep = false;
      return;
    }
    if (p.act !== want || (!p.atAct && !p.path)) {
      if (p.act !== want || !p.path) {
        p.act = want; p.atAct = false; p.asleep = false;
        const a = ACTS[want];
        p.path = this.route(p, a.f, a.x);
      }
      return;
    }
    if (!p.atAct) return;
    const a = ACTS[p.act];
    if (a.sleep) { p.asleep = true; p.face = a.face; return; }
    // idle at the activity, glancing over the shoulder now and then
    if (p.glancing > 0) {
      p.glancing -= dt;
      if (p.glancing <= 0) { p.face = a.face; p.glance = 3.5 + this.rand() * 5.5; }
    } else {
      p.glance -= dt;
      if (p.glance <= 0) { p.face = -a.face; p.glancing = 1.2 + this.rand() * 1.6; }
    }
  }

  moveAll(dt) {
    for (const p of this.people) {
      if (p.gone || !p.path) continue;
      const speed = (p.leaving ? 135 : p.role === 'dog' ? 110 : p.role === 'toddler' ? 80 : 92) * dt;
      let left = speed;
      while (left > 0 && p.path && p.path.length) {
        const n = p.path[0];
        const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.5) p.face = Math.sign(dx);
        if (d <= left) {
          p.x = n.x; p.y = n.y; if (n.f >= 0) p.f = n.f; left -= d; p.path.shift();
        } else {
          p.x += dx / d * left; p.y += dy / d * left; left = 0;
        }
        p.walkT += dt * 9;
      }
      if (p.path && !p.path.length) {
        p.path = null;
        if (p.leaving && p.x > HW + SW) { p.gone = true; this.emit('door', { p }); continue; }
        if (p.state === 'idle' && p.act && ACTS[p.act]) { p.atAct = true; p.face = ACTS[p.act].face; }
      }
    }
  }

  // ------------------------------------------------------------- for the bot and the demo
  // how much fright would this trick give right now, if nobody saw it?
  estimate(o, at) {
    if (o.cool > 0 || this.ecto < 1) return -1;
    if (this.watched(o)) return -2;
    const chain = at ?? (this.t - this.lastTrick <= COMBO_WIN && this.lastRoom === o.room ? this.chain + 1 : 1);
    const mult = COMBO_MULT[Math.min(chain, COMBO_MULT.length - 1)];
    const bea = this.people.some((p) => p.role === 'toddler' && !p.gone && !p.asleep && this.room(p) === o.room);
    let v = 0;
    for (const p of this.people) {
      if (p.gone || p.leaving || !p.resident) continue;
      const r = this.room(p);
      let k;
      if (r === o.room) k = p.asleep ? (p.heavy ? (o.loud ? 1.2 : 0.4) : 1.35) : 1;
      else if (o.loud && adjacent(r, o.room) && (!p.asleep || p.heavy)) k = 0.4; else continue;
      if (bea && r === o.room) k *= 0.3;
      let g = o.base * TUNE.fright * (this.night.nerve ?? 1) * k * mult * Math.pow(TUNE.habit, p.habit[o.kind] || 0);
      if (p.role === 'sceptic') g *= chain >= 2 ? TUNE.scepticCombo : TUNE.sceptic;
      v += Math.min(g, Math.max(0, FLEE_AT + 5 - p.fear));
    }
    return v;
  }
}

// A simple haunter. It looks at each room, adds up what a run of tricks there would do
// (ignoring that people turn round), and spends ectoplasm on the best run it can afford.
export class Bot {
  constructor(g, opts = {}) {
    this.g = g; this.wait = 0; this.react = opts.react ?? 0.35; this.greed = opts.greed ?? 5;
    this.save = opts.save ?? 1; this.rand = rng(opts.seed ?? 7); this.noise = opts.noise ?? 0;
  }
  tick(dt) {
    const g = this.g;
    this.wait -= dt;
    if (this.wait > 0 || g.result || g.ecto < 1) return null;
    this.wait = this.react * (0.6 + this.rand() * 0.8);
    // a careless haunter sometimes just pokes whatever's nearest to hand
    if (this.noise && this.rand() < this.noise) {
      const ok = g.objects.filter((o) => o.cool <= 0);
      if (ok.length && this.rand() < 0.5) { const o = ok[Math.floor(this.rand() * ok.length)]; g.haunt(o); return o; }
    }
    const chaining = g.t - g.lastTrick <= COMBO_WIN;
    let best = null, bv = 0;
    for (let r = 0; r < 6; r++) {
      const cont = chaining && g.lastRoom === r;
      const vals = g.objects.filter((o) => o.room === r).map((o) => [o, g.estimate(o, cont ? undefined : 2)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
      if (!vals.length) continue;
      if (cont) { if (vals[0][1] > 1) { best = vals[0][0]; bv = 1e9; } continue; }
      // a run starting here: each trick valued as if it were second in a combo, then scaled
      const n = Math.min(vals.length, Math.floor(g.ecto));
      let v = 0;
      for (let i = 0; i < n; i++) v += vals[i][1] * COMBO_MULT[Math.min(i + 1, COMBO_MULT.length - 1)] / COMBO_MULT[2];
      const per = v / n;
      if (per > bv && (n >= Math.min(vals.length, this.save) || per >= this.greed * 2)) { bv = per; best = vals[0][0]; }
    }
    if (best && bv >= this.greed) { g.haunt(best); return best; }
    return null;
  }
}
