// A fight on screen. The engine (engine.js) awaits ev(type, data) for every change and this makes it visible: cards
// fly from the shared deck to the demons (turning upside down as they land) and into your hand, figures lunge and
// flinch, numbers float up. It also is the engine's io: your turn ends when you press End Turn, and choices (which
// card to Offer, what to keep after Foresee) are asked for here.
import * as THREE from 'three';
import { def, cardCost, uprightText, reversedText, CARDS } from './cards.js';
import { Figure } from './stage.js';
import { RATIO } from './cards3d.js';
import { Plate, banner, floater, img, $, el, richHTML, keywordsIn, tipHTML, STATUS, POWER_ICON } from './hud.js';
import { TRAITS } from './enemies.js';
import { CHARMS } from './charms.js';
import { POWER_TEXT } from './cards.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

export class BattleView {
  constructor(app, battle, o = {}) {
    this.app = app; this.b = battle;
    this.stage = app.stage; this.layer = app.cards; this.fx = app.fx; this.sfx = app.sound;
    this.views = new Map();     // card uid → CardView
    this.figs = new Map();      // creature → Figure
    this.plates = new Map();    // creature → Plate
    this.intents = new Map();   // demon → element
    this.auto = o.auto ?? null; // a bot to play for you (the demo)
    this.inputOn = false;
    this.sel = null; this.drag = null; this.hover = null; this.aim = null;
    this.choosing = null;
    this.pending = [];
    this.dead = false;
    this.root = $('#battleHud');
    this.root.hidden = false;
    this.plateLayer = $('#plates'); this.intentLayer = $('#intents'); this.floatLayer = $('#floaters');
    this.plateLayer.innerHTML = ''; this.intentLayer.innerHTML = '';
    this.endBtn = $('#endTurn'); this.graceEl = $('#grace'); this.promptEl = $('#prompt');
    this.deckBadge = $('#deckCount'); this.discBadge = $('#discCount'); this.banBadge = $('#banCount'); this.seenLayer = $('#seenLabels');
    this.endBtn.onclick = () => this.endTurn();
    this.arrow = $('#arrow'); this.reticle = $('#reticle');
    this.tip = $('#tip');
    this.tmp = new THREE.Vector3();
  }
  get spd() { return this.app.speed; }
  wait(ms) { return new Promise(r => setTimeout(r, ms / this.spd)); }

  /* ================= layout ================= */
  metrics() {
    const W = this.layer.w, H = this.layer.h, portrait = W / H < .9;
    const m = { W, H, portrait };
    m.cardW = portrait ? clamp(W * .25, 78, 120) : clamp(H * .165, 92, 158);
    m.cardH = m.cardW * RATIO;
    m.heldW = portrait ? clamp(W * .115, 40, 58) : clamp(H * .09, 56, 92);
    m.pileW = portrait ? clamp(W * .15, 50, 68) : clamp(H * .1, 62, 96);
    m.handY = portrait ? H - m.cardH * .5 - 12 : H - m.cardH * .38;
    m.handTop = portrait ? H - m.cardH * 1.02 : H - m.cardH * .88;
    if (portrait) {
      const py = Math.min(H * .675, m.handTop - m.pileW * RATIO * .5 - 26);
      m.deck = { x: W * .4, y: py }; m.disc = { x: W * .62, y: py };
      m.grace = { x: Math.max(44, W * .13), y: py }; m.end = { x: W - 62, y: py };
      m.play = { x: W * .5, y: H * .42 }; m.playW = m.cardW * 1.55;
    } else {
      // the shared deck sits in the gap between you and the demons
      let gx = W * .39 + m.pileW * .65;
      const af = this.figs.get(this.b.angel), ds = this.b.living().map(d => this.figs.get(d)).filter(Boolean);
      if (af && ds.length) {
        const a = this.stage.project(af.feet(this.tmp)), at = this.stage.project(af.top(new THREE.Vector3()));
        const right = a.x + (a.y - at.y) * .3;
        const left = Math.min(...ds.map(f => { const p = this.stage.project(f.feet(new THREE.Vector3())), t = this.stage.project(f.top(new THREE.Vector3())); return p.x - (p.y - t.y) * .32; }));
        gx = clamp((right + left) / 2, W * .3, W * .6);
        if (left - right < m.pileW * 2.8) gx = clamp(Math.max(gx, right + m.pileW * 1.6), W * .3, W * .62);
      }
      m.deck = { x: gx - m.pileW * .65, y: H * .695 }; m.disc = { x: gx + m.pileW * .65, y: H * .695 };
      m.grace = { x: Math.max(70, W * .075), y: H - m.cardH * .55 }; m.end = { x: W - Math.max(90, W * .08), y: H - m.cardH * .55 };
      m.play = { x: W * .5, y: H * .42 }; m.playW = m.cardW * 1.5;
    }
    return m;
  }
  // where each hand card rests
  handSlots(n, m) {
    const maxSpread = m.portrait ? m.W * .9 : Math.min(m.W * .58, 900);
    const step = n > 1 ? Math.min(m.cardW * .86, (maxSpread - m.cardW) / (n - 1)) : 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * step;
      const x = m.W / 2 + off, y = m.handY + Math.pow(off / (m.W * .5), 2) * m.cardH * .35;
      out.push({ x, y, rz: -off / m.W * .5, z: i * 2 });
    }
    return out;
  }
  heldSlots(d, m) {
    const f = this.figs.get(d); if (!f) return [];
    const top = this.stage.project(f.top(this.tmp));
    const n = d.held.length, out = [];
    const step = m.heldW * (m.portrait ? .7 : .82);
    for (let i = 0; i < n; i++) out.push({ x: top.x + (i - (n - 1) / 2) * step, y: top.y - m.heldW * RATIO * .5 - 18, rz: (i - (n - 1) / 2) * -.05 });
    return out;
  }
  // set every card's resting place for this frame
  layout(dt) {
    const b = this.b, m = this.metrics(), L = this.layer;
    this.m = m;
    // hand
    const slots = this.handSlots(b.hand.length, m);
    let hoverI = this.hover && b.hand.includes(this.hover.card) ? b.hand.indexOf(this.hover.card) : -1;
    if (this.sel && this.sel.mode !== 'aim') hoverI = b.hand.indexOf(this.sel.card);
    b.hand.forEach((c, i) => {
      const v = this.views.get(c.uid); if (!v || v.flight) return;
      if (this.drag?.view === v) return;
      const s = slots[i];
      let x = s.x, y = s.y, rz = s.rz, z = s.z, sc = m.cardW;
      if (hoverI >= 0 && i !== hoverI) x += (i < hoverI ? -1 : 1) * m.cardW * .28 * Math.max(0, 1 - Math.abs(i - hoverI) * .25);
      if (i === hoverI) {
        sc = m.cardW * (m.portrait ? 1.55 : 1.42); rz = 0; z = 80;
        y = m.H - sc * RATIO * .5 - 8;
        x = clamp(x, sc / 2 + 6, m.W - sc / 2 - 6);
      }
      if (this.aim?.view === v) { x = m.W / 2; y = m.H - m.cardH * 1.05; sc = m.cardW * 1.25; rz = 0; z = 90; }
      if (i !== hoverI || this.drag) v.hoverTilt.multiplyScalar(Math.exp(-dt * 10));
      v.target(L.at(x, y, z), V(0, 0, rz), sc);
      const playable = this.inputOn && b.canPlay(c) && !this.choosing;
      const choosable = this.choosing?.kind === 'hand' && this.choosing.cards.includes(c);
      v.glowTarget = choosable ? 1 : playable ? .8 : 0;
      v.glowColor.set(choosable ? '#7fe0ff' : '#ffd36a');
      v.dim = this.inputOn && !playable && !choosable && !def(c).unplayable ? .72 : 1;
    });
    // held cards
    for (const d of b.demons) {
      const hs = this.heldSlots(d, m);
      d.held.forEach((h, i) => {
        const v = this.views.get(h.card.uid); if (!v || v.flight) return;
        const s = hs[i]; if (!s) return;
        const big = this.inspectHeld === v;
        const sc = big ? m.heldW * 2.3 : m.heldW;
        const rz = (h.orient === 'down' ? PI : 0) + (big ? 0 : s.rz);
        v.target(L.at(s.x, big ? s.y + m.heldW * .4 : s.y + Math.sin(this.stage.time * 2 + i + d.uid) * 3, big ? 120 : 30 + i), V(0, h.hidden ? PI : 0, rz), sc);
        const aimed = this.aim && this.aimHeld === h;
        v.glowTarget = aimed ? 1 : .5; v.glowColor.set(aimed ? '#ffffff' : h.orient === 'up' ? '#c8a8ff' : '#ff4a2a');
        v.dim = 1;
      });
    }
    // the discard pile: the last few cards, scattered a little
    const top = b.discard.slice(-4);
    for (const c of b.discard) { const v = this.views.get(c.uid); if (v && !top.includes(c) && !v.flight) { this.layer.remove(v); this.views.delete(c.uid); } }
    top.forEach((c, i) => {
      const v = this.views.get(c.uid); if (!v || v.flight) return;
      const r = Math.sin(c.uid * 12.9) * .2;
      v.target(L.at(m.disc.x + Math.sin(c.uid * 7.1) * 4, m.disc.y + Math.cos(c.uid * 3.3) * 4, i * 2), V(0, 0, r), m.pileW);
      v.glowTarget = 0; v.dim = .92;
    });
    // the deck: a stack of backs, with what you know of its top laid face up on it
    const eye = b.charmRule('eye');
    const known = [];
    for (let i = b.deck.length - 1; i >= 0 && known.length < 6; i--) { const c = b.deck[i]; if (c.seen || (eye && i === b.deck.length - 1)) known.push(c); else break; }
    this.known = known;
    L.deck.set(b.deck.length - known.length, L.at(m.deck.x, m.deck.y, 0), m.pileW);
    for (const c of b.deck) { const v = this.views.get(c.uid); if (v && !known.includes(c) && !v.flight) { this.layer.remove(v); this.views.delete(c.uid); } }
    const foreseeing = this.choosing?.kind === 'foresee' ? this.choosing.cards : null;
    known.forEach((c, i) => {
      let v = this.views.get(c.uid);
      if (!v) { v = this.spawn(c, L.deck.topPos(), true); }
      if (v.flight || foreseeing?.includes(c)) return;
      const n = known.length;
      v.target(L.at(m.deck.x - (n - 1 - i) * m.pileW * .2 + (n - 1) * m.pileW * .1, m.deck.y - (n - 1 - i) * 6 + 4, 40 + (n - i) * 3), V(0, 0, -.04 * (n - 1 - i)), m.pileW);
      v.glowTarget = .35; v.glowColor.set('#9fd6ff'); v.dim = 1;
    });
    // played cards hang in the middle while they resolve
    b.inPlay.forEach(c => {
      const v = this.views.get(c.uid); if (!v || v.flight || this.demonPlaying?.includes(v)) return;
      if (this.choosing) v.target(L.at(m.portrait ? m.W * .16 : m.W * .1, m.portrait ? m.H * .3 : m.H * .32, 150), V(0, 0, -.1), m.cardW * .8);
      else v.target(L.at(m.play.x, m.play.y, 150), V(0, 0, 0), m.playW);
    });
  }
  spawn(card, pos, faceDown, rz = 0) {
    const v = this.layer.add(card);
    this.views.set(card.uid, v);
    v.place(pos, V(0, faceDown ? PI : 0, rz), this.m?.pileW ?? 80);
    this.paintFor(v);
    return v;
  }
  viewOf(card, fallback = 'deck') {
    let v = this.views.get(card.uid);
    if (v) return v;
    const m = this.m ?? this.metrics();
    const pos = fallback === 'discard' ? this.layer.at(m.disc.x, m.disc.y, 10) : this.layer.deck.topPos();
    return this.spawn(card, pos, fallback !== 'discard');
  }
  // the numbers printed on a card: yours on top; on the bottom, the demon's that holds it
  paintFor(v) {
    const b = this.b, c = v.card;
    const holder = b.demons.find(d => d.held.some(h => h.card === c));
    const o = { mods: b.modsFor(b.angel) };
    if (holder) o.dmods = b.modsFor(holder, b.angel);
    if (b.hand.includes(c)) o.cost = cardCost(c, b) === def(c).cost ? undefined : cardCost(c, b);
    v.setFace(o);
  }

  /* ================= per frame ================= */
  update(dt) {
    if (this.dead) return;
    this.layout(dt);
    const m = this.m, b = this.b;
    // repaint faces whose numbers changed (cheap: cached)
    this.faceTick = (this.faceTick ?? 0) + dt;
    if (this.faceTick > .2) { this.faceTick = 0; for (const v of this.views.values()) if (!v.dead) this.paintFor(v); }
    // plates and intents
    const spots = [];
    for (const [who, p] of this.plates) {
      const f = this.figs.get(who); if (!f) continue;
      const ft = this.stage.project(f.feet(this.tmp));
      spots.push({ who, p, x: ft.x, y: ft.y + 6 });
    }
    // demons standing close together: every other plate drops below its neighbour's
    const row = spots.filter(q => q.who !== b.angel).sort((a, c) => a.x - c.x), gap = innerWidth < 560 ? 92 : 122;
    for (let i = 1; i < row.length; i++) if (row[i].x - row[i - 1].x < gap && !row[i - 1].dropped) { row[i].y = Math.max(row[i].y, row[i - 1].y + 62); row[i].dropped = true; }
    for (const { who, p, x, y } of spots) {
      p.update(x, y, who === b.angel ? { powers: b.powers } : {});
      if (who !== b.angel) p.el.classList.toggle('hoarding', who.hoard?.length > 0), p.el.dataset.hoard = who.hoard?.length ? `Hoard ${who.hoard.length}/4` : '';
    }
    for (const d of b.demons) this.updateIntent(d);
    // pile counts and positions
    const deckN = b.deck.length, discN = b.discard.length;
    this.deckBadge.textContent = deckN; this.discBadge.textContent = discN; this.banBadge.textContent = b.banished.length;
    $('#deckPile').style.transform = `translate(${m.deck.x}px, ${m.deck.y + m.pileW * RATIO * .5 + 4}px) translate(-50%, 0)`;
    $('#discPile').style.transform = `translate(${m.disc.x}px, ${m.disc.y + m.pileW * RATIO * .5 + 4}px) translate(-50%, 0)`;
    this.graceEl.style.transform = `translate(${m.grace.x}px, ${m.grace.y}px) translate(-50%, -50%)`;
    this.endBtn.style.transform = `translate(${m.end.x}px, ${m.end.y}px) translate(-50%, -50%)`;
    this.updateSeenLabels();
    this.updateAim();
    this.root.classList.toggle('aiming', !!(this.aim || this.drag));
  }
  updateIntent(d) {
    let e = this.intents.get(d);
    if (!d.alive || !d.held.length) { if (e) e.hidden = true; return; }
    if (!e) { e = el('div', 'intent'); this.intentLayer.append(e); this.intents.set(d, e); }
    e.hidden = false;
    const html = d.held.map(h => this.intentChip(d, h)).join('');
    if (e._h !== html) { e.innerHTML = html; e._h = html; }
    const slots = this.heldSlots(d, this.m);
    if (!slots.length) return;
    const y = slots[0].y + this.m.heldW * RATIO * .5 + 4;
    e.style.transform = `translate(${slots.reduce((s, x) => s + x.x, 0) / slots.length}px, ${y}px) translate(-50%, 0)`;
  }
  intentChip(d, h) {
    const f = this.b.forecast(d, h);
    if (f.hidden) return `<span class="chip hidden">${img('question2', 'grey')}<b>?</b></span>`;
    const parts = [];
    if (f.dmg) parts.push(`<span class="chip atk">${img('sword', 'red')}<b>${f.dmg}${f.hits > 1 ? '×' + f.hits : ''}</b></span>`);
    if (f.scorch) parts.push(`<span class="chip holy">${img('sun', 'gold')}<b>−${f.scorch}</b></span>`);
    if (f.ward) parts.push(`<span class="chip def">${img('shield', 'blue')}<b>${f.ward}</b></span>`);
    if (f.burn) parts.push(`<span class="chip atk">${img('flame', 'red')}<b>${f.burn}</b></span>`);
    if (f.might) parts.push(`<span class="chip buff">${img('crown', 'red')}<b>+${f.might}</b></span>`);
    if (f.heal) parts.push(`<span class="chip heal">${img('heart', 'green')}<b>${f.heal}</b></span>`);
    for (const x of f.debuff) parts.push(`<span class="chip debuff">${img(x.includes('expos') ? 'brokenBlade' : 'question', 'violet')}</span>`);
    if (f.other.length && !parts.length) parts.push(`<span class="chip other">${img('star', 'grey')}</span>`);
    if (!parts.length) parts.push(`<span class="chip none">—</span>`);
    return `<span class="chips${h.orient === 'up' ? ' up' : ''}">${parts.join('')}</span>`;
  }
  // which demon will draw each known card next round
  updateSeenLabels() {
    const b = this.b, known = this.known ?? [];
    const order = [];
    for (const d of b.living()) { const n = b.drawsFor(d); for (let i = 0; i < n; i++) order.push(b.trait(d, 'mimic') ? null : d); }
    let html = '', k = 0;
    const mm = this.m;
    known.forEach((c, i) => {
      // order skips mimics (they take from the discard pile)
      while (k < order.length && order[k] === null) k++;
      const who = order[k++];
      const v = this.views.get(c.uid); if (!v) return;
      const p = this.layer.toScreen(v.p);
      html += `<div class="seen ${who ? 'demon' : 'you'}" style="transform:translate(${p.x.toFixed(0)}px,${(p.y - mm.pileW * RATIO * .5 - 4).toFixed(0)}px) translate(-50%,-100%)">${who ? '↗ ' + who.name : '↓ You'}</div>`;
    });
    if (this.seenLayer._h !== html) { this.seenLayer.innerHTML = html; this.seenLayer._h = html; }
  }

  /* ================= the engine's io ================= */
  turn(b) {
    return new Promise(async res => {
      await Promise.all(this.pending); this.pending = [];
      this.turnRes = res;
      if (b.result) return res();
      this.setInput(true);
      if (this.auto) this.autoTurn();
      this.app.onTurnStart?.(this);
    });
  }
  async autoTurn() {
    await this.wait(700);
    while (this.inputOn && !this.b.result) {
      const best = this.auto.bestPlay(this.b);
      if (!best || best.score <= 0) break;
      await this.playCard(best.card, best.target);
      await this.wait(350);
    }
    if (!this.b.result) this.endTurn();
  }
  setInput(on) {
    this.inputOn = on;
    this.endBtn.disabled = !on;
    this.endBtn.classList.toggle('ready', on);
    if (!on) { this.sel = null; this.aim = null; this.drag = null; this.hideTip(); }
  }
  endTurn() {
    if (!this.inputOn || this.b.busy || this.choosing) return;
    this.sfx.click();
    this.setInput(false);
    const r = this.turnRes; this.turnRes = null; r?.();
  }
  async playCard(card, target, held) {
    const b = this.b;
    if (!this.inputOn || b.busy || !b.canPlay(card)) return false;
    this.inputOn = false;
    this.sel = null; this.aim = null; this.hideTip();
    await b.play(card, target, held);
    await Promise.all(this.pending); this.pending = [];
    if (b.result) { this.setInput(false); const r = this.turnRes; this.turnRes = null; r?.(); return true; }
    this.inputOn = true;
    this.app.onPlayed?.(this, card);
    return true;
  }
  choose(req, b) {
    if (this.auto) return this.auto.choose(req, b);
    return new Promise(res => {
      this.choosing = { ...req, res };
      if (req.kind === 'hand') {
        this.showPrompt(req.prompt);
        if (!req.cards.length) { this.finishChoose([]); }
      } else if (req.kind === 'foresee') this.openForesee(req);
      else if (req.kind === 'discard') this.app.screens.pickFromList(req.cards, req.prompt, c => this.finishChoose(c ? [c] : []));
    });
  }
  finishChoose(result) {
    const ch = this.choosing; if (!ch) return;
    this.choosing = null; this.hidePrompt();
    if (ch.kind === 'foresee') this.closeForesee();
    ch.res(result);
  }
  showPrompt(text) { this.promptEl.innerHTML = richHTML(text); this.promptEl.hidden = false; }
  hidePrompt() { this.promptEl.hidden = true; }
  openForesee(req) {
    const m = this.m, L = this.layer, n = req.cards.length;
    this.foreseeDrop = new Set();
    const w = Math.min(m.cardW * 1.25, (m.W - 40) / Math.max(n, 1) / 1.05);
    req.cards.forEach((c, i) => {
      const v = this.viewOf(c);
      const x = m.W / 2 + (i - (n - 1) / 2) * w * 1.08, y = m.portrait ? m.H * .46 : m.H * .45;
      v.fly(L.at(x, y, 200 + i), V(0, 0, 0), w, { dur: .4, arc: 60 });
      v.foreseeSlot = { x, y, w };
    });
    this.showPrompt(`*Foresee*: tap a card to discard it. The rest stay on top, left first. The demons draw before you do.`);
    const done = $('#foreseeDone'); done.hidden = false;
    done.onclick = () => { this.sfx.click(); this.finishChoose([...this.foreseeDrop]); };
  }
  closeForesee() {
    $('#foreseeDone').hidden = true;
    for (const v of this.views.values()) { delete v.foreseeSlot; v.flash = 0; }
    this.foreseeDrop = null;
  }

  /* ================= input ================= */
  pointer(type, x, y, e) {
    if (this.dead) return;
    const b = this.b, L = this.layer, m = this.m;
    if (!m) return;
    // choosing which cards to keep after Foresee
    if (this.choosing?.kind === 'foresee') {
      if (type !== 'up') return;
      const v = L.pick(x, y, v => this.choosing.cards.includes(v.card));
      if (v) {
        this.sfx.flip();
        if (this.foreseeDrop.has(v.card)) { this.foreseeDrop.delete(v.card); v.dim = 1; v.target(L.at(v.foreseeSlot.x, v.foreseeSlot.y, 200), V(0, 0, 0), v.foreseeSlot.w); }
        else { this.foreseeDrop.add(v.card); v.dim = .45; v.target(L.at(v.foreseeSlot.x, v.foreseeSlot.y + 40, 200), V(0, 0, .15), v.foreseeSlot.w * .9); }
      }
      return;
    }
    if (this.choosing?.kind === 'hand') {
      if (type !== 'up') return;
      const v = L.pick(x, y, v => this.choosing.cards.includes(v.card));
      if (v) { this.sfx.click(); this.finishChoose([v.card]); }
      return;
    }
    if (type === 'move' && !this.drag && !e?.touch) {
      // hover: lift the card under the pointer; show what held cards do
      const v = L.pick(x, y, v => b.hand.includes(v.card));
      if (v !== this.hover) { this.hover = v; if (v) this.sfx.tick(); }
      if (v && !this.sel) this.showCardTip(v); else if (!this.sel) this.hideTip();
      const hv = L.pick(x, y, v => this.isHeld(v.card));
      if (hv !== this.inspectHeld) { this.inspectHeld = hv; if (hv) this.showHeldTip(hv); }
      if (v) this.tiltToward(v, x, y);
      const dPlate = this.demonAt(x, y);
      this.hoverDemon(dPlate && !v && !hv ? dPlate : null);
    }
    if (!this.inputOn) {
      if (type === 'down' || type === 'up') {
        const hv = L.pick(x, y, v => this.isHeld(v.card));
        if (type === 'up' && e?.touch) { this.inspectHeld = this.inspectHeld === hv ? null : hv; if (hv) this.showHeldTip(hv); else this.hideTip(); }
      }
      return;
    }
    if (type === 'down') {
      const v = L.pick(x, y, v => b.hand.includes(v.card));
      this.press = { x, y, t: performance.now(), view: v, moved: false };
      return;
    }
    if (type === 'move' && this.press) {
      const p = this.press;
      if (!p.moved && Math.hypot(x - p.x, y - p.y) > 10 && p.view && b.canPlay(p.view.card)) {
        p.moved = true;
        this.drag = { view: p.view };
        this.sel = null; this.hover = null;
        this.sfx.pick();
      }
      if (this.drag) {
        const v = this.drag.view, needs = b.needsTarget(v.card);
        if (needs && y < m.handTop - 10) {
          // aiming: the card waits above the hand, an arrow follows the pointer
          this.aim = { view: v, x, y }; this.drag = null;
        } else {
          v.target(L.at(x, y + m.cardH * .3, 120), V(0, 0, 0), m.cardW * 1.2);
          v.glowTarget = y < m.handTop - 20 ? 1 : .6;
        }
      } else if (this.aim) { this.aim.x = x; this.aim.y = y; if (y > m.handTop + 20) { this.drag = { view: this.aim.view }; this.aim = null; } }
      return;
    }
    if (type === 'move' && this.aim) { this.aim.x = x; this.aim.y = y; this.aim.moved = true; return; }
    if (type === 'up') {
      const p = this.press; this.press = null;
      if (this.aim) {
        const t = this.targetAt(x, y);
        const v = this.aim.view;
        if (t) { this.playCard(v.card, t.demon, t.held); }
        else if (p && !p.moved && this.aim.fromTap) { /* tapped elsewhere: keep aiming */ return; }
        this.aim = null; this.aimHeld = null;
        return;
      }
      if (this.drag) {
        const v = this.drag.view; this.drag = null;
        if (y < m.handTop - 20 && !b.needsTarget(v.card)) this.playCard(v.card, null);
        return;
      }
      // a tap
      if (p?.view) {
        const c = p.view.card;
        if (this.sel?.card === c) {
          // a second tap plays it (or, if it needs a demon, starts aiming)
          if (!b.needsTarget(c)) this.playCard(c, null);
        } else if (b.canPlay(c)) {
          this.sel = { card: c, view: p.view };
          this.sfx.pick();
          this.showCardTip(p.view);
          if (b.needsTarget(c)) { this.aim = { view: p.view, x: m.W / 2, y: m.H * .3, fromTap: true }; if (b.living().length === 1) {} }
        } else { this.sel = null; this.showCardTip(p.view); this.sfx.nope(); }
        return;
      }
      // tapped a demon or its card with a card selected
      if (this.sel && b.needsTarget(this.sel.card)) {
        const t = this.targetAt(x, y);
        if (t) { this.playCard(this.sel.card, t.demon, t.held); return; }
      }
      const hv = L.pick(x, y, v => this.isHeld(v.card));
      if (hv) { this.inspectHeld = this.inspectHeld === hv ? null : hv; if (this.inspectHeld) this.showHeldTip(hv); return; }
      this.sel = null; this.aim = null; this.inspectHeld = null; this.hideTip();
    }
  }
  key(e) {
    const b = this.b;
    if (this.choosing?.kind === 'foresee' && (e.key === 'Enter' || e.key === ' ')) { this.finishChoose([...this.foreseeDrop]); return; }
    if (!this.inputOn) return;
    if (e.key === 'e' || e.key === 'E') { this.endTurn(); return; }
    if (e.key === 'Escape') { this.sel = null; this.aim = null; this.hideTip(); return; }
    const n = e.key === '0' ? 10 : +e.key;
    if (n >= 1 && n <= b.hand.length) {
      const c = b.hand[n - 1];
      if (this.choosing?.kind === 'hand') { if (this.choosing.cards.includes(c)) this.finishChoose([c]); return; }
      if (this.sel?.card === c && !b.needsTarget(c)) { this.playCard(c, null); return; }
      const v = this.views.get(c.uid);
      this.sel = { card: c, view: v }; this.showCardTip(v);
      if (b.needsTarget(c)) { this.aim = { view: v, x: this.m.W / 2, y: this.m.H * .3, fromTap: true, keyTarget: 0 }; this.keyAim(0); }
      return;
    }
    if (this.aim && (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); this.keyAim(e.key === 'ArrowLeft' ? -1 : 1); return; }
    if ((e.key === 'Enter' || e.key === ' ') && this.sel) {
      e.preventDefault();
      const c = this.sel.card;
      if (b.needsTarget(c)) { const d = b.living()[this.aim?.keyTarget ?? 0]; if (d) this.playCard(c, d); }
      else this.playCard(c, null);
    }
  }
  keyAim(dir) {
    const l = this.b.living(); if (!l.length || !this.aim) return;
    this.aim.keyTarget = ((this.aim.keyTarget ?? 0) + dir + l.length) % l.length;
    const f = this.figs.get(l[this.aim.keyTarget]); const c = this.stage.project(f.center(this.tmp));
    this.aim.x = c.x; this.aim.y = c.y;
  }
  isHeld(card) { return this.b.demons.some(d => d.alive && d.held.some(h => h.card === card)); }
  demonAt(x, y) {
    let best = null;
    for (const d of this.b.living()) {
      const f = this.figs.get(d); if (!f) continue;
      const a = this.stage.project(f.feet(this.tmp)), t = this.stage.project(f.top(new THREE.Vector3()));
      const hw = Math.max(40, (a.y - t.y) * .35);
      if (x > a.x - hw && x < a.x + hw && y > t.y - 10 && y < a.y + 30) best = d;
    }
    return best;
  }
  targetAt(x, y) {
    const hv = this.layer.pick(x, y, v => this.isHeld(v.card));
    if (hv) { const d = this.b.demons.find(d => d.held.some(h => h.card === hv.card)); return { demon: d, held: d.held.find(h => h.card === hv.card) }; }
    const d = this.demonAt(x, y);
    return d ? { demon: d, held: null } : null;
  }
  tiltToward(v, x, y) {
    const s = this.layer.toScreen(v.p);
    v.hoverTilt.set(clamp((y - s.y) / (v.s * RATIO) * .5, -.35, .35), clamp((x - s.x) / v.s * .6, -.4, .4));
  }
  hoverDemon(d) {
    for (const [who, f] of this.figs) if (who !== this.b.angel) f.hi = who === d ? .6 : 0;
    if (d !== this.hoveredDemon) { this.hoveredDemon = d; if (d) this.showDemonTip(d); else if (!this.hover && !this.inspectHeld) this.hideTip(); }
  }
  updateAim() {
    const a = this.aim, svg = this.arrow;
    // aiming by tap: no arrow yet, every demon glows and waits to be tapped
    if (a && this.inputOn && a.fromTap && !a.moved && a.keyTarget == null) {
      svg.classList.remove('on'); this.reticle.classList.remove('on');
      const pulse = .35 + .3 * Math.sin(this.stage.time * 5);
      for (const [who, f] of this.figs) if (who !== this.b.angel) f.hi = who.alive ? pulse : 0;
      if (this.promptEl.hidden || !this.promptEl._aim) { this.showPrompt(`Tap a demon${this.b.living().length > 1 ? ' (or the card it holds)' : ''} to play <em>${def(a.view.card).title}</em> on it.`); this.promptEl._aim = true; }
      return;
    }
    if (this.promptEl._aim) { this.promptEl._aim = false; if (!this.choosing) this.hidePrompt(); }
    if (!a || !this.inputOn) { svg.classList.remove('on'); this.reticle.classList.remove('on'); this.aimHeld = null; if (!this.hoveredDemon) for (const [who, f] of this.figs) if (who !== this.b.angel) f.hi = 0; return; }
    const v = a.view, s = this.layer.toScreen(v.p);
    const sx = s.x, sy = s.y - v.s * RATIO * .5;
    const t = this.targetAt(a.x, a.y);
    this.aimHeld = t?.held ?? null;
    let ex = a.x, ey = a.y;
    for (const [who, f] of this.figs) if (who !== this.b.angel) f.hi = t?.demon === who ? 1 : 0;
    if (t) {
      const f = this.figs.get(t.demon), c = this.stage.project(f.center(this.tmp));
      this.reticle.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)`; this.reticle.classList.add('on');
      if (!t.held) { ex = c.x; ey = c.y; }
    } else this.reticle.classList.remove('on');
    const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 80;
    svg.classList.add('on'); svg.classList.toggle('hot', !!t);
    $('#arrowPath').setAttribute('d', `M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}`);
    $('#arrowCore').setAttribute('d', `M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}`);
    const ang = Math.atan2(ey - my, ex - mx) * 180 / PI;
    $('#arrowHead').setAttribute('transform', `translate(${ex} ${ey}) rotate(${ang})`);
  }

  /* ================= tooltips ================= */
  showCardTip(v) {
    const d = def(v.card);
    const up = uprightText(v.card, this.b.modsFor(this.b.angel)), down = reversedText(v.card);
    const keys = keywordsIn(up + ' ' + down);
    if (d.holy && !keys.includes('Holy')) keys.unshift('Holy');
    if (d.rarity === 'infernal') keys.push('Infernal');
    if (d.type === 'curse') keys.push('Curse');
    if (d.type === 'power') keys.push('Power');
    // beside where the card will rest when lifted, so it never covers it
    const m = this.m, sc = m.cardW * (m.portrait ? 1.55 : 1.42), s = this.layer.toScreen(v.tp);
    const cx = clamp(s.x, sc / 2 + 6, m.W - sc / 2 - 6), top = m.H - sc * RATIO - 8;
    const html = `<div class="tt-rev"><span>If a demon draws it:</span> ${richHTML(down || 'Nothing happens.')}</div>${tipHTML(keys)}`;
    if (m.portrait) this.showTip(html, m.W / 2, top - 8, 'above');
    else this.showTip(html, cx + sc / 2 + 12, top + 10, 'right', cx - sc / 2 - 12);
  }
  showHeldTip(v) {
    const b = this.b, d = b.demons.find(d => d.held.some(h => h.card === v.card)); if (!d) return;
    const h = d.held.find(h => h.card === v.card);
    const x = def(v.card);
    let text;
    if (h.hidden) text = `The ${d.name} keeps this card face down.`;
    else if (h.orient === 'up') text = `<b>${d.name}</b> reads it upright: ${richHTML(uprightText(v.card, b.modsFor(d, b.angel)).replace(/Deal/g, 'Deals'))}`;
    else text = `<b>${d.name}</b> will play: ${richHTML(reversedText(v.card, b.modsFor(d, b.angel)))}`;
    const keys = keywordsIn(h.orient === 'up' ? uprightText(v.card) : reversedText(v.card));
    if (x.holy && h.orient === 'down') keys.unshift('Holy');
    const s = this.layer.toScreen(v.p);
    this.showTip(`<div class="tt-held">${text}</div>${tipHTML(keys)}`, s.x, s.y + v.s * RATIO * .55 + 8, 'below');
  }
  showDemonTip(d) {
    const tr = d.traits.map(t => TRAITS[t.id]).filter(Boolean);
    const f = this.figs.get(d); const c = this.stage.project(f.feet(this.tmp));
    const lines = [`<div class="tt-name">${d.name}${d.def.title ? `<small>${d.def.title}</small>` : ''}</div>`, `<div class="kw">Draws <b>${this.b.drawsFor(d)}</b> card${this.b.drawsFor(d) > 1 ? 's' : ''} each round${d.st.might ? `, with <b>${d.st.might}</b> Might` : ''}.</div>`];
    for (const t of tr) lines.push(`<div class="kw"><b>${t.name}</b> ${t.text}</div>`);
    if (d.def.deck.length) lines.push(`<div class="kw dim">Brought ${[...new Set(d.def.deck)].map(id => CARDS[id].name).join(', ')} into the deck.</div>`);
    for (const [k, s] of Object.entries(STATUS)) if (d.st[k] > 0 && k !== 'might') lines.push(`<div class="kw"><b>${s.name} ${d.st[k]}</b></div>`);
    this.showTip(lines.join(''), c.x, c.y + 70, 'below');
  }
  showTip(html, x, y, where, altX) {
    const t = this.tip; t.innerHTML = html; t.hidden = false;
    const r = t.getBoundingClientRect();
    const W = innerWidth;
    let left = clamp(x - r.width / 2, 8, W - r.width - 8), top = where === 'above' ? y - r.height : y;
    if (where === 'right') { left = x + r.width < W - 8 ? x : altX - r.width; top = y; }
    top = clamp(top, 56, innerHeight - r.height - 8);
    t.style.transform = `translate(${left}px, ${top}px)`;
  }
  hideTip() { this.tip.hidden = true; }

  /* ================= events from the engine ================= */
  async ev(type, d, b) {
    if (this.dead) return;
    const m = this.m ?? this.metrics(), L = this.layer, S = this.stage, fx = this.fx, sfx = this.sfx;
    const fig = c => this.figs.get(c);
    const centerOf = c => fig(c)?.center(new THREE.Vector3());
    const screenOf = c => S.project(centerOf(c) ?? new THREE.Vector3());
    switch (type) {
      case 'setup': {
        const angel = new Figure('angel', 1.15, { facing: 1, lit: .3 });
        this.figs.set(b.angel, angel);
        const ds = b.demons.map(dm => { const f = new Figure(dm.def.look, dm.def.size ?? 1, { facing: -1 }); this.figs.set(dm, f); f.dissolve = 1; return f; });
        S.setFigures(angel, ds);
        this.plates.set(b.angel, new Plate(this.plateLayer, b.angel, { angel: true }));
        for (const dm of b.demons) this.plates.set(dm, new Plate(this.plateLayer, dm));
        this.m = this.metrics();
        L.deck.set(b.deck.length, L.at(this.m.deck.x, this.m.deck.y, 0), this.m.pileW);
        sfx.rumble();
        for (let t = 0; t <= 1; t += .05) { for (const f of ds) f.dissolve = 1 - t; await this.wait(28); }
        for (const f of ds) f.dissolve = 0;
        break;
      }
      case 'round': $('#roundNo').textContent = d.round; break;
      case 'phase':
        if (d.who === 'demonsDraw') { if (b.round === 1) banner('The demons draw first', 'Each holds its card over its head, upside down', 'demon'); sfx.drone(); await this.wait(b.round === 1 ? 700 : 150); }
        else if (d.who === 'angel') { await Promise.all(this.pending); this.pending = []; banner('Your turn', `Round ${b.round}`, 'angel'); sfx.chime(); await this.wait(350); }
        else if (d.who === 'demons') { banner('The demons act', '', 'demon'); await this.wait(550); }
        break;
      case 'demonDraw': {
        const v = this.viewOf(d.card, d.from === 'discard' ? 'discard' : 'deck');
        const slots = this.heldSlots(d.demon, m);
        const i = d.demon.held.findIndex(h => h.card === d.card);
        const s = slots[i >= 0 ? i : 0] ?? { x: m.W * .7, y: m.H * .2, rz: 0 };
        this.paintFor(v);
        sfx.draw(); setTimeout(() => sfx.turn(), 200 / this.spd);
        await v.fly(L.at(s.x, s.y, 40), V(0, d.hidden ? PI : 0, (d.orient === 'down' ? PI : 0) + (s.rz ?? 0)), m.heldW, { dur: .5 / this.spd, arc: 90, lift: 160, spin: d.orient === 'down' ? PI * 2 : 0 });
        if (d.peek) { await this.burnCard(v, d.demon); }
        else { fx.ring(this.figs.get(d.demon).top(new THREE.Vector3()), d.orient === 'up' ? '#c8a8ff' : '#ff6a3a', 1.6); await this.wait(90); }
        break;
      }
      case 'draw': {
        const v = this.viewOf(d.card, 'deck');
        this.paintFor(v);
        sfx.draw();
        const slots = this.handSlots(b.hand.length, m), s = slots[b.hand.indexOf(d.card)];
        this.pending.push(v.fly(L.at(s.x, s.y, 60), V(0, 0, s.rz), m.cardW, { dur: .42 / this.spd, arc: 60, lift: 140 }));
        await this.wait(105);
        break;
      }
      case 'reshuffle': {
        sfx.shuffle();
        floater(this.floatLayer, m.deck.x, m.deck.y - 40, d.who === 'angel' || !d.who ? 'Reshuffled' : 'Reshuffled', 'small');
        const flights = [];
        let k = 0;
        for (const v of [...this.views.values()]) {
          if (!b.deck.includes(v.card) || v.flight) continue;
          flights.push(v.fly(L.deck.topPos(), V(0, PI, 0), m.pileW, { dur: (.35 + k * .03) / this.spd, arc: 40 }).then(() => { this.layer.remove(v); this.views.delete(v.card.uid); }));
          k++;
        }
        await Promise.all(flights);
        break;
      }
      case 'shuffleDeck': sfx.shuffle(); floater(this.floatLayer, m.deck.x, m.deck.y - 40, 'Shuffled!', 'small'); await this.wait(300); break;
      case 'play': {
        const v = this.viewOf(d.card);
        this.paintFor(v);
        sfx.play();
        const an = fig(b.angel);
        an.doLunge(.6, { dur: .5, peak: .35 });
        await v.fly(L.at(m.play.x, m.play.y, 150), V(0, 0, 0), m.playW, { dur: .28 / this.spd, arc: 40, ease: 'out' });
        v.flash = .6; setTimeout(() => { v.flash = 0; }, 140);
        await this.wait(120);
        break;
      }
      case 'demonPlay': {
        const v = this.viewOf(d.card, d.from === 'hoard' ? 'deck' : 'deck');
        this.paintFor(v);
        const f = fig(d.demon), a = fig(b.angel);
        const rev = d.orient === 'down';
        (this.demonPlaying ??= []).push(v);
        const s = screenOf(d.demon);
        // the card is thrown down toward its target
        sfx.demonPlay();
        const tgtScreen = d.mode === 'rebuke' ? s : screenOf(b.angel);
        const mid = { x: (s.x * .4 + tgtScreen.x * .6), y: Math.min(s.y, tgtScreen.y) - m.H * .05 };
        f.doLunge(d.mode === 'rebuke' ? .3 : -.9, { dur: .55, peak: .35 });
        await v.fly(L.at(mid.x, mid.y, 150), V(0, 0, rev ? PI : 0), m.playW * .85, { dur: .32 / this.spd, arc: 50, ease: 'out' });
        v.flash = .5; setTimeout(() => { v.flash = 0; }, 140);
        await this.wait(140);
        this.demonPlaying = this.demonPlaying.filter(x => x !== v);
        break;
      }
      case 'aoe': if (d.src === b.angel) { sfx.whoosh(); for (const t of d.targets) { const c = centerOf(t); if (c) fx.ring(c, '#ffe08a', 3); } await this.wait(80); } break;
      case 'damage': {
        const t = d.target, f = fig(t); if (!f) break;
        const c = f.center(new THREE.Vector3()), sc = S.project(c);
        const toAngel = t === b.angel;
        if (d.src && d.attack) {
          const sf = fig(d.src);
          if (d.src === b.angel) { sf.doLunge(1.2, { dur: .42, peak: .3, tilt: -.1 }); fx.slash(c, d.card && def(d.card).holy ? '#fff2b0' : '#ffe0a0', 1); sfx.slash(); }
          else if (sf) { sf.doLunge(-1.1, { dur: .45, peak: .3, tilt: .1 }); fx.claw(c, '#ff5a3a'); sfx.claw(); }
        }
        if (d.scorch) { fx.beam(f.feet(new THREE.Vector3()), '#fff0a0', f.height + 3); fx.glow(c, '#ffd36a', 3); S.burst(c, { color: '#ffe08a', n: 30, speed: 3 }); sfx.holy(); floater(this.floatLayer, sc.x, sc.y - 50, 'Scorched!', 'holy small'); }
        if (d.burn) { S.burst(c, { color: '#ff7a2a', n: 14, speed: 1.5, up: 2 }); sfx.burn(); }
        if (d.amount > 0) {
          f.hit(toAngel ? -1 : 1);
          S.shake(toAngel ? Math.min(1, .25 + d.amount / 25) : Math.min(.6, .1 + d.amount / 40));
          S.burst(c, { color: toAngel ? '#ff4a2a' : '#ffd080', n: 10 + Math.min(20, d.amount), speed: 2.5 });
          floater(this.floatLayer, sc.x, sc.y, String(d.amount), toAngel ? 'hurt big' : 'dmg big');
          sfx.hit(d.amount);
          if (toAngel) this.app.flashScreen?.('hurt');
        }
        if (d.blocked > 0) { fx.shield(c, toAngel ? '#9fd8ff' : '#ff9a7a', f.height * .9); floater(this.floatLayer, sc.x + 30, sc.y - 30, `${img('shield', 'blue')}${d.blocked}`, 'blocked small'); sfx.block(); }
        if (d.amount === 0 && d.blocked === 0 && d.attack) floater(this.floatLayer, sc.x, sc.y, '0', 'dmg');
        await this.wait(d.attack ? 230 : 160);
        break;
      }
      case 'ward': {
        if (!d.gained) break;
        const f = fig(d.target); const c = f.center(new THREE.Vector3()), sc = S.project(c);
        fx.shield(c, d.target === b.angel ? '#9fd8ff' : '#ff9a7a', f.height * .95);
        floater(this.floatLayer, sc.x, sc.y - 20, `+${d.gained} ${img('shield', 'blue')}`, 'ward');
        sfx.ward();
        await this.wait(160);
        break;
      }
      case 'heal': {
        const f = fig(d.target); const c = f.center(new THREE.Vector3()), sc = S.project(c);
        fx.glow(c, '#8fffb0', 3); S.burst(c, { color: '#a8ffc0', n: 16, speed: 1.4, up: 2, grav: -1 });
        floater(this.floatLayer, sc.x, sc.y - 20, `+${d.amount}`, 'heal');
        sfx.heal(); await this.wait(180);
        break;
      }
      case 'status': {
        if (!d.delta) break;
        const f = fig(d.target); if (!f) break;
        const sc = S.project(f.top(new THREE.Vector3())), s = STATUS[d.key];
        floater(this.floatLayer, sc.x, sc.y + 30, `${d.delta > 0 ? '+' : ''}${d.delta} ${s?.name ?? d.key}`, 'status small ' + d.key);
        if (d.key === 'burn') S.burst(f.center(new THREE.Vector3()), { color: '#ff7a2a', n: 10, speed: 1.2, up: 2 });
        if (d.key === 'might') sfx.buff();
        await this.wait(110);
        break;
      }
      case 'grace': this.setGrace(d.value, d.gained); break;
      case 'next': break;
      case 'discard': {
        let v = this.views.get(d.card.uid);
        if (!v && (d.from === 'belly' || d.from === 'hoard') && d.demon && this.figs.get(d.demon)) {
          const p = S.project(this.figs.get(d.demon).center(new THREE.Vector3()));
          v = this.spawn(d.card, L.at(p.x, p.y, 60), false);
        }
        v ??= this.viewOf(d.card, 'deck');
        const top = L.at(m.disc.x, m.disc.y, 20);
        const r = Math.sin(d.card.uid * 12.9) * .2;
        const dur = d.from === 'hand' ? .32 : .38;
        const p = v.fly(top, V(0, 0, r), m.pileW, { dur: dur / this.spd, arc: 60, spin: d.from === 'held' ? PI * 2 : 0 });
        if (d.from === 'hand') { this.pending.push(p); await this.wait(45); }
        else { sfx.discard(); await p; }
        break;
      }
      case 'banish': {
        const v = this.views.get(d.card.uid);
        sfx.burn();
        if (v) await this.burnCard(v);
        break;
      }
      case 'eat': {
        const v = this.viewOf(d.card, d.from === 'deck' ? 'deck' : 'deck');
        const f = fig(d.demon), head = S.project(f.top(new THREE.Vector3()));
        sfx.chomp();
        await v.fly(L.at(head.x, head.y + 30, 50), V(0, 0, 1.5), m.heldW * .3, { dur: .35 / this.spd, arc: 30 });
        f.hit(1);
        this.layer.remove(v); this.views.delete(d.card.uid);
        floater(this.floatLayer, head.x, head.y + 10, d.belly ? 'Swallowed' : 'Devoured', 'small demon');
        break;
      }
      case 'hoard': {
        const v = this.views.get(d.card.uid); const f = fig(d.demon); const ft = S.project(f.feet(new THREE.Vector3()));
        sfx.coin();
        if (v) { await v.fly(L.at(ft.x + 50, ft.y, 20), V(0, PI, .4), m.heldW * .5, { dur: .3 / this.spd }); this.layer.remove(v); this.views.delete(d.card.uid); }
        floater(this.floatLayer, ft.x + 40, ft.y - 20, 'Hoarded', 'small demon');
        break;
      }
      case 'offer': case 'recall': {
        const v = this.viewOf(d.card, type === 'recall' ? 'discard' : 'deck');
        sfx.offer();
        const p = L.deck.topPos(); p.z += 60;
        await v.fly(p, V(0, 0, 0), m.pileW, { dur: .4 / this.spd, arc: 80 });
        floater(this.floatLayer, m.deck.x, m.deck.y - 60, type === 'offer' ? 'Offered' : 'On top', 'small holy');
        break;
      }
      case 'foresee': sfx.reveal(); await this.wait(120); break;
      case 'foreseeDone': await this.wait(150); break;
      case 'disarm': {
        const v = this.viewOf(d.card); const sc = screenOf(d.demon);
        sfx.disarm(); fig(d.demon).hit(1);
        floater(this.floatLayer, sc.x, sc.y - 40, 'Disarmed!', 'holy');
        await v.fly(L.at(m.disc.x, m.disc.y, 20), V(0, 0, Math.sin(d.card.uid) * .2), m.pileW, { dur: .5 / this.spd, arc: 160, spin: PI * 3 });
        break;
      }
      case 'redeem': {
        const v = this.viewOf(d.card); const sc = screenOf(d.demon);
        sfx.redeem(); fx.glow(fig(d.demon).top(new THREE.Vector3()), '#fff0b0', 2.5);
        floater(this.floatLayer, sc.x, sc.y - 40, 'Redeemed!', 'holy');
        const slots = this.handSlots(b.hand.length, m), s = slots[b.hand.indexOf(d.card)];
        this.paintFor(v);
        await v.fly(L.at(s.x, s.y, 60), V(0, 0, s.rz), m.cardW, { dur: .6 / this.spd, arc: 120, spin: -PI });
        break;
      }
      case 'swap': {
        const vg = this.viewOf(d.given), vt = this.viewOf(d.taken);
        sfx.swap();
        const slots = this.heldSlots(d.demon, m), i = d.demon.held.findIndex(h => h.card === d.given), s = slots[i] ?? slots[0];
        const hs = this.handSlots(b.hand.length, m), j = b.hand.indexOf(d.taken), t = hs[j];
        this.paintFor(vg); this.paintFor(vt);
        await Promise.all([
          vg.fly(L.at(s.x, s.y, 40), V(0, 0, d.orient === 'down' ? PI : 0), m.heldW, { dur: .55 / this.spd, arc: 120, spin: d.orient === 'down' ? PI * 2 : 0 }),
          vt.fly(L.at(t.x, t.y, 60), V(0, 0, t.rz), m.cardW, { dur: .55 / this.spd, arc: -60 }),
        ]);
        break;
      }
      case 'death': {
        const f = fig(d.target); if (!f) break;
        if (d.target === b.angel) { sfx.angelDies(); f.speed = .2; for (let t = 0; t <= 1; t += .04) { f.alpha = 1 - t * .6; await this.wait(30); } break; }
        sfx.death();
        const c = f.center(new THREE.Vector3());
        S.burst(c, { color: '#ffb060', n: 50, speed: 3.5, up: 2 }); S.burst(c, { color: '#2a1a1a', n: 24, speed: 2, dark: true, up: 1.5 });
        S.shake(.4);
        this.plates.get(d.target)?.remove(); this.plates.delete(d.target);
        const it = this.intents.get(d.target); if (it) { it.remove(); this.intents.delete(d.target); }
        f.leaving = true;
        (async () => { for (let t = 0; t <= 1; t += .04) { f.dissolve = t; await this.wait(30); } f.dispose(); S.figures = S.figures.filter(x => x !== f); S.layout(); })();
        await this.wait(300);
        break;
      }
      case 'summon': {
        const f = new Figure(d.demon.def.look, d.demon.def.size ?? 1, { facing: -1 });
        this.figs.set(d.demon, f); f.dissolve = 1;
        S.setFigures(fig(b.angel), [...S.figures.filter(x => x !== fig(b.angel) && !x.leaving), f]);
        this.plates.set(d.demon, new Plate(this.plateLayer, d.demon));
        sfx.summon();
        const c = f.center(new THREE.Vector3());
        S.burst(c, { color: '#ff6a2a', n: 40, speed: 3, up: 3 });
        for (let t = 0; t <= 1; t += .08) { f.dissolve = 1 - t; await this.wait(30); }
        f.dissolve = 0;
        break;
      }
      case 'say': {
        const who = d.who ?? b.angel; const f = fig(who); if (!f) break;
        const sc = S.project(f.top(new THREE.Vector3()));
        floater(this.floatLayer, sc.x, sc.y + 10, d.text, 'say ' + (who === b.angel ? 'holy' : 'demon'));
        await this.wait(260);
        break;
      }
      case 'flash': this.app.flashCharm?.(d.charm); break;
      case 'thorns': { const f = fig(d.to); if (f) { this.fx.claw(f.center(new THREE.Vector3()), '#8fff8a'); sfx.claw(); } await this.wait(120); break; }
      case 'power': {
        const v = this.views.get(d.card.uid);
        sfx.power();
        if (v) {
          const a = S.project(fig(b.angel).center(new THREE.Vector3()));
          fx.beam(fig(b.angel).feet(new THREE.Vector3()), '#fff0b0', 8);
          await v.fly(L.at(a.x, a.y, 100), V(0, 0, 0), m.cardW * .4, { dur: .45 / this.spd, arc: 60 });
          this.layer.remove(v); this.views.delete(d.card.uid);
        }
        break;
      }
      case 'powers': break;
      case 'addCards': {
        sfx.curse();
        const from = d.demon ? S.project(fig(d.demon).center(new THREE.Vector3())) : { x: m.W / 2, y: m.H * .3 };
        const flights = [];
        for (let i = 0; i < d.n; i++) {
          const c = { uid: -1e6 - Math.random() * 1e6 | 0, id: d.id, plus: false };
          const v = this.layer.add(c); v.place(L.at(from.x, from.y, 80), V(0, 0, 0), m.heldW); v.setFace({});
          flights.push(this.wait(i * 120).then(() => v.fly(L.deck.topPos(), V(0, PI, 0), m.pileW, { dur: .5 / this.spd, arc: 80 })).then(() => this.layer.remove(v)));
        }
        floater(this.floatLayer, from.x, from.y - 40, `+${d.n} ${CARDS[d.id].name}`, 'small demon');
        await Promise.all(flights);
        break;
      }
      case 'devilBreaks': S.shake(1.2); sfx.ice(); this.app.flashScreen?.('ice'); await this.wait(600); break;
      case 'pulse': { const v = this.views.get(d.card.uid); if (v) { v.flash = .8; await this.wait(200); v.flash = 0; } break; }
      case 'obols': this.app.updateTop?.(); break;
      case 'handEnd': await Promise.all(this.pending); this.pending = []; break;
      case 'settled': break;
      case 'end': {
        this.setInput(false);
        await Promise.all(this.pending); this.pending = [];
        await this.wait(400);
        break;
      }
    }
  }
  async burnCard(v, demon) {
    for (let t = 0; t <= 1; t += .06) { v.burn = t; await this.wait(25); }
    this.layer.remove(v); this.views.delete(v.card.uid);
  }
  setGrace(n, gained) {
    const g = this.graceEl;
    g.querySelector('b').textContent = n;
    g.querySelector('small').textContent = '/' + this.b.graceMax;
    g.classList.toggle('empty', n === 0);
    if (gained) { g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop'); }
  }
  dispose() {
    this.dead = true;
    for (const v of this.views.values()) this.layer.remove(v);
    this.views.clear();
    for (const p of this.plates.values()) p.el.remove();
    for (const e of this.intents.values()) e.remove();
    this.layer.deck.set(0, this.layer.at(0, 0, 0), 1);
    this.root.hidden = true;
    this.hideTip(); this.hidePrompt();
    this.arrow.classList.remove('on'); this.reticle.classList.remove('on');
    this.seenLayer.innerHTML = '';
  }
}
