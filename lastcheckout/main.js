// Last Checkout: a till at Bellamy's Foodstore for the last seven days of the world.
import { ITEMS, LOOKUP, PEOPLE, DAYS, GIFTS, verdict } from './data.js';
import { INK, FONT_HEAD, FONT_TILL, FONT_BODY, rr, fs, circ, label, drawItem, drawProduce, drawPerson, drawWindow, starburst, wrap, hash, shade } from './art.js';
import { unlock, sfx, setBelt, setRumble, isMuted, setMuted } from './sound.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const AUTO = params.has('auto');
const FAST = Number(params.get('fast')) || 1;

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const COL = {
  green: '#24614a', red: '#d23a2f', ticket: '#f6d34a', lam: '#d5dacb', lam2: '#c6ccbc', paper: '#fbf8ef',
  vfd: '#8ff0a4', vfdBg: '#10231a', steel: '#b9bec4', belt: '#2a2a2e', tile: '#ece6d4', beige: '#e3d6b8',
};
const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5];
const money = (p) => (p < 0 ? '-' : '') + '£' + (Math.abs(p) / 100).toFixed(2);
const moneyShort = (p) => p >= 100 ? '£' + (p / 100) : p + 'p';

// ------------------------------------------------------------------ layout
let W = 0, H = 0, DPR = 1, U = 1, OX = 0, OY = 0, L = null;

function makeLayout() {
  const portrait = W / H < 0.95;
  const bw = portrait ? 400 : 1000, bh0 = portrait ? 760 : 620;
  U = Math.min(W / bw, H / bh0);
  // spare height goes to the roomier parts of the counter rather than empty bands
  const e = Math.max(0, Math.min(portrait ? 190 : 150, H / U - bh0));
  const bh = bh0 + e;
  OX = (W - bw * U) / 2; OY = Math.max(0, (H - bh * U) / 2);
  if (portrait) {
    const c = 40;
    const a = e * 0.3, b = e * 0.2, d = e - a - b;
    L = {
      portrait, bw, bh, c,
      top: [0, 0, 400, 44],
      cust: [8, 46, 384, 152 + a],
      belt: [0, 204 + a, 400, 96],
      hold: [8, 308 + a, 184, 138 + b],
      scan: [200, 308 + a, 192, 138 + b],
      bag: [8, 454 + a + b, 198, 300 + d],
      till: [214, 454 + a + b, 178, 300 + d],
      drawer: [8, 454 + a + b, 384, 300 + d],
      days: null,
    };
    L.bagGrid = [L.bag[0] + 19, L.bag[1] + L.bag[3] - 12 - 5 * c];
  } else {
    const c = 44;
    L = {
      portrait, bw, bh, c,
      top: [0, 0, 1000, 44],
      cust: [8, 46, 292, 566 + e],
      belt: [310, 50, 470, 104],
      hold: [310, 162, 230, 200 + e * 0.4],
      scan: [550, 162, 230, 200 + e * 0.4],
      bag: [790, 162, 202, 450 + e],
      till: [310, 372 + e * 0.4, 470, 240 + e * 0.6],
      drawer: [310, 372 + e * 0.4, 470, 240 + e * 0.6],
      days: [790, 50, 202, 104],
    };
    L.bagGrid = [L.bag[0] + 13, L.bag[1] + L.bag[3] - 14 - 5 * c];
  }
  const gh = Math.min(L.scan[3] - 48, L.portrait ? 120 : 170);
  L.glass = [L.scan[0] + 10, L.scan[1] + 10 + (L.scan[3] - 48 - gh) / 2, L.scan[2] - 20, gh];
}

function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  makeLayout();
  for (const it of S.items) clampItem(it);
  // the belt is a different length now: keep things on it from piling into each other
  const belt = beltItems();
  for (let i = 1; i < belt.length; i++) belt[i].x = Math.min(belt[i].x, belt[i - 1].x - 6 - iw(belt[i]));
}
const inRect = (r, x, y) => r && x >= r[0] && y >= r[1] && x <= r[0] + r[2] && y <= r[1] + r[3];

// ------------------------------------------------------------------ state
const S = {
  mode: 'title', day: 0, flags: {}, week: { items: 0, customers: 0, covered: 0 },
  customers: [], ci: -1, cust: null,
  items: [], bags: 0, drag: null,
  scanner: { flash: 0, flashOk: true, lookup: null },
  till: { lines: [], total: 0 },
  phase: 'idle', phaseT: 0,
  pay: null, choice: null,
  speech: null, toasts: [], buttons: [], hints: {},
  stats: null, tut: null, ending: 0, t: 0, beltPhase: 0,
};
let seedN = 1;

function freshStats() { return { items: 0, time: 0, crushed: 0, wrongChange: 0, wrongLookup: 0, customers: 0 }; }

function save(day = S.day) {
  try { localStorage.setItem('lastcheckout.v1', JSON.stringify({ day, flags: S.flags, week: S.week })); } catch (e) {}
}
function load() {
  try { return JSON.parse(localStorage.getItem('lastcheckout.v1') || 'null'); } catch (e) { return null; }
}

// ------------------------------------------------------------------ items
function makeItem(id, cust) {
  const def = ITEMS[id];
  const it = { id, def, face: Math.random() < 0.5 ? 0 : 1, scanned: false, crushed: false, zone: 'queue', x: 0, y: 0, col: 0, row: 0, price: def.price || 0, seed: seedN++, cust, removed: false };
  if (def.produce) { it.kg = Math.round((0.4 + Math.random() * 1.1) * 1000) / 1000; it.price = Math.max(5, Math.round(def.perKg * it.kg / 5) * 5); it.face = 0; }
  return it;
}
const iw = (it) => it.def.w * L.c;
const ih = (it) => it.def.h * L.c;

function itemRect(it) {
  const w = iw(it), h = ih(it);
  switch (it.zone) {
    case 'belt': return [L.belt[0] + it.x, L.belt[1] + (L.belt[3] - h) / 2, w, h];
    case 'hold': return [L.hold[0] + it.x, L.hold[1] + it.y, w, h];
    case 'scan': return [L.glass[0] + (L.glass[2] - w) / 2, L.glass[1] + (L.glass[3] - h) / 2, w, h];
    case 'bag': return [L.bagGrid[0] + it.col * L.c, L.bagGrid[1] + (5 - it.row - it.def.h) * L.c, w, h];
    case 'drag': return [it.x, it.y, w, h];
    case 'leaving': return [it.x, it.y, w, h];
  }
  return null;
}
function clampItem(it) {
  if (it.zone === 'hold') {
    it.x = Math.max(2, Math.min(L.hold[2] - iw(it) - 2, it.x));
    it.y = Math.max(16, Math.min(L.hold[3] - ih(it) - 2, it.y));
  }
  if (it.zone === 'belt') it.x = Math.min(it.x, L.belt[2] - iw(it) - 8);
}
const beltItems = () => S.items.filter((i) => i.zone === 'belt').sort((a, b) => b.x - a.x);
const bagItems = () => S.items.filter((i) => i.zone === 'bag');
const custItems = () => S.items.filter((i) => i.cust === S.cust && !i.removed);

// column heights in the bag
function bagHeights(except) {
  const h = [0, 0, 0, 0];
  for (const b of bagItems()) {
    if (b === except) continue;
    for (let c = b.col; c < b.col + b.def.w; c++) h[c] = Math.max(h[c], b.row + b.def.h);
  }
  return h;
}
function bagLanding(it, col) {
  col = Math.max(0, Math.min(4 - it.def.w, col));
  const h = bagHeights(it);
  let row = 0;
  for (let c = col; c < col + it.def.w; c++) row = Math.max(row, h[c]);
  return { col, row, fits: row + it.def.h <= 5 };
}
function canFitAnywhere(it) {
  for (let c = 0; c <= 4 - it.def.w; c++) if (bagLanding(it, c).fits) return true;
  return false;
}
function clearOnTop(it) {
  return !bagItems().some((b) => b !== it && b.row === it.row + it.def.h && b.col < it.col + it.def.w && b.col + b.def.w > it.col);
}
// share each item's weight (and whatever it's carrying) between the things under it
function settleBag() {
  const items = bagItems().sort((a, b) => b.row - a.row);
  const load = new Map(items.map((i) => [i, 0]));
  for (const it of items) {
    const sup = items.filter((b) => b.row + b.def.h === it.row && b.col < it.col + it.def.w && b.col + b.def.w > it.col);
    const total = it.def.wt + load.get(it);
    for (const s of sup) load.set(s, load.get(s) + total / sup.length);
  }
  for (const it of items) {
    if (it.def.tol !== undefined && !it.crushed && load.get(it) > it.def.tol + 0.01) {
      it.crushed = true;
      S.stats.crushed++;
      sfx.crush(); shake(5);
      const pc = S.cust;
      if (pc) { pc.mood = Math.min(1, pc.mood + 0.35); if (pc.def.crush) say(pc.def.crush); }
      if (!S.hints.crush) { S.hints.crush = 1; toast('Too much weight on top. Heavy things at the bottom, squashy things last.', 5); }
    }
  }
}

// ------------------------------------------------------------------ actions (shared by touch, mouse, keys and the bot)
function flipItem(it) {
  if (it.def.produce) { sfx.rustle(); it.wobble = 0.3; return; }
  it.face = 1 - it.face; it.flipT = 0.18; sfx.flip();
  if (it.zone === 'scan' && it.face === 1 && !it.scanned) scanItem(it);
}
function scanItem(it) {
  if (it.scanned) return;
  it.scanned = true;
  S.till.lines.push({ name: it.def.name, price: it.price, kg: it.kg });
  S.till.total += it.price;
  S.scanner.flash = 0.35; S.scanner.flashOk = true;
  S.stats.items++; S.week.items++;
  sfx.beep();
  tutEvent('scan', it);
  const c = S.cust;
  if (c && !c.saidMid && c.def.mid) {
    const all = custItems();
    if (all.filter((i) => i.scanned).length >= Math.ceil(all.length / 2)) { c.saidMid = true; setTimeout(() => { if (S.cust === c && S.phase === 'work') say(c.def.mid); }, 500); }
  }
}
function putScanner(it) {
  const other = S.items.find((i) => i.zone === 'scan' && i !== it);
  if (other) return false;
  it.zone = 'scan';
  sfx.thud(0.4);
  if (it.def.produce && !it.scanned) { S.scanner.lookup = it; sfx.weigh(); tutEvent('weigh', it); }
  else if (!it.scanned) {
    if (it.face === 1) scanItem(it);
    else { sfx.noRead(); S.scanner.flash = 0.35; S.scanner.flashOk = false; hintBarcode(); }
  }
  return true;
}
function putHold(it, x, y) { it.zone = 'hold'; it.x = x; it.y = y; clampItem(it); sfx.thud(0.3); tutEvent('hold', it); }
function putBelt(it, x) { it.zone = 'belt'; it.x = Math.max(0, x); clampItem(it); sfx.thud(0.2); }
function tryBag(it, col) {
  if (!it.scanned) { toast(it.def.produce ? "Weigh it first: put it on the scanner glass." : "Scan it first.", 2.5); sfx.wrong(); return false; }
  if (S.tut && S.tut.blockBag === it.id) { say("Not yet! Park them on the counter, they go in last."); sfx.wrong(); return false; }
  const land = bagLanding(it, col);
  if (!land.fits) { toast('No room. Tap HAND OVER to give them this bag and start a new one.', 3.5); sfx.wrong(); S.hints.full = 1; return false; }
  it.zone = 'bag'; it.col = land.col; it.row = land.row;
  sfx.thud(Math.min(1.2, 0.3 + it.def.wt * 0.15)); sfx.rustle();
  settleBag();
  tutEvent('bag', it);
  return true;
}
function handOver() {
  const inBag = bagItems();
  if (!inBag.length) return;
  for (const it of inBag) { const r = itemRect(it); it.zone = 'leaving'; it.x = r[0]; it.y = r[1]; it.leaveT = 0; }
  S.bags++;
  sfx.bag();
}
function returnItem(it, from) {
  Object.assign(it, from);
  if (it.zone === 'drag') { it.zone = 'hold'; it.x = 10; it.y = 20; clampItem(it); }
  // loose produce put back on the glass still needs looking up
  if (it.zone === 'scan' && it.def.produce && !it.scanned) S.scanner.lookup = it;
}

function readyForTotal() {
  const c = S.cust;
  if (!c || S.phase !== 'work') return false;
  if (c.queue.length) return false;
  if (c.def.items.length === 0) return S.speech && S.speech.done && S.phaseT > 0.6;
  const mine = custItems();
  return mine.every((i) => i.scanned && (i.zone === 'bag' || i.zone === 'leaving' || i.zone === 'gone'));
}

function pressTotal() {
  if (!readyForTotal()) {
    const c = S.cust;
    if (c && S.phase === 'work') {
      const left = custItems().filter((i) => !i.scanned).length + c.queue.length;
      if (left) toast(`${left} still to scan.`, 2); else toast('Everything goes in the bag first.', 2);
      sfx.wrong();
    }
    return;
  }
  sfx.key();
  const c = S.cust;
  S.stats.time += S.t - c.startT;
  tutEvent('total');
  if (c.def.items.length === 0) { finishCustomer(); return; }
  handOver();
  if (c.def.coupon) { applyCoupon(c.def.coupon); toast("Coupon accepted. Dale said so.", 3); }
  if (c.def.choice) {
    S.phase = 'choice'; S.phaseT = 0;
    S.choice = c.def.choice;
    say(c.def.choice.say);
  } else startPayment();
}
function applyCoupon(p) {
  S.till.lines.push({ name: 'COUPON', price: -p }); S.till.total -= p;
}
function chooseOption(i) {
  if (S.phase !== 'choice' || !S.choice) return;
  const o = S.choice.options[i];
  sfx.key();
  const c = S.cust;
  c.choice = o;
  if (o.flag) S.flags[o.flag] = true;
  if (o.coupon) applyCoupon(o.coupon);
  if (o.remove) {
    for (const it of custItems().filter((i) => i.id === o.remove)) {
      it.removed = true; it.zone = 'gone';
      S.till.lines.push({ name: 'VOID ' + it.def.name, price: -it.price }); S.till.total -= it.price;
    }
  }
  if (o.short) { c.short = o.short; S.week.covered += o.short; S.till.lines.push({ name: 'YOU COVERED IT', price: -o.short }); S.till.total -= o.short; }
  if (o.iou) c.iou = true;
  S.choice = null;
  say(o.reply);
  S.phase = 'afterChoice'; S.phaseT = 0;
}

function startPayment() {
  const c = S.cust;
  const total = S.till.total;
  if (c.iou) { S.till.lines.push({ name: 'IOU', price: -total }); S.till.total = 0; printAndFinish(); return; }
  if (total <= 0 || c.def.pay === 0) { printAndFinish(); return; }
  if (c.def.pay === 'card') {
    S.phase = 'card'; S.phaseT = 0; S.pay = { kind: 'card', state: 'tap' };
    if (!S.hints.card) { S.hints.card = 1; toast('Card payment. Just wait for the beep.', 2.5); }
    return;
  }
  const owed = total;
  let given;
  if (c.def.pay === 'exact' || c.short) given = owed;
  else { given = c.def.pay; while (given < owed) given += 500; }
  S.pay = { kind: 'cash', total: owed, given, due: given - owed, tray: [], wrong: 0 };
  sfx.drawer();
  S.phase = 'cash'; S.phaseT = 0;
  if (S.pay.due === 0) { S.pay.exact = true; }
}
function addCoin(v) {
  if (S.phase !== 'cash' || !S.pay || S.pay.exact) return;
  if (S.pay.tray.length >= 14) return;
  S.pay.tray.push(v); v >= 500 ? sfx.note() : sfx.coin();
}
function removeCoin(i) { if (S.pay && S.pay.tray.length) { S.pay.tray.splice(i ?? S.pay.tray.length - 1, 1); sfx.coin(); } }
function giveChange() {
  if (S.phase !== 'cash') return;
  const p = S.pay;
  const sum = p.tray.reduce((a, b) => a + b, 0);
  if (p.exact || sum === p.due) {
    sfx.drawer();
    tutEvent('paid');
    printAndFinish();
    return;
  }
  S.stats.wrongChange++; p.wrong++;
  sfx.wrong();
  const diff = p.due - sum;
  say(diff > 0 ? `I think that's ${moneyShort(diff)} short, love. It should be ${money(p.due)}.` : `That's ${moneyShort(-diff)} too much! It's only ${money(p.due)}.`);
  S.cust.mood = Math.min(1, S.cust.mood + 0.15);
}
function pickLookup(id) {
  const it = S.scanner.lookup;
  if (!it) return;
  sfx.key();
  if (id === it.id) {
    S.scanner.lookup = null;
    scanItem(it);
  } else {
    S.stats.wrongLookup++;
    sfx.wrong();
    say(`Those aren't ${ITEMS[id].name.toLowerCase()}, love. They're ${it.def.name.toLowerCase()}.`);
  }
}

function printAndFinish() {
  sfx.print();
  S.phase = 'bye'; S.phaseT = 0; S.pay = null;
  const c = S.cust;
  if (c.def.gift) {}
  say(c.def.bye);
}
function finishCustomer() {
  sfx.print();
  S.phase = 'bye'; S.phaseT = 0;
  const c = S.cust;
  if (c.def.gift && GIFTS[c.def.gift]) { S.flags['got_' + c.def.gift] = true; toast(GIFTS[c.def.gift], 5); }
  say(c.def.bye);
}

// ------------------------------------------------------------------ customers and days
function startDay(d, again = false) {
  // starting the same day again shouldn't count its customers or choices twice
  if (again && S.dayStart && S.dayStart.day === d) { S.week = { ...S.dayStart.week }; S.flags = { ...S.dayStart.flags }; }
  S.dayStart = { day: d, week: { ...S.week }, flags: { ...S.flags } };
  S.day = d; S.ci = -1; S.items = []; S.bags = 0; S.stats = freshStats();
  S.till = { lines: [], total: 0 };
  S.customers = DAYS[d].customers.filter((c) => !c.when || (c.when[0] === '!' ? !S.flags[c.when.slice(1)] : S.flags[c.when]));
  if (S.skipTutorial) S.customers = S.customers.filter((c) => !c.tutorial);
  S.mode = 'shift'; S.phase = 'idle'; S.speech = null; S.toasts = [];
  setRumble(d);
  save();
  nextCustomer();
}
function nextCustomer() {
  S.ci++;
  S.items = S.items.filter((i) => i.zone !== 'gone' && i.zone !== 'leaving' && !(i.cust && i.cust !== S.cust));
  S.items = [];
  S.scanner.lookup = null;
  if (S.ci >= S.customers.length) { endShift(); return; }
  const def = S.customers[S.ci];
  const c = { def, person: PEOPLE[def.who], queue: [], mood: 0, x: -1, startT: S.t, saidMid: false, blink: 0 };
  S.cust = c;
  c.queue = def.items.map((id) => makeItem(id, c));
  if (def.tutorial && !S.skipTutorial) {
    const forced = { beans: 1, crisps: 0, milk: 1, eggs: 1 };
    for (const it of c.queue) if (it.id in forced) it.face = forced[it.id];
    S.tut = { step: 0, t: 0 };
  } else S.tut = null;
  S.till = { lines: [], total: 0 };
  S.phase = 'arrive'; S.phaseT = 0; S.speech = null;
  S.stats.customers++; S.week.customers++;
}
function endShift() {
  S.mode = 'card'; S.cust = null;
  setBelt(false);
  if (S.day >= 6) { startEnding(); return; }
  save(S.day + 1);
  showShiftReceipt();
}

// ------------------------------------------------------------------ speech, toasts, shake
function say(text) {
  S.speech = { text, shown: 0, done: false, t: 0 };
}
function toast(text, life = 3) {
  if (S.toasts.some((t) => t.text === text)) return;
  S.toasts.push({ text, t: 0, life });
  if (S.toasts.length > 2) S.toasts.shift();
}
function hintBarcode() {
  if (S.hints.barcode > 2) return;
  S.hints.barcode = (S.hints.barcode || 0) + 1;
  toast(L.portrait || matchMedia('(pointer: coarse)').matches ? "No barcode showing. Tap the item to turn it over." : "No barcode showing. Click the item (or press F while holding it) to turn it over.", 3);
}
let shakeA = 0;
function shake(a) { shakeA = Math.max(shakeA, a); }

// ------------------------------------------------------------------ tutorial (Dale's first day)
const TUT = [
  { say: null, wait: 'hello', allow: [] },
  { say: "Right. Pick up the beans and drag them across the scanner glass. Barcode showing, it beeps.", allow: ['beans'], arrow: ['beans', 'glass'], done: (e, it) => e === 'scan' && it.id === 'beans' },
  { say: "Lovely. Now drop them in the bag. Heavy things at the bottom.", allow: ['beans'], arrow: ['beans', 'bag'], done: (e, it) => e === 'bag' && it.id === 'beans' },
  { say: "Crisps. The barcode's always on the back. Tap them once to turn them over, then scan them.", allow: ['crisps'], arrow: ['crisps', 'glass'], done: (e, it) => e === 'scan' && it.id === 'crisps', flipHint: true },
  { say: "Crisps squash. Park them on the counter for now. Squashy things go in the bag last.", allow: ['crisps'], arrow: ['crisps', 'hold'], blockBag: 'crisps', done: (e, it) => e === 'hold' && it.id === 'crisps' },
  { say: "Loose bananas. No barcode. Put them on the glass to weigh them.", allow: ['bananas'], arrow: ['bananas', 'glass'], done: (e, it) => e === 'weigh' },
  { say: "Now tell the till what they are. Tap the bananas.", allow: [], arrow: ['scale', 'lookup'], done: (e, it) => e === 'scan' && it.id === 'bananas' },
  { say: "Bag them.", allow: ['bananas'], arrow: ['bananas', 'bag'], done: (e, it) => e === 'bag' && it.id === 'bananas' },
  { say: "Milk. Scan it, bag it. Heavy, so it goes in low.", allow: ['milk'], arrow: ['milk', 'glass'], done: (e, it) => e === 'bag' && it.id === 'milk' },
  { say: "Eggs. Scan them and put them on top. Never underneath anything.", allow: ['eggs'], arrow: ['eggs', 'glass'], done: (e, it) => e === 'bag' && it.id === 'eggs' },
  { say: "And now the crisps, on top. Light stuff last.", allow: ['crisps'], arrow: ['crisps', 'bag'], done: (e, it) => e === 'bag' && it.id === 'crisps' },
  { say: "That's the lot. Press TOTAL.", allow: [], arrow: [null, 'total'], done: (e) => e === 'total' },
  { say: "I'm giving you a tenner. The till works out the change. Tap the coins to make it up, then GIVE.", allow: [], arrow: [null, 'coins'], done: (e) => e === 'paid' },
];
function tutStep() { return S.tut ? TUT[S.tut.step] : null; }
function tutAdvance() {
  S.tut.step++; S.tut.t = 0;
  const st = TUT[S.tut.step];
  if (!st) { S.tut = null; return; }
  S.tut.blockBag = st.blockBag || null;
  if (st.say) say(st.say);
}
function tutEvent(e, it) {
  const st = tutStep();
  if (!st || !st.done) return;
  // pressing TOTAL or paying is handled by the step that waits for it
  if (st.done(e, it || {})) setTimeout(() => { if (S.tut && TUT[S.tut.step] === st) tutAdvance(); }, 350);
}
function tutAllows(it) {
  const st = tutStep();
  if (!st || !st.allow) return true;
  return st.allow.includes(it.id);
}

// ------------------------------------------------------------------ update
function update(dt) {
  S.t += dt;
  S.phaseT += dt;
  S.beltPhase += 0;
  if (S.scanner.flash > 0) S.scanner.flash -= dt;
  for (const t of S.toasts) t.t += dt;
  S.toasts = S.toasts.filter((t) => t.t < t.life);
  shakeA *= Math.pow(0.02, dt);

  // speech typewriter
  if (S.speech && !S.speech.done) {
    const before = Math.floor(S.speech.shown);
    S.speech.shown += dt * 52;
    if (Math.floor(S.speech.shown / 3) !== Math.floor(before / 3) && S.cust) sfx.talk(S.cust.person.pitch);
    if (S.speech.shown >= S.speech.text.length) { S.speech.shown = S.speech.text.length; S.speech.done = true; }
  }
  if (S.speech) S.speech.t += dt;

  for (const it of S.items) {
    if (it.flipT > 0) it.flipT -= dt;
    if (it.wobble > 0) it.wobble -= dt;
    if (it.zone === 'leaving') {
      it.leaveT += dt;
      const tx = L.cust[0] + L.cust[2] * 0.25, ty = L.cust[1] + L.cust[3] * (L.portrait ? 0.7 : 0.45);
      it.x += (tx - it.x) * Math.min(1, dt * 5); it.y += (ty - it.y) * Math.min(1, dt * 5);
      if (it.leaveT > 0.6) it.zone = 'gone';
    }
  }

  const c = S.cust;
  if (S.mode !== 'shift' || !c) return;
  c.blink = (S.t % 3.7) < 0.12;
  if (c.x < 0) c.x = Math.min(0, c.x + dt * 3.2);
  if (S.phase === 'arrive' && S.phaseT > 0.4) {
    S.phase = 'work'; S.phaseT = 0;
    say(c.def.hello);
    c.startT = S.t; c.unloadT = 0.5;
    if (S.tut) { S.tut.step = 0; }
  }
  if (S.phase === 'work') {
    // tutorial: wait for the hello before Dale starts teaching
    if (S.tut && S.tut.step === 0 && S.speech && S.speech.done && S.speech.t > 0.6) tutAdvance();
    // unload onto the belt
    c.unloadT -= dt;
    if (c.queue.length && c.unloadT <= 0) {
      const minX = Math.min(999, ...beltItems().map((i) => i.x));
      const next = c.queue[0];
      if (minX > 6) {
        c.queue.shift();
        next.zone = 'belt'; next.x = -iw(next) - 2;
        S.items.push(next);
        c.unloadT = 0.32;
      }
    }
    // patience
    const expected = 8 + c.def.items.length * 5;
    if (S.t - c.startT > expected) c.mood = Math.min(1, c.mood + dt * 0.02);
  }
  // the belt
  let moving = false;
  const belt = beltItems();
  for (let i = 0; i < belt.length; i++) {
    const it = belt[i];
    const lim = i === 0 ? L.belt[2] - iw(it) - 8 : belt[i - 1].x - 6 - iw(it);
    if (it.x < lim - 0.5) { it.x = Math.min(lim, it.x + dt * 150); moving = true; }
  }
  if (moving) S.beltPhase += dt * 150;
  setBelt(moving);

  if (S.phase === 'afterChoice' && S.speech && S.speech.done && S.phaseT > 1.2) startPayment();
  if (S.phase === 'card') {
    if (S.pay.state === 'tap' && S.phaseT > 1.3) { S.pay.state = 'ok'; sfx.card(); S.phaseT = 0; }
    else if (S.pay.state === 'ok' && S.phaseT > 0.8) printAndFinish();
  }
  if (S.phase === 'cash' && S.pay && S.pay.exact && S.phaseT > 1.4) { sfx.coin(); printAndFinish(); }
  if (S.phase === 'bye' && S.speech && S.speech.done && S.phaseT > Math.max(1.6, S.speech.text.length / 40)) {
    S.phase = 'leave'; S.phaseT = 0;
  }
  if (S.phase === 'leave') {
    c.x += dt * 2.5;
    if (S.phaseT > 0.7) {
      if (c.def.final) { endShift(); return; }
      nextCustomer();
    }
  }
}

// ------------------------------------------------------------------ input
let pointers = new Map();
function toBase(e) { return [(e.clientX - OX) / U, (e.clientY - OY) / U]; }

function hitItem(x, y) {
  const order = ['belt', 'hold', 'scan', 'bag'];
  for (let zi = order.length - 1; zi >= 0; zi--) {
    const list = S.items.filter((i) => i.zone === order[zi]);
    for (let i = list.length - 1; i >= 0; i--) {
      const r = itemRect(list[i]);
      if (r && x >= r[0] - 3 && x <= r[0] + r[2] + 3 && y >= r[1] - 3 && y <= r[1] + r[3] + 3) return list[i];
    }
  }
  return null;
}
function canGrab(it) {
  if (S.mode !== 'shift' || !['work'].includes(S.phase)) return false;
  if (it.cust !== S.cust) return false;
  if (!tutAllows(it)) return false;
  if (it.zone === 'bag' && !clearOnTop(it)) return false;
  return true;
}

canvas.addEventListener('pointerdown', (e) => {
  unlock();
  e.preventDefault();
  const [x, y] = toBase(e);
  if (S.drag && pointers.size >= 1) { // a second finger flips what you're holding
    flipItem(S.drag.item); S.drag.flipped = true; pointers.set(e.pointerId, { x, y, second: true }); return;
  }
  pointers.set(e.pointerId, { x, y });
  if (S.mode !== 'shift') return;
  for (let i = S.buttons.length - 1; i >= 0; i--) {
    const b = S.buttons[i];
    if (inRect(b.r, x, y) && !b.disabled) { b.press = 0.12; b.fn(); return; }
    if (inRect(b.r, x, y) && b.disabled) { b.disabledFn?.(); return; }
  }
  const it = hitItem(x, y);
  if (it && canGrab(it)) {
    const r = itemRect(it);
    const from = { zone: it.zone, x: it.x, y: it.y, col: it.col, row: it.row };
    if (it.zone === 'scan' && S.scanner.lookup === it) S.scanner.lookup = null;
    it.zone = 'drag'; it.x = r[0]; it.y = r[1];
    S.drag = { item: it, offX: x - r[0], offY: y - r[1], sx: x, sy: y, t0: performance.now(), from, moved: false, hover: 0, id: e.pointerId };
    canvas.setPointerCapture?.(e.pointerId);
  } else if (it && S.tut && !tutAllows(it)) {
    toast('One thing at a time. Follow the arrow.', 1.6);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const [x, y] = toBase(e);
  S.mouse = [x, y];
  const d = S.drag;
  if (!d || d.id !== e.pointerId) return;
  const it = d.item;
  if (Math.hypot(x - d.sx, y - d.sy) > 7) d.moved = true;
  it.x = x - d.offX; it.y = y - d.offY;
});
function endDrag(e) {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  const d = S.drag;
  if (!d || d.id !== e.pointerId) return;
  S.drag = null;
  const it = d.item;
  const [x, y] = toBase(e);
  if (!d.moved && performance.now() - d.t0 < 400) {
    returnItem(it, d.from);
    if (!d.flipped) flipItem(it);
    return;
  }
  dropItem(it, x, y, d.from);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId);
  if (S.drag && S.drag.id === e.pointerId) { returnItem(S.drag.item, S.drag.from); S.drag = null; }
});

function dropItem(it, x, y, from) {
  const r = itemRect(it);
  const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
  const at = (rect) => inRect(rect, x, y) || inRect(rect, cx, cy);
  if (at(L.bag) || (inRect([L.bag[0] - 10, L.bag[1] - 40, L.bag[2] + 20, 40], x, y))) {
    const col = Math.round((r[0] - L.bagGrid[0]) / L.c);
    if (tryBag(it, col)) return;
    returnItem(it, from); return;
  }
  if (at(L.scan)) {
    if (putScanner(it)) return;
    toast("The scanner's busy. Move that one first.", 2); returnItem(it, from); return;
  }
  if (at(L.hold)) { putHold(it, r[0] - L.hold[0], r[1] - L.hold[1]); return; }
  if (at(L.belt)) { putBelt(it, r[0] - L.belt[0]); return; }
  returnItem(it, from);
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  unlock();
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (S.mode === 'shift') pause(); else if (S.mode === 'paused') resume(); return; }
  if (k === 'm') { toggleMute(); return; }
  if (S.mode !== 'shift') return;
  if (k === 'f' || k === ' ') {
    e.preventDefault();
    if (S.drag) { flipItem(S.drag.item); S.drag.flipped = true; }
    else if (S.mouse) { const it = hitItem(...S.mouse); if (it && canGrab(it)) flipItem(it); }
  }
  if (k === 'enter') {
    if (S.phase === 'work') pressTotal();
    else if (S.phase === 'cash') giveChange();
  }
  if (k === 'backspace' && S.phase === 'cash') removeCoin();
  if (k === 'h' && S.phase === 'work') handOver();
  if (/^[1-8]$/.test(k)) {
    if (S.scanner.lookup) pickLookup(LOOKUP[+k - 1]);
    else if (S.phase === 'cash') addCoin(DENOMS[+k - 1]);
    else if (S.phase === 'choice' && +k <= 2) chooseOption(+k - 1);
  }
});

// ------------------------------------------------------------------ drawing
function btn(r, text, fn, o = {}) {
  const b = { r, text, fn, ...o };
  S.buttons.push(b);
  return b;
}
function drawTicket(r, text, o = {}) {
  const [x, y, w, h] = r;
  const down = o.down;
  ctx.save();
  if (down) ctx.translate(0, 2);
  if (!o.flat) { ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(ctx, x + 2, y + 3, w, h, 5); ctx.fill(); }
  rr(ctx, x, y, w, h, 5);
  fs(ctx, o.disabled ? '#d9d4c4' : (o.fill || COL.ticket), 2.4);
  if (o.flag && !o.disabled) { ctx.fillStyle = COL.red; ctx.save(); rr(ctx, x, y, w, h, 5); ctx.clip(); ctx.fillRect(x, y, 8, h); ctx.restore(); }
  ctx.globalAlpha = o.disabled ? 0.45 : 1;
  label(ctx, text, x + w / 2 + (o.flag ? 4 : 0), y + h / 2 + (o.sub ? -7 : 0), w - 16, o.size || 17, o.ink || INK);
  if (o.sub) { ctx.font = `${o.subSize || 11}px ${FONT_TILL}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText(o.sub, x + w / 2 + (o.flag ? 4 : 0), y + h / 2 + 12); }
  ctx.restore();
}

let laminate = null;
function makeLaminate() {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = COL.lam; g.fillRect(0, 0, 160, 160);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = hash(i) < 0.5 ? 'rgba(80,90,70,.12)' : 'rgba(255,255,255,.25)';
    g.fillRect(hash(i * 3.1) * 160, hash(i * 7.7) * 160, 1 + hash(i * 1.3) * 1.5, 1 + hash(i * 2.9) * 1.5);
  }
  laminate = ctx.createPattern(c, 'repeat');
}

function render() {
  const t = S.t;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = COL.lam2; ctx.fillRect(0, 0, W, H);
  if (!laminate) makeLaminate();
  ctx.fillStyle = laminate; ctx.fillRect(0, 0, W, H);
  const sx = (Math.random() - 0.5) * shakeA, sy = (Math.random() - 0.5) * shakeA;
  ctx.setTransform(U * DPR, 0, 0, U * DPR, (OX + sx) * DPR, (OY + sy) * DPR);
  S.buttons = [];

  drawTopBar();
  drawCustomerStrip();
  drawBelt();
  drawHold();
  drawScanner();
  drawBag();
  const paying = S.phase === 'cash' || S.phase === 'card';
  if (S.phase === 'cash' && S.pay) drawDrawer();
  else if (S.phase === 'card' && S.pay) { drawTill(); drawCard(); }
  else if (S.scanner.lookup) drawLookup();
  else drawTill();
  if (S.phase === 'choice' && S.choice) drawChoice();
  if (L.days) drawDaysCard(L.days);

  // items in the hold/scan/bag are drawn by their zones; draw the moving ones last
  for (const it of S.items) if (it.zone === 'leaving') drawOneItem(it, 1 - it.leaveT / 0.6);
  if (S.drag) {
    const it = S.drag.item;
    drawBagGhost(it);
    const r = itemRect(it);
    ctx.save(); ctx.translate(r[0] + r[2] / 2, r[1] + r[3] / 2); ctx.scale(1.08, 1.08); ctx.translate(-r[0] - r[2] / 2, -r[1] - r[3] / 2);
    drawOneItem(it, 1, true);
    ctx.restore();
    // scanning as it passes over the glass
    const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
    if (inRect(L.glass, cx, cy)) {
      if (!it.scanned && !it.def.produce && it.face === 1) scanItem(it);
      else if (!it.scanned && !it.def.produce && it.face === 0) { S.drag.hover += 1 / 60; if (S.drag.hover > 0.7 && !S.drag.hinted) { S.drag.hinted = true; sfx.noRead(); S.scanner.flash = 0.3; S.scanner.flashOk = false; hintBarcode(); } }
    }
  }
  drawTutorialArrow();
  drawToasts();

  // the light from outside, a little stronger every day
  const glow = [0, 0.02, 0.04, 0.07, 0.1, 0.14, 0.2][S.day] || 0;
  if (glow && S.mode !== 'title') {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255,170,90,${glow * 3})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,220,170,${glow * 0.6})`; ctx.fillRect(0, 0, W, H);
  }
  if (S.ending > 0) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = `rgba(255,251,240,${Math.min(1, S.ending)})`; ctx.fillRect(0, 0, W, H);
  }
}

function drawTopBar() {
  const [x, y, w, h] = L.top;
  ctx.fillStyle = COL.green; ctx.fillRect(x - 2000, y - 200, w + 4000, h + 200);
  ctx.fillStyle = COL.red; ctx.fillRect(x - 2000, y + h - 5, w + 4000, 5);
  const day = DAYS[Math.min(6, S.day)];
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `${L.portrait ? 17 : 20}px ${FONT_HEAD}`; ctx.fillStyle = '#fbf8ef';
  ctx.fillText(day.name.toUpperCase(), x + 60, y + h / 2 - 1);
  const dw = ctx.measureText(day.name.toUpperCase()).width;
  if (L.portrait) {
    ctx.font = `12px ${FONT_TILL}`; ctx.fillStyle = COL.ticket;
    ctx.fillText(day.left === 1 ? 'LAST DAY' : `${day.left} DAYS LEFT`, x + 66 + dw, y + h / 2);
  } else {
    ctx.font = `14px ${FONT_TILL}`; ctx.fillStyle = '#cfe6d8';
    ctx.fillText("BELLAMY'S FOODSTORE · TILL 2", x + 74 + dw, y + h / 2);
  }
  // customers today, as little dots
  const n = S.customers.length;
  ctx.textAlign = 'right';
  const rx = x + w - 96;
  for (let i = 0; i < n; i++) {
    const cx = rx - (n - 1 - i) * (L.portrait ? 11 : 13);
    circ(ctx, cx, y + h / 2, L.portrait ? 3.8 : 4.5);
    ctx.fillStyle = i < S.ci ? COL.ticket : i === S.ci ? '#fbf8ef' : 'rgba(255,255,255,.2)'; ctx.fill();
  }
  // mute & pause
  const mb = btn([x + w - 84, y + 6, 36, 32], '', toggleMute);
  const pb = btn([x + w - 44, y + 6, 36, 32], '', pause);
  for (const b of [mb, pb]) { rr(ctx, ...b.r, 6); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(); }
  ctx.strokeStyle = '#fbf8ef'; ctx.fillStyle = '#fbf8ef'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  // speaker
  const [mx, my] = [mb.r[0] + 10, mb.r[1] + 16];
  ctx.beginPath(); ctx.moveTo(mx, my - 4); ctx.lineTo(mx + 4, my - 4); ctx.lineTo(mx + 9, my - 8); ctx.lineTo(mx + 9, my + 8); ctx.lineTo(mx + 4, my + 4); ctx.lineTo(mx, my + 4); ctx.closePath(); ctx.fill();
  if (isMuted()) { ctx.beginPath(); ctx.moveTo(mx + 13, my - 5); ctx.lineTo(mx + 19, my + 5); ctx.moveTo(mx + 19, my - 5); ctx.lineTo(mx + 13, my + 5); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(mx + 10, my, 6, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(mx + 10, my, 10, -0.8, 0.8); ctx.stroke(); }
  const [px, py] = [pb.r[0] + 18, pb.r[1] + 16];
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(px - 8, py + i * 6); ctx.lineTo(px + 8, py + i * 6); ctx.stroke(); }
}

function drawCustomerStrip() {
  const [x, y, w, h] = L.cust;
  // tiled wall
  ctx.save(); rr(ctx, x, y, w, h, 8); ctx.clip();
  ctx.fillStyle = COL.tile; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120,110,90,.18)'; ctx.lineWidth = 1;
  for (let gx = x; gx < x + w; gx += 22) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let gy = y; gy < y + h; gy += 22) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
  // the window
  const win = L.portrait ? [x + 8, y + 8, w - 16, h - 30] : [x + 10, y + 10, w - 20, 270];
  drawWindow(ctx, ...win, S.day, S.t);
  // a poster in the window that changes as the week goes on
  const poster = ['OPEN AS USUAL', 'OPEN AS USUAL', 'NO DELIVERIES', 'OPEN!', 'TAKE WHAT YOU NEED', 'OPEN TILL THE END', 'THANK YOU'][S.day];
  const pr = L.portrait ? [x + w - 104, y + h - 62, 88, 30] : [x + w - 140, y + 56, 110, 40];
  ctx.save(); ctx.translate(pr[0] + pr[2] / 2, pr[1] + pr[3] / 2); ctx.rotate(-0.04);
  rr(ctx, -pr[2] / 2, -pr[3] / 2, pr[2], pr[3], 2); fs(ctx, '#fbf8ef', 1.8);
  label(ctx, poster, 0, 0, pr[2] - 10, 11, COL.red);
  ctx.restore();

  // the customer
  const c = S.cust;
  if (c && S.mode === 'shift') {
    const px = L.portrait ? x + 78 : x + w / 2;
    const by = L.portrait ? y + h + 4 : y + 300;
    const sc = L.portrait ? 0.92 : 1.35;
    const off = c.x * (L.portrait ? 220 : 320);
    const talking = S.speech && !S.speech.done ? (Math.sin(S.t * 26) * 0.5 + 0.5) : 0;
    const p = c.person;
    if (p.plus) drawPerson(ctx, { ...p.plus, pitch: 1 }, px + off + 40 * sc, by, sc * 0.92, { mood: c.mood, blink: (S.t % 4.3) < 0.1 });
    drawPerson(ctx, p, px + off - (p.plus ? 18 * sc : 0), by, sc, { mood: c.mood, blink: c.blink, talk: talking });
    // name tag
    ctx.font = `12px ${FONT_TILL}`;
    const nt = p.name.toUpperCase();
    const ntw = ctx.measureText(nt).width + 14;
    const nx = L.portrait ? x + 8 : x + w / 2 - ntw / 2, ny = L.portrait ? y + h - 20 : y + 300;
    if (!L.portrait) { ctx.fillStyle = COL.green; ctx.fillRect(x, y + 300, w, 4); }
    rr(ctx, nx + off, ny, ntw, 18, 3); fs(ctx, '#fbf8ef', 1.6);
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(nt, nx + off + 7, ny + 10);
  }
  if (!L.portrait && h > 640) drawNotice([x + 16, y + h - 132, w - 32, 116]);
  ctx.restore();
  rr(ctx, x, y, w, h, 8); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();

  if (c && S.speech && S.mode === 'shift') drawBubble();
}

const NOTICES = [
  'NEW STARTER ON TILL 2. BE NICE. — D.',
  'COUPON POLICY STILL APPLIES. — D.',
  'NO DELIVERY TODAY. PROBABLY TRAFFIC. — D.',
  'WEDDING 2PM AT THE BANDSTAND!! (not you, you are working)',
  'STAFF: TAKE WHAT YOU NEED. — D.',
  'GALLOWS HILL. SUNDAY. DUSK. BRING SOMEONE.',
  'THANK YOU ALL. IT WAS A GOOD SHOP. — D.',
];
function drawNotice(r) {
  const [x, y, w, h] = r;
  rr(ctx, x, y, w, h, 4); fs(ctx, '#b98a5a', 2.2);
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(0.02);
  const pw = w - 40, ph = h - 26;
  rr(ctx, -pw / 2, -ph / 2, pw, ph, 1); fs(ctx, '#fbf8ef', 1.6);
  ctx.fillStyle = COL.red; circ(ctx, 0, -ph / 2 + 2, 5); ctx.fill();
  ctx.font = `14px ${FONT_TILL}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const lines = wrap(ctx, NOTICES[Math.min(6, S.day)], pw - 20);
  lines.slice(0, 4).forEach((ln, i) => ctx.fillText(ln, 0, -ph / 2 + 12 + i * 17));
  ctx.restore();
}

function drawBubble() {
  const [x, y, w, h] = L.cust;
  const sp = S.speech;
  const br = L.portrait ? [x + 150, y + 8, w - 158, Math.min(h - 16, 150)] : [x + 12, y + 336, w - 24, h - (h > 640 ? 486 : 348)];
  const text = sp.text.slice(0, Math.floor(sp.shown));
  let size = L.portrait ? 14.5 : 18;
  let lines;
  for (;;) {
    ctx.font = `${size}px ${FONT_BODY}`;
    lines = wrap(ctx, sp.text, br[2] - 24);
    if (lines.length * size * 1.25 <= br[3] - 18 || size <= 10) break;
    size -= 0.5;
  }
  // shrink the bubble to fit the full text
  const bh = Math.min(br[3], lines.length * size * 1.25 + 20);
  const by = L.portrait ? br[1] + (br[3] - bh) / 2 : br[1];
  ctx.save();
  rr(ctx, br[0], by, br[2], bh, 12); fs(ctx, '#fffdf6', 2.4);
  // tail
  ctx.beginPath();
  if (L.portrait) { ctx.moveTo(br[0] + 1, by + bh * 0.5 - 8); ctx.lineTo(br[0] - 12, by + bh * 0.5 + 4); ctx.lineTo(br[0] + 1, by + bh * 0.5 + 6); }
  else { ctx.moveTo(br[0] + br[2] * 0.72 - 10, by + 1); ctx.lineTo(br[0] + br[2] * 0.72 - 16, by - 18); ctx.lineTo(br[0] + br[2] * 0.72 + 10, by + 1); }
  ctx.fillStyle = '#fffdf6'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#fffdf6';
  if (L.portrait) ctx.fillRect(br[0] - 1, by + bh * 0.5 - 6, 4, 11); else ctx.fillRect(br[0] + br[2] * 0.72 - 8, by - 1, 16, 4);
  // text, revealed as it's said
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `${size}px ${FONT_BODY}`;
  let n = text.length;
  for (let i = 0; i < lines.length && n > 0; i++) {
    const ln = lines[i].slice(0, n);
    ctx.fillText(ln, br[0] + 12, by + 10 + i * size * 1.25);
    n -= lines[i].length + 1;
  }
  ctx.restore();
  // tap the bubble to finish the line
  btn([br[0], by, br[2], bh], '', () => { if (!sp.done) { sp.shown = sp.text.length; sp.done = true; } else if (S.phase === 'work' && S.cust.def.items.length === 0) pressTotal(); });
}

function drawBelt() {
  const [x, y, w, h] = L.belt;
  ctx.fillStyle = COL.steel; rr(ctx, x - 2, y - 4, w + 4, h + 8, 4); ctx.fill();
  ctx.fillStyle = COL.belt; ctx.fillRect(x, y + 4, w, h - 8);
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2;
  const off = S.beltPhase % 18;
  for (let gx = x + off - 18; gx < x + w; gx += 18) { if (gx < x) continue; ctx.beginPath(); ctx.moveTo(gx, y + 6); ctx.lineTo(gx, y + h - 6); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.strokeRect(x, y + 4, w, h - 8);
  // end stop
  ctx.fillStyle = COL.steel; rr(ctx, x + w - 7, y + 2, 7, h - 4, 2); fs(ctx, COL.steel, 2);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - 10, w, h + 20); ctx.clip();
  for (const it of S.items) if (it.zone === 'belt') drawOneItem(it);
  ctx.restore();
  // the basket count
  const c = S.cust;
  if (c && c.queue.length && S.phase === 'work') {
    ctx.font = `12px ${FONT_TILL}`; ctx.fillStyle = '#fbf8ef'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`+${c.queue.length} IN THE BASKET`, x + 8, y + 8);
  }
}

function zoneLabel(r, text) {
  ctx.font = `11px ${FONT_TILL}`; ctx.fillStyle = 'rgba(31,27,38,.5)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(text, r[0] + 6, r[1] + 4);
}
function drawHold() {
  const r = L.hold;
  ctx.save(); ctx.setLineDash([6, 5]); rr(ctx, ...r, 8); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(31,27,38,.35)'; ctx.stroke(); ctx.restore();
  zoneLabel(r, 'COUNTER');
  for (const it of S.items) if (it.zone === 'hold') drawOneItem(it);
}
function drawScanner() {
  const r = L.scan, g = L.glass;
  rr(ctx, ...r, 8); fs(ctx, COL.steel, 2.4);
  rr(ctx, ...g, 4); fs(ctx, '#1d2420', 2.2);
  // laser lines
  ctx.save(); rr(ctx, ...g, 4); ctx.clip();
  const flash = S.scanner.flash > 0;
  ctx.strokeStyle = flash ? (S.scanner.flashOk ? 'rgba(120,255,150,.9)' : 'rgba(255,90,70,.95)') : 'rgba(255,60,60,.55)';
  ctx.lineWidth = flash ? 3 : 1.4;
  const cx = g[0] + g[2] / 2, cy = g[1] + g[3] / 2;
  for (let i = 0; i < 3; i++) {
    const a = S.t * 0.6 + i * 1.05;
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 200, cy - Math.sin(a) * 200); ctx.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200); ctx.stroke();
  }
  if (flash && S.scanner.flashOk) { ctx.fillStyle = 'rgba(120,255,150,.18)'; ctx.fillRect(...g); }
  ctx.restore();
  for (const it of S.items) if (it.zone === 'scan') drawOneItem(it);
  // scale readout
  const onScale = S.items.find((i) => i.zone === 'scan');
  const kg = onScale ? (onScale.kg || onScale.def.wt * 0.25 + 0.1) : 0;
  const rd = [r[0] + 10, r[1] + r[3] - 32, r[2] - 20, 24];
  rr(ctx, ...rd, 3); fs(ctx, COL.vfdBg, 2);
  ctx.font = `15px ${FONT_TILL}`; ctx.fillStyle = COL.vfd; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(kg.toFixed(3) + ' kg', rd[0] + rd[2] - 8, rd[1] + 13);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(143,240,164,.55)'; ctx.font = `11px ${FONT_TILL}`;
  ctx.fillText('SCAN · WEIGH', rd[0] + 8, rd[1] + 13);
}

function drawBag() {
  const r = L.bag, [gx, gy] = L.bagGrid, c = L.c;
  const bw = 4 * c, bh = 5 * c;
  // handles and the back of the bag
  ctx.lineWidth = 5; ctx.strokeStyle = shade(COL.green, -0.2);
  ctx.beginPath(); ctx.moveTo(gx + bw * 0.22, gy + 4); ctx.bezierCurveTo(gx + bw * 0.22, gy - 34, gx + bw * 0.78, gy - 34, gx + bw * 0.78, gy + 4); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx - 6, gy - 4); ctx.lineTo(gx + bw + 6, gy - 4); ctx.lineTo(gx + bw + 2, gy + bh + 4); ctx.lineTo(gx - 2, gy + bh + 4); ctx.closePath();
  fs(ctx, '#bfe0cf', 2.4);
  ctx.fillStyle = 'rgba(36,97,74,.18)';
  ctx.font = `${c * 0.6}px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText("BELLAMY'S", gx + bw / 2, gy + bh * 0.55);
  // grid guides
  ctx.strokeStyle = 'rgba(36,97,74,.15)'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(gx + i * c, gy); ctx.lineTo(gx + i * c, gy + bh); ctx.stroke(); }
  for (let j = 1; j < 5; j++) { ctx.beginPath(); ctx.moveTo(gx, gy + j * c); ctx.lineTo(gx + bw, gy + j * c); ctx.stroke(); }
  for (const it of bagItems()) drawOneItem(it);
  // the front rim
  ctx.lineWidth = 2.4; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(gx - 6, gy - 4); ctx.lineTo(gx + bw + 6, gy - 4); ctx.stroke();
  // hand over button
  const has = bagItems().length > 0;
  const hb = L.portrait ? [r[0] + 4, r[1] + 2, r[2] - 8, 36] : [r[0] + 6, r[1] + 4, r[2] - 12, 42];
  const can = has && S.phase === 'work';
  btn(hb, '', () => { handOver(); }, { disabled: !can, disabledFn: () => { if (S.phase === 'work') toast('The bag is empty.', 1.5); } });
  drawTicket(hb, 'HAND OVER BAG', { disabled: !can, size: L.portrait ? 13 : 15, fill: '#fbf8ef', sub: S.bags ? `${S.bags} given` : null, subSize: 9 });
}
function drawBagGhost(it) {
  if (!S.mouse) return;
  const r = itemRect(it);
  const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
  if (!(inRect(L.bag, cx, cy) || inRect(L.bag, S.mouse[0], S.mouse[1]))) return;
  const col = Math.round((r[0] - L.bagGrid[0]) / L.c);
  const land = bagLanding(it, col);
  const ok = land.fits && it.scanned;
  const gx = L.bagGrid[0] + land.col * L.c, gy = L.bagGrid[1] + (5 - land.row - it.def.h) * L.c;
  ctx.save(); ctx.setLineDash([5, 4]);
  rr(ctx, gx + 2, Math.max(L.bagGrid[1] - 30, gy + 2), iw(it) - 4, ih(it) - 4, 4);
  ctx.fillStyle = ok ? 'rgba(59,191,106,.18)' : 'rgba(210,58,47,.18)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ok ? '#2f8f5a' : COL.red; ctx.stroke();
  ctx.restore();
  // warn if this will squash something
  if (ok) {
    const below = bagItems().filter((b) => b.row + b.def.h === land.row && b.col < land.col + it.def.w && b.col + b.def.w > land.col && b.def.tol !== undefined && it.def.wt > b.def.tol);
    if (below.length) { ctx.font = `18px ${FONT_HEAD}`; ctx.fillStyle = COL.red; ctx.textAlign = 'center'; ctx.fillText('!', gx + iw(it) / 2, gy - 8); }
  }
}

function drawOneItem(it, alpha = 1, lifted = false) {
  const r = itemRect(it);
  if (!r) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  let [x, y, w, h] = r;
  if (it.flipT > 0) { const k = Math.abs(Math.cos((it.flipT / 0.18) * Math.PI / 2 * 2)); ctx.translate(x + w / 2, 0); ctx.scale(Math.max(0.1, 1 - Math.sin(it.flipT / 0.18 * Math.PI)), 1); ctx.translate(-x - w / 2, 0); }
  if (it.wobble > 0) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(Math.sin(it.wobble * 40) * 0.08); ctx.translate(-x - w / 2, -y - h / 2); }
  const dim = S.tut && it.cust === S.cust && !tutAllows(it) && it.zone !== 'bag';
  if (dim) ctx.globalAlpha *= 0.55;
  drawItem(ctx, it.def, x, y, w, h, it.face, { crushed: it.crushed, scanned: it.scanned && it.zone !== 'leaving', shadow: lifted, seed: it.seed });
  ctx.restore();
}

function drawTill() {
  const r = L.till;
  rr(ctx, ...r, 8); fs(ctx, COL.beige, 2.4);
  const p = L.portrait;
  const disp = p ? [r[0] + 10, r[1] + 10, r[2] - 20, 172] : [r[0] + 12, r[1] + 12, r[2] * 0.58, r[3] - 24];
  rr(ctx, ...disp, 4); fs(ctx, COL.vfdBg, 2.2);
  ctx.save(); rr(ctx, ...disp, 4); ctx.clip();
  ctx.font = `${p ? 12 : 14}px ${FONT_TILL}`; ctx.textBaseline = 'top';
  const lh = p ? 16 : 18;
  const rows = Math.floor((disp[3] - 46) / lh);
  const lines = S.till.lines.slice(-rows);
  lines.forEach((ln, i) => {
    ctx.fillStyle = ln.price < 0 ? COL.ticket : COL.vfd;
    ctx.textAlign = 'left';
    let name = ln.name;
    const maxW = disp[2] - 70;
    while (ctx.measureText(name).width > maxW && name.length > 3) name = name.slice(0, -1);
    ctx.fillText(name, disp[0] + 7, disp[1] + 6 + i * lh);
    ctx.textAlign = 'right';
    ctx.fillText((ln.price / 100).toFixed(2), disp[0] + disp[2] - 7, disp[1] + 6 + i * lh);
  });
  ctx.fillStyle = 'rgba(143,240,164,.3)'; ctx.fillRect(disp[0] + 6, disp[1] + disp[3] - 36, disp[2] - 12, 1);
  ctx.font = `${p ? 18 : 22}px ${FONT_TILL}`; ctx.fillStyle = COL.vfd; ctx.textAlign = 'left';
  ctx.fillText('TOTAL', disp[0] + 7, disp[1] + disp[3] - 28);
  ctx.textAlign = 'right'; ctx.fillText(money(S.till.total), disp[0] + disp[2] - 7, disp[1] + disp[3] - 28);
  ctx.restore();
  // keys
  const ready = readyForTotal();
  const noItems = S.cust && S.cust.def.items.length === 0;
  const kr = p ? [r[0] + 10, r[1] + 192, r[2] - 20, 92] : [r[0] + r[2] * 0.58 + 24, r[1] + 12, r[2] * 0.42 - 36, r[3] - 24];
  btn(kr, '', pressTotal, { disabled: !ready, disabledFn: pressTotal });
  const pulse = ready ? Math.sin(S.t * 6) * 0.5 + 0.5 : 0;
  ctx.save();
  if (ready) { ctx.shadowColor = `rgba(246,211,74,${0.5 + pulse * 0.5})`; ctx.shadowBlur = 16; }
  drawTicket(kr, noItems ? 'SAY BYE' : 'TOTAL', { disabled: !ready, fill: COL.red, ink: '#fbf8ef', size: p ? 24 : 30, sub: noItems ? null : ready ? 'press to take payment' : 'scan & bag it all first', subSize: 10 });
  ctx.restore();
  S.totalRect = kr;
}

function drawLookup() {
  const r = L.till;
  rr(ctx, ...r, 8); fs(ctx, COL.beige, 2.4);
  const it = S.scanner.lookup;
  const p = L.portrait;
  ctx.font = `${p ? 13 : 15}px ${FONT_TILL}`; ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(p ? `${it.kg.toFixed(3)}kg · WHAT IS IT?` : `LOOSE ITEM ${it.kg.toFixed(3)}kg · WHAT IS IT?`, r[0] + 12, r[1] + 18);
  const cols = p ? 2 : 4, rows = p ? 4 : 2;
  const gx = r[0] + 10, gy = r[1] + 34, gw = r[2] - 20, gh = r[3] - 44;
  const cw = gw / cols, ch = gh / rows;
  LOOKUP.forEach((id, i) => {
    const bx = gx + (i % cols) * cw + 3, by = gy + Math.floor(i / cols) * ch + 3;
    const br = [bx, by, cw - 6, ch - 6];
    btn(br, '', () => pickLookup(id));
    rr(ctx, ...br, 6); fs(ctx, '#fbf8ef', 2);
    const def = ITEMS[id];
    const isz = Math.min(br[3] - 22, 44);
    const iwid = def.w === 2 ? isz * 1.5 : isz;
    drawProduce(ctx, def, bx + (br[2] - iwid) / 2, by + 3, iwid, isz, true);
    ctx.font = `${p ? 10 : 11}px ${FONT_TILL}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${i + 1} ${def.name}`, bx + br[2] / 2, by + br[3] - 5);
  });
  S.lookupRect = [gx, gy, gw, gh];
}

function drawDrawer() {
  const r = L.drawer, pay = S.pay, p = L.portrait;
  rr(ctx, ...r, 8); fs(ctx, '#3a3a40', 2.4);
  // header
  const hdr = [r[0] + 10, r[1] + 8, r[2] - 20, 42];
  rr(ctx, ...hdr, 4); fs(ctx, COL.vfdBg, 2);
  ctx.font = `${p ? 13 : 14}px ${FONT_TILL}`; ctx.textBaseline = 'middle';
  const parts = pay.exact ? [['PAID EXACT', money(pay.given)]] : [['TOTAL', money(pay.total)], ['GIVEN', money(pay.given)], ['CHANGE', money(pay.due)]];
  parts.forEach(([k, v], i) => {
    const cx = hdr[0] + hdr[2] * (i + 0.5) / parts.length;
    ctx.textAlign = 'center';
    ctx.fillStyle = i === 2 ? COL.ticket : 'rgba(143,240,164,.7)'; ctx.fillText(k, cx, hdr[1] + 12);
    ctx.fillStyle = i === 2 ? COL.ticket : COL.vfd; ctx.font = `${p ? 16 : 18}px ${FONT_TILL}`; ctx.fillText(v, cx, hdr[1] + 30);
    ctx.font = `${p ? 13 : 14}px ${FONT_TILL}`;
  });
  if (pay.exact) {
    ctx.font = `${p ? 16 : 18}px ${FONT_BODY}`; ctx.fillStyle = '#fbf8ef'; ctx.textAlign = 'center';
    ctx.fillText('Exact money. Into the drawer it goes.', r[0] + r[2] / 2, r[1] + r[3] / 2 + 10);
    return;
  }
  // compartments
  const gy = hdr[1] + hdr[3] + 8;
  const gh = p ? 138 : 112;
  const cw = (r[2] - 20) / 4, ch = gh / 2;
  DENOMS.forEach((v, i) => {
    const bx = r[0] + 10 + (i % 4) * cw + 2, by = gy + Math.floor(i / 4) * ch + 2;
    const br = [bx, by, cw - 4, ch - 4];
    btn(br, '', () => addCoin(v));
    rr(ctx, ...br, 4); fs(ctx, '#55555e', 2);
    drawMoney(v, bx + br[2] / 2, by + br[3] / 2 - 2, Math.min(br[2], br[3]));
  });
  // the change tray
  const ty = gy + gh + 8;
  const trayR = [r[0] + 10, ty, (r[2] - 20) * 0.62, r[1] + r[3] - ty - 10];
  rr(ctx, ...trayR, 6); fs(ctx, '#f0ead6', 2);
  const sum = pay.tray.reduce((a, b) => a + b, 0);
  ctx.font = `11px ${FONT_TILL}`; ctx.fillStyle = 'rgba(31,27,38,.6)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('YOUR HAND · tap to put back', trayR[0] + 6, trayR[1] + 4);
  const step = Math.min(26, (trayR[2] - 24) / Math.max(1, pay.tray.length));
  pay.tray.forEach((v, i) => {
    const cx = trayR[0] + 18 + i * step, cy = trayR[1] + trayR[3] / 2 + 6;
    btn([cx - step / 2, trayR[1] + 14, step, trayR[3] - 14], '', () => removeCoin(i));
    drawMoney(v, cx, cy, Math.min(40, trayR[3] - 18), true);
  });
  const gb = [trayR[0] + trayR[2] + 8, ty, r[0] + r[2] - 10 - (trayR[0] + trayR[2] + 8), trayR[3]];
  btn(gb, '', giveChange);
  const right = sum === pay.due;
  drawTicket(gb, 'GIVE', { fill: right ? '#7fd69a' : COL.ticket, size: p ? 20 : 24, sub: money(sum), subSize: 13 });
  S.coinRect = [r[0] + 10, gy, r[2] - 20, gh];
}
function drawMoney(v, cx, cy, size, small) {
  if (v >= 500) {
    const w = size * (small ? 0.9 : 0.86), h = size * (small ? 0.5 : 0.48);
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 3);
    fs(ctx, v === 1000 ? '#e0905a' : '#7ec4cf', 1.8);
    ctx.strokeStyle = 'rgba(31,27,38,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx - w * 0.22, cy, h * 0.28, h * 0.34, 0, 0, 7); ctx.stroke();
    label(ctx, '£' + v / 100, cx + w * 0.14, cy, w * 0.5, small ? 10 : 14, INK);
    return;
  }
  const radius = { 200: 0.3, 100: 0.27, 50: 0.29, 20: 0.23, 10: 0.26, 5: 0.19 }[v] * size * (small ? 1 : 0.95);
  const gold = v === 100 || v === 200;
  if (v === 50 || v === 20) { // heptagons
    ctx.beginPath();
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i / 7 * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); }
    ctx.closePath();
  } else circ(ctx, cx, cy, radius);
  fs(ctx, gold ? '#e6c25a' : '#cfd3d6', 1.8);
  if (v === 200) { circ(ctx, cx, cy, radius * 0.66); fs(ctx, '#cfd3d6', 1.2); }
  label(ctx, v >= 100 ? '£' + v / 100 : v + 'p', cx, cy, radius * 1.5, Math.max(7, radius * 0.75), INK);
}

function drawCard() {
  const r = L.till, pay = S.pay;
  const tw = L.portrait ? 110 : 130, th = L.portrait ? 160 : 190;
  const tx = r[0] + r[2] / 2 - tw / 2 + (L.portrait ? 0 : 60), ty = r[1] + (r[3] - th) / 2;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(ctx, tx + 4, ty + 6, tw, th, 14); ctx.fill();
  rr(ctx, tx, ty, tw, th, 14); fs(ctx, '#2b2f3a', 2.4);
  const sc = [tx + 10, ty + 12, tw - 20, th * 0.45];
  rr(ctx, ...sc, 4); fs(ctx, pay.state === 'ok' ? '#7fd69a' : '#cfe8f0', 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.font = `13px ${FONT_TILL}`;
  ctx.fillText(pay.state === 'ok' ? 'APPROVED' : 'TAP CARD', sc[0] + sc[2] / 2, sc[1] + sc[3] * 0.35);
  ctx.fillText(money(S.till.total), sc[0] + sc[2] / 2, sc[1] + sc[3] * 0.7);
  for (let i = 0; i < 9; i++) { rr(ctx, tx + 14 + (i % 3) * ((tw - 28) / 3), ty + th * 0.55 + 6 + Math.floor(i / 3) * 20, (tw - 28) / 3 - 4, 15, 3); fs(ctx, '#4a4f5c', 1.2); }
  if (pay.state === 'tap') {
    // a card coming in to tap
    const k = Math.min(1, S.phaseT / 0.8);
    const cx = tx + tw / 2 + (1 - k) * 80, cy = ty + 30 - Math.sin(k * Math.PI) * 10;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.25 + k * 0.2);
    rr(ctx, -30, -19, 60, 38, 4); fs(ctx, '#3a6fb0', 2);
    ctx.fillStyle = '#e6c25a'; ctx.fillRect(-20, -6, 12, 9);
    ctx.restore();
  }
}

function drawChoice() {
  const r = L.belt;
  ctx.fillStyle = 'rgba(31,27,38,.55)'; ctx.fillRect(r[0], r[1], r[2], r[3]);
  const opts = S.choice.options;
  const pad = 10, gap = 10;
  const bw = (r[2] - pad * 2 - gap) / 2, bh = r[3] - 20;
  opts.forEach((o, i) => {
    const br = [r[0] + pad + i * (bw + gap), r[1] + 10, bw, bh];
    btn(br, '', () => chooseOption(i));
    drawTicket(br, o.label, { fill: i === 0 ? COL.ticket : '#fbf8ef', flag: i === 0, size: L.portrait ? 15 : 19, sub: L.portrait ? null : `press ${i + 1}`, subSize: 10 });
  });
}

function drawDaysCard(r) {
  const day = DAYS[Math.min(6, S.day)];
  const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.06 + Math.sin(S.t * 0.8) * 0.01);
  starburst(ctx, 0, 0, 50, 16, COL.ticket);
  ctx.fillStyle = COL.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (day.left === 1) { label(ctx, 'LAST', 0, -9, 70, 22, COL.red); label(ctx, 'DAY!', 0, 14, 70, 22, COL.red); }
  else { label(ctx, String(day.left), 0, -8, 70, 38, COL.red); label(ctx, 'DAYS LEFT', 0, 22, 70, 11, INK); }
  ctx.restore();
}

function drawToasts() {
  S.toasts.forEach((t, i) => {
    const a = Math.min(1, t.t * 6, (t.life - t.t) * 3);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `${L.portrait ? 13 : 15}px ${FONT_BODY}`;
    const maxW = L.portrait ? 360 : 440;
    const lines = wrap(ctx, t.text, maxW - 24);
    const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
    const h = lines.length * (L.portrait ? 17 : 19) + 14;
    const zone = L.portrait ? [0, L.hold[1] + 22, 400] : [L.hold[0], L.hold[1] + 26, L.scan[0] + L.scan[2] - L.hold[0]];
    const x = zone[0] + (zone[2] - w) / 2, y = zone[1] + i * (h + 6);
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.01); ctx.translate(-x - w / 2, -y - h / 2);
    rr(ctx, x, y, w, h, 4); fs(ctx, '#fbf8ef', 2.2);
    ctx.fillStyle = COL.red; ctx.fillRect(x + 1, y + 1, 6, h - 2);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lines.forEach((ln, j) => ctx.fillText(ln, x + w / 2 + 3, y + 7 + j * (L.portrait ? 17 : 19)));
    ctx.restore();
  });
}

function anchorPoint(name) {
  if (!name) return null;
  if (name === 'glass') return [L.glass[0] + L.glass[2] / 2, L.glass[1] + L.glass[3] / 2];
  if (name === 'bag') return [L.bagGrid[0] + 2 * L.c, L.bagGrid[1] + 4 * L.c];
  if (name === 'hold') return [L.hold[0] + L.hold[2] / 2, L.hold[1] + L.hold[3] / 2 + 10];
  if (name === 'total') return S.totalRect ? [S.totalRect[0] + S.totalRect[2] / 2, S.totalRect[1] + S.totalRect[3] / 2] : null;
  if (name === 'lookup') return S.lookupRect ? [S.lookupRect[0] + S.lookupRect[2] / (L.portrait ? 4 : 8), S.lookupRect[1] + S.lookupRect[3] / (L.portrait ? 8 : 4)] : null;
  if (name === 'coins') return S.coinRect ? [S.coinRect[0] + S.coinRect[2] / 2, S.coinRect[1] + S.coinRect[3] / 2] : null;
  if (name === 'scale') return [L.glass[0] + L.glass[2] / 2, L.glass[1] + L.glass[3] / 2];
  const it = S.items.find((i) => i.id === name && i.cust === S.cust && i.zone !== 'drag');
  if (!it) return null;
  const r = itemRect(it);
  return r ? [r[0] + r[2] / 2, r[1] + r[3] / 2] : null;
}
function drawTutorialArrow() {
  const st = tutStep();
  if (!st || !st.arrow || S.drag || (S.speech && !S.speech.done)) return;
  let [a, b] = st.arrow;
  // if the item's already where it needs to be for this half of the step, point onwards
  if (a && a !== 'scale') {
    const it = S.items.find((i) => i.id === a && i.cust === S.cust);
    if (!it || it.zone === 'queue') return;
    if (b === 'glass' && it.scanned) b = 'bag';
  }
  const pa = anchorPoint(a), pb = anchorPoint(b);
  if (!pb) return;
  const bob = Math.sin(S.t * 5) * 5;
  if (!pa) {
    // just bounce a pointer over the target
    drawPointer(pb[0], pb[1] - 26 + bob, Math.PI / 2);
    return;
  }
  const dx = pb[0] - pa[0], dy = pb[1] - pa[1];
  const d = Math.hypot(dx, dy);
  if (d < 10) return;
  const ux = dx / d, uy = dy / d;
  const s = [pa[0] + ux * 22, pa[1] + uy * 22], e = [pb[0] - ux * (16 - bob), pb[1] - uy * (16 - bob)];
  ctx.save();
  ctx.setLineDash([10, 8]); ctx.lineDashOffset = -S.t * 30;
  ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(...s); ctx.lineTo(...e); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = COL.ticket;
  ctx.beginPath(); ctx.moveTo(...s); ctx.lineTo(...e); ctx.stroke();
  ctx.restore();
  drawPointer(e[0], e[1], Math.atan2(uy, ux));
  // ring the thing to pick up
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = COL.red; ctx.setLineDash([4, 4]); ctx.lineDashOffset = S.t * 20;
  circ(ctx, pa[0], pa[1], 30 + Math.sin(S.t * 5) * 3); ctx.stroke(); ctx.restore();
}
function drawPointer(x, y, ang) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, -12); ctx.lineTo(-6, 0); ctx.lineTo(-10, 12); ctx.closePath();
  fs(ctx, COL.ticket, 2.6);
  ctx.restore();
}

// ------------------------------------------------------------------ DOM cards
function show(id) { for (const el of document.querySelectorAll('.veil')) el.hidden = el.id !== id; }
function hideAll() { for (const el of document.querySelectorAll('.veil')) el.hidden = true; }

function showTitle() {
  S.mode = 'title';
  const sv = load();
  const cont = $('continue');
  if (sv && sv.day > 0 && sv.day <= 6) { cont.hidden = false; cont.querySelector('small').textContent = DAYS[sv.day].name; }
  else cont.hidden = true;
  show('title');
}
function showDayCard(d) {
  S.mode = 'card';
  const day = DAYS[d];
  $('dayname').textContent = day.name;
  $('dayleft').textContent = day.left === 1 ? 'LAST DAY' : `${day.left} DAYS LEFT`;
  $('dayintro').textContent = day.intro;
  show('daycard');
  S.pendingDay = d;
}
function showShiftReceipt() {
  const st = S.stats;
  const per = st.items ? (st.time / st.items).toFixed(1) : '0.0';
  const prev = DAYS[S.day];
  $('rc-day').textContent = prev.name.toUpperCase();
  $('rc-lines').innerHTML = [
    ['CUSTOMERS', st.customers], ['ITEMS SCANNED', st.items], ['SECONDS PER ITEM', per],
    ['SQUASHED', st.crushed], ['WRONG CHANGE', st.wrongChange], ['WRONG LOOKUP', st.wrongLookup],
  ].map(([k, v]) => `<div class="ln"><span>${k}</span><span>${v}</span></div>`).join('');
  $('rc-dale').textContent = verdict(st, S.day);
  $('rc-next').textContent = `${DAYS[S.day + 1].name} →`;
  sfx.print();
  show('receipt');
}
function startEnding() {
  S.mode = 'ending'; S.ending = 0.001;
  setBelt(false);
  const f = S.flags;
  const kept = [];
  kept.push(['A TIN OF PEACHES', 'from Iris, for you']);
  if (f.got_milo) kept.push(['40p', 'from Milo, on his life']);
  if (f.got_wedding) kept.push(['WEDDING CAKE', 'attempt no. 4']);
  if (f.got_jas) kept.push(['A NOD', 'from Jas']);
  if (f.coupon) kept.push(['A COUPON', "Mrs Daley's, 2019"]);
  kept.push(['A CHOC ICE', 'on Dale']);
  $('end-lines').innerHTML = [
    ['CUSTOMERS', S.week.customers], ['ITEMS', S.week.items], ['OUT OF YOUR OWN POCKET', money(S.week.covered)],
  ].map(([k, v]) => `<div class="ln"><span>${k}</span><span>${v}</span></div>`).join('') +
    '<div class="rule"></div><div class="ln head"><span>YOU TAKE HOME</span><span></span></div>' +
    kept.map(([k, v]) => `<div class="ln"><span>${k}</span><span class="small">${v}</span></div>`).join('');
  try { localStorage.removeItem('lastcheckout.v1'); } catch (e) {}
}

function pause() {
  if (S.mode !== 'shift') return;
  if (S.drag) { returnItem(S.drag.item, S.drag.from); S.drag = null; }
  S.mode = 'paused'; setBelt(false); show('pause'); }
function resume() { hideAll(); S.mode = 'shift'; }
function toggleMute() { setMuted(!isMuted()); const b = $('mutebtn'); if (b) b.textContent = isMuted() ? 'Sound: off' : 'Sound: on'; }

$('newweek').onclick = () => { unlock(); S.flags = {}; S.week = { items: 0, customers: 0, covered: 0 }; S.skipTutorial = false; showDayCard(0); };
$('skiptut').onclick = () => { unlock(); S.flags = {}; S.week = { items: 0, customers: 0, covered: 0 }; S.skipTutorial = true; S.hints = {}; showDayCard(0); };
$('continue').onclick = () => { unlock(); const sv = load(); S.flags = sv.flags || {}; S.week = sv.week || { items: 0, customers: 0, covered: 0 }; S.skipTutorial = true; showDayCard(sv.day); };
$('howto-open').onclick = () => show('howto');
$('howto-close').onclick = () => { if (S.mode === 'paused') show('pause'); else showTitle(); };
$('opentill').onclick = () => { unlock(); hideAll(); startDay(S.pendingDay); };
$('rc-next').onclick = () => showDayCard(S.day + 1);
$('resume').onclick = resume;
$('p-howto').onclick = () => show('howto');
$('restartday').onclick = () => { hideAll(); S.skipTutorial = S.skipTutorial || S.day > 0; startDay(S.day, true); };
$('quit').onclick = () => { showTitle(); };
$('mutebtn').onclick = toggleMute;
$('mutebtn').textContent = isMuted() ? 'Sound: off' : 'Sound: on';
$('again').onclick = () => { S.ending = 0; S.day = 0; showTitle(); };

// ------------------------------------------------------------------ autoplay (for testing: ?auto, ?auto&fast=4)
let botT = 0;
function bot(dt) {
  botT -= dt;
  if (botT > 0) return;
  botT = 0.18;
  if (S.mode === 'card' || S.mode === 'title') {
    if (!AUTO) return;
    const vis = [...document.querySelectorAll('.veil')].find((v) => !v.hidden);
    if (!vis) return;
    if (vis.id === 'title') $('skiptut').click();
    else if (vis.id === 'daycard') $('opentill').click();
    else if (vis.id === 'receipt') $('rc-next').click();
    return;
  }
  if (S.mode !== 'shift' || !S.cust) return;
  if (S.phase === 'choice') { chooseOption(Math.random() < 0.7 ? 0 : 1); return; }
  if (S.phase === 'cash' && S.pay && !S.pay.exact) {
    let due = S.pay.due - S.pay.tray.reduce((a, b) => a + b, 0);
    if (due === 0) { giveChange(); return; }
    const d = DENOMS.find((v) => v <= due);
    addCoin(d); return;
  }
  if (S.phase !== 'work') return;
  if (S.scanner.lookup) { pickLookup(S.scanner.lookup.id); return; }
  if (S.tut) { botTutorial(); return; }
  if (readyForTotal()) { pressTotal(); return; }
  const mine = custItems();
  const onScan = mine.find((i) => i.zone === 'scan');
  const belt = beltItems();
  const hold = mine.filter((i) => i.zone === 'hold');
  const sturdy = (i) => i.def.tol === undefined;
  if (onScan) {
    if (!onScan.scanned) { flipItem(onScan); return; }
    if (sturdy(onScan) && bestCol(onScan) !== null) { tryBag(onScan, bestCol(onScan)); return; }
    if (sturdy(onScan) && !canFitAnywhere(onScan)) { handOver(); return; }
    putHold(onScan, 4 + hold.length * 18 % 120, 20 + (hold.length * 37) % 60); return;
  }
  if (belt.length) {
    const it = belt[0];
    if (!it.def.produce && it.face === 0) { flipItem(it); return; }
    putScanner(it); return;
  }
  if (S.cust.queue.length) return;
  if (hold.length) {
    hold.sort((a, b) => (a.def.tol ?? 99) - (b.def.tol ?? 99)).reverse();
    const it = hold[0];
    const col = bestCol(it);
    if (col === null) { handOver(); return; }
    tryBag(it, col); return;
  }
}
function bestCol(it) {
  let best = null, bestRow = 99;
  for (let c = 0; c <= 4 - it.def.w; c++) {
    const l = bagLanding(it, c);
    if (!l.fits) continue;
    const below = bagItems().filter((b) => b.row + b.def.h === l.row && b.col < l.col + it.def.w && b.col + b.def.w > l.col);
    if (below.some((b) => b.def.tol !== undefined && it.def.wt > 0)) continue;
    if (l.row < bestRow) { bestRow = l.row; best = c; }
  }
  return best;
}
function botTutorial() {
  const st = tutStep();
  if (!st || !st.allow) return;
  if (S.speech && !S.speech.done) return;
  if (!st.allow.length) { if (st.done && st.done('total', {})) pressTotal(); return; }
  const it = S.items.find((i) => st.allow.includes(i.id) && i.cust === S.cust);
  if (!it) return;
  if (!it.scanned) {
    if (it.zone === 'scan') { flipItem(it); return; }
    if (!it.def.produce && it.face === 0) { flipItem(it); return; }
    putScanner(it); return;
  }
  if (st.blockBag) { if (it.zone !== 'hold') putHold(it, 20, 30); return; }
  if (it.zone !== 'bag') tryBag(it, bestCol(it) ?? 0);
}

// ------------------------------------------------------------------ demo scene for the preview screenshot
function setupDemo() {
  S.flags = {}; S.skipTutorial = true;
  startDay(2);
  // Mr Pruitt and his candles, partway through
  S.ci = 1;
  const def = S.customers.find((c) => c.who === 'pruitt');
  S.ci = S.customers.indexOf(def);
  const c = { def, person: PEOPLE[def.who], queue: [], mood: 0.1, x: 0, startT: 0, saidMid: true, blink: false };
  S.cust = c; S.items = [];
  const add = (id, zone, o = {}) => { const it = makeItem(id, c); Object.assign(it, { zone }, o); S.items.push(it); return it; };
  add('candles', 'bag', { col: 0, row: 0, scanned: true, face: 0 });
  add('candles', 'bag', { col: 1, row: 0, scanned: true, face: 0 });
  add('candles', 'bag', { col: 0, row: 1, scanned: true, face: 0 });
  add('candles', 'scan', { scanned: true, face: 1 });
  add('matches', 'hold', { x: 30, y: 40, scanned: true, face: 0 });
  const bl = L.belt[2] - 8;
  ['candles', 'candles', 'candles', 'matches', 'candles'].forEach((id, i) => add(id, 'belt', { x: bl - (i + 1) * (L.c + 6), face: i % 2 }));
  for (const it of S.items.filter((i) => i.scanned)) { S.till.lines.push({ name: it.def.name, price: it.price }); S.till.total += it.price; }
  S.phase = 'work'; S.phaseT = 5;
  say(def.mid); S.speech.shown = 999; S.speech.done = true;
  S.scanner.flash = 99; S.scanner.flashOk = true;
  hideAll();
}

// ------------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (let i = 0; i < FAST; i++) {
    if (S.mode === 'shift' || (S.mode === 'card' && S.cust)) update(dt);
    if (AUTO || S.auto) bot(dt);
  }
  if (S.mode === 'ending') {
    S.t += dt;
    S.ending = Math.min(1.2, S.ending + dt * 0.25);
    if (S.ending >= 1.2 && $('ending').hidden) { sfx.ding(); show('ending'); }
  }
  if (DEMO && S.scanner.flash > 0) S.scanner.flash = 0.2 + (Math.sin(now / 300) > 0 ? 0.2 : 0);
  render();
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
resize();
document.fonts?.ready?.then(() => { laminate = null; });
if (DEMO) setupDemo(); else showTitle();
requestAnimationFrame(frame);
window.toyboxReady?.();
window.__S = S;
// for the test harness: screen positions of things
window.__lc = {
  S, L: () => L,
  toScreen: (bx, by) => [OX + bx * U, OY + by * U],
  item: (id) => { const it = S.items.find((i) => i.id === id && i.cust === S.cust && !['gone', 'leaving'].includes(i.zone)); if (!it) return null; const r = itemRect(it); return { x: OX + (r[0] + r[2] / 2) * U, y: OY + (r[1] + r[3] / 2) * U, zone: it.zone, face: it.face, scanned: it.scanned, crushed: it.crushed }; },
  live: () => S.items.filter((i) => i.cust === S.cust && ['belt', 'hold', 'scan'].includes(i.zone)).map((it) => { const r = itemRect(it); return { id: it.id, x: OX + (r[0] + r[2] / 2) * U, y: OY + (r[1] + r[3] / 2) * U, zone: it.zone }; }),
  zone: (n) => { const r = n === 'glass' ? L.glass : n === 'bagGrid' ? [L.bagGrid[0], L.bagGrid[1], 4 * L.c, 5 * L.c] : L[n]; return { x: OX + (r[0] + r[2] / 2) * U, y: OY + (r[1] + r[3] / 2) * U, r: r.map((v) => v * U), ox: OX + r[0] * U, oy: OY + r[1] * U }; },
  buttons: () => S.buttons.map((b) => ({ x: OX + (b.r[0] + b.r[2] / 2) * U, y: OY + (b.r[1] + b.r[3] / 2) * U, text: b.text, disabled: !!b.disabled })),
  ff: (sec) => { for (let i = 0; i < sec * 20; i++) update(0.05); },
};
