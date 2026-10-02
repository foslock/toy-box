// Harrowing: an angel's descent through the nine circles of Hell, with one deck shared between you and every demon
// you meet. This file runs the page: the renderer and the loop, input, saving, and the walk from the gate to the pit.
import * as THREE from 'three';
import { Stage, Figure } from './stage.js';
import { CardLayer } from './cards3d.js';
import { FX } from './fx.js';
import { Sound } from './sound.js';
import { Screens } from './screens.js';
import { BattleView } from './battleview.js';
import { Battle } from './engine.js';
import { Run, ROWS } from './run.js';
import { CHARMS } from './charms.js';
import { CIRCLES } from './enemies.js';
import { def } from './cards.js';
import { pickEvent } from './events.js';
import { Bot } from './bot.js';
import { $, el, img, icon } from './hud.js';
import { defaults as inspectDefaults, inspecting } from './inspect.js';

const SAVE = 'harrowing.run.v1', PREFS = 'harrowing.prefs.v1';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
const q = new URLSearchParams(location.search);

class App {
  constructor() {
    this.canvas = $('#c');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.renderer.autoClear = false;
    this.stage = new Stage();
    this.cards = new CardLayer();
    this.fx = new FX(this.stage);
    this.sound = new Sound();
    this.screens = new Screens(this);
    inspectDefaults.sfx = this.sound;
    this.prefs = store.get(PREFS) ?? { sound: true, speed: 1, coach: {} };
    this.prefs.coach ??= {};
    this.speed = this.prefs.speed ?? 1;
    this.sound.enabled = this.prefs.sound !== false;
    this.run = null; this.battle = null; this.bv = null;
    this.angelFig = null;
    this.bindInput();
    addEventListener('resize', () => this.resize());
    this.resize();
    $('#hpIcon').src = icon('heart', 'red'); $('#obolIcon').src = icon('coin', 'gold'); $('#deckIcon').src = icon('scroll', 'gold'); $('#mapIcon').src = icon('eyeStar', 'gold');
    $('#deckBtn').onclick = () => this.peekDeck();
    $('#mapBtn').onclick = () => this.peekMap();
    $('#menuBtn').onclick = () => this.screens.menu();
    $('#deckPile').onclick = () => this.peekPile('deck');
    $('#discPile').onclick = () => this.peekPile('discard');
  }
  savePrefs() { store.set(PREFS, this.prefs); }
  save() { if (this.run) store.set(SAVE, this.run); }
  toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('on'); clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('on'), 2200); }
  flashScreen(kind) { const f = $('#flashScreen'); f.className = kind; requestAnimationFrame(() => requestAnimationFrame(() => { f.className = ''; })); }
  flashCharm(id) { const e = document.querySelector(`.charm[data-id="${id}"]`); if (!e) return; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }

  /* ---------- the frame ---------- */
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    const portrait = w / h < .9;
    const band = this.bv ? (portrait ? [.075, .6] : [.08, .72]) : this.titleMode ? (portrait ? [.52, .99] : [.52, 1.06]) : (portrait ? [.12, .7] : [.12, .9]);
    this.stage.resize(w, h, band);
    this.cards.resize(w, h);
  }
  start() {
    let last = performance.now();
    const frame = t => {
      const dt = Math.max(0, Math.min(.1, (t - last) / 1000)); last = t;
      this.stage.update(dt); this.fx.update(dt); this.cards.update(dt); this.bv?.update(dt);
      const r = this.renderer;
      r.clear(); r.render(this.stage.scene, this.stage.camera);
      r.clearDepth(); r.render(this.cards.scene, this.cards.camera);
      requestAnimationFrame(frame);
    };
    for (let i = 0; i < 90; i++) this.stage.update(1 / 30);
    requestAnimationFrame(frame);
    window.toyboxReady?.();
  }
  bindInput() {
    const c = this.canvas;
    const pt = (type, e) => {
      if (!this.bv || this.screens.open) return;
      this.bv.pointer(type, e.clientX, e.clientY, { touch: e.pointerType === 'touch' || e.pointerType === 'pen' });
    };
    c.addEventListener('pointerdown', e => { c.setPointerCapture?.(e.pointerId); pt('down', e); });
    c.addEventListener('pointermove', e => {
      pt('move', e);
      this.stage.pointer.set((e.clientX / innerWidth - .5) * 2, -(e.clientY / innerHeight - .5) * 2);
    });
    c.addEventListener('pointerup', e => pt('up', e));
    c.addEventListener('pointercancel', e => pt('up', e));
    addEventListener('keydown', e => {
      if ((e.key === 'd' || e.key === 'D') && this.run && !e.ctrlKey && !e.metaKey && !inspecting()) { this.peekDeck(); return; }
      if (e.key === 'Escape' && this.screens.open && this.screens.root.querySelector('.browser')) { this.closePeek(); return; }
      if (this.bv && !this.screens.open) this.bv.key(e);
    });
    // right-click (or a long press, handled by the fight) opens a card up to read both sides
    c.addEventListener('contextmenu', e => { e.preventDefault(); if (this.bv && !this.screens.open) this.bv.inspectAt(e.clientX, e.clientY); });
    addEventListener('pointerdown', () => this.sound.unlock(), { capture: true });
    addEventListener('keydown', () => this.sound.unlock(), { capture: true });
  }

  /* ---------- the top bar ---------- */
  updateTop() {
    const r = this.run; if (!r) return;
    $('#top').hidden = false;
    const hp = this.battle && !this.battle.result ? this.battle.angel.hp : r.hp;
    $('#hpTxt').textContent = `${Math.max(0, hp)}/${r.maxHp}`;
    $('#obolTxt').textContent = r.obols;
    const ci = r.circle;
    $('#depthTxt').textContent = `${ROMAN[ci]} · ${CIRCLES[ci].name}`;
    $('#deckN').textContent = r.deck.length;
    const key = r.charms.join();
    if ($('#charms')._k !== key) {
      $('#charms')._k = key;
      $('#charms').innerHTML = r.charms.map(id => { const c = CHARMS[id]; return `<div class="charm" data-id="${id}" title="${c.name}: ${c.text}"><img src="${icon(c.glyph, c.rarity === 'boss' ? 'red' : 'gold')}" alt="${c.name}"></div>`; }).join('');
      for (const e of $('#charms').children) e.onclick = () => this.toast(e.title);
    }
  }
  // the angel alone on the ledge, behind the map and the other pages
  idleScene(title = false) {
    this.titleMode = title;
    if (title) this.stage.setCircle(5, 'gate'); else this.stage.setCircle(this.run ? this.run.circle : 0);
    if (!this.angelFig) this.angelFig = new Figure('angel', 1.15, { facing: 1, lit: .3 });
    this.angelFig.placed = false; this.angelFig.alpha = 1; this.angelFig.dissolve = 0; this.angelFig.speed = 1;
    this.stage.setFigures(this.angelFig, []);
    this.resize();
    this.sound.setDrone(this.run ? this.run.circle : 0);
  }

  /* ---------- the run ---------- */
  boot() {
    const saved = store.get(SAVE);
    if (q.has('demo')) return this.demo();
    this.idleScene(true);
    this.screens.title(!!saved);
  }
  newRun() {
    const seed = q.has('seed') ? +q.get('seed') : (Math.random() * 2 ** 32) >>> 0;
    this.run = new Run(seed);
    this.save();
    this.updateTop();
    this.idleScene();
    this.screens.blessing();
  }
  continueRun() {
    const s = store.get(SAVE);
    if (!s) return this.newRun();
    try { this.run = Run.from(s); } catch (e) { console.error(e); return this.newRun(); }
    this.updateTop();
    this.idleScene();
    if (this.run.pendingFight) return this.startFight(this.run.pendingFight);
    if (this.run.pendingNode) return this.resumeNode(this.run.pendingNode);
    this.toMap();
  }
  abandon() { store.del(SAVE); this.endBattle(); this.run = null; $('#top').hidden = true; this.idleScene(true); this.screens.title(false); }
  toMap() {
    this.run.pendingNode = null; this.save();
    this.updateTop();
    this.idleScene();
    this.screens.map(false);
    if (!this.prefs.coach.map) { this.prefs.coach.map = 1; this.savePrefs(); setTimeout(() => this.toast('Tap a glowing spot to dig your way down to it.'), 600); }
  }
  peekMap() { if (!this.run) return; this.mapPeekReturn = this.screens.open ? [...this.screens.root.childNodes] : null; this.screens.map(true); }
  closeMapPeek() {
    if (this.mapPeekReturn) { this.screens.root.innerHTML = ''; for (const n of this.mapPeekReturn) this.screens.root.append(n); this.mapPeekReturn = null; cancelAnimationFrame(this.screens.mapRaf); }
    else this.screens.hide();
    if (!this.bv && !this.mapPeekReturn && !this.screens.open) this.toMap();
  }
  // your whole deck, over whatever page or fight is showing (D opens and closes it)
  peekDeck() {
    if (!this.run) return;
    if (this.screens.open && this.screens.root.querySelector('.browser')) { this.closePeek(); return; }
    this.peekBack = this.screens.open ? [...this.screens.root.childNodes] : null;
    this.screens.deckView(() => this.closePeek());
  }
  closePeek() {
    const back = this.peekBack; this.peekBack = null;
    if (back) { this.screens.root.innerHTML = ''; for (const n of back) this.screens.root.append(n); } else this.screens.hide();
  }
  // the shared deck or the discard pile, mid-fight
  peekPile(which) {
    const b = this.battle; if (!b) return;
    this.peekBack = null;
    if (which === 'deck') this.screens.cardBrowser({ title: 'The shared deck', note: 'You and the demons draw from it; its order stays hidden.', cards: b.deck, close: () => this.closePeek() });
    else this.screens.cardBrowser({ title: 'The discard pile', note: b.banished.length ? `${b.banished.length} more banished.` : 'Shuffled back into the deck when it runs out.', cards: b.discard.slice().reverse(), keepOrder: true, orderName: 'Newest', close: () => this.closePeek() });
  }
  enterNode(n) {
    const run = this.run;
    run.moveTo(n);
    if (n.type === 'event' && run.charms.includes('pilgrimStaff')) run.heal(8);
    const node = { type: n.type };
    if (n.type === 'shop') node.stock = run.shopStock();
    if (n.type === 'event') node.event = pickEvent(run).id;
    if (n.type === 'treasure') node.charm = run.randomCharm();
    run.pendingNode = node;
    this.save();
    this.updateTop();
    this.stage.setCircle(run.circle); this.sound.setDrone(run.circle);
    this.resumeNode(node);
  }
  resumeNode(node) {
    const run = this.run, done = () => { this.run.pendingNode = null; this.toMap(); };
    if (['fight', 'elite', 'boss'].includes(node.type)) { const enc = node.enc ?? run.encounter(node.type); node.enc = enc; this.save(); return this.startFight(enc); }
    if (node.type === 'rest') return this.screens.rest(done);
    if (node.type === 'shop') return this.screens.shop(node.stock, () => { this.save(); done(); });
    if (node.type === 'treasure') return this.screens.treasure(node.charm, done);
    if (node.type === 'event') { import('./events.js').then(({ EVENTS }) => this.screens.event(EVENTS.find(e => e.id === node.event), done)); return; }
    done();
  }

  /* ---------- a fight ---------- */
  async startFight(enc) {
    const run = this.run;
    run.pendingFight = enc; this.save();
    this.screens.hide();
    this.stage.setCircle(run.circle); this.sound.setDrone(run.circle);
    const seed = (run.seed ^ (run.floor * 7919) ^ (enc.fromEvent ? 31337 : 0)) >>> 0;
    const b = this.battle = new Battle({ run, enemies: enc.enemies, kind: enc.kind, seed });
    const bv = this.bv = new BattleView(this, b, { auto: q.has('auto') ? new Bot() : null });
    b.view = bv; b.io = bv;
    this.resize();
    this.updateTop();
    this.coachFight(b, bv);
    const result = await b.start();
    run.stats.scorched += b.stats.scorched; run.stats.offered += b.stats.offered; run.stats.dmgTaken += b.stats.dmgTaken;
    if (result !== 'win') { this.gameOver(false); return; }
    run.stats.fights++; if (enc.kind === 'elite') run.stats.elites++;
    for (const id of run.charms) CHARMS[id].fightEnd?.(run, b);
    run.pendingFight = null;
    this.endBattle();
    this.updateTop();
    if (enc.kind === 'boss' && run.act === 2) { store.del(SAVE); this.sound.victory(); this.screens.end(true); return; }
    const rw = run.rewards(enc.kind);
    if (enc.fromEvent && !rw.charm) rw.charm = run.randomCharm();
    run.pendingNode = { type: 'reward' }; this.save();
    this.sound.victory();
    this.screens.rewards(rw, enc.kind, () => {
      if (enc.kind === 'boss') {
        const next = () => { run.heal(Math.round((run.maxHp - run.hp) * .75)); run.nextAct(); this.save(); this.descend(); };
        if (rw.bossCharms?.length) this.screens.bossCharms(rw.bossCharms, next); else next();
      } else this.toMap();
    });
  }
  endBattle() { this.bv?.dispose(); this.bv = null; this.battle = null; this.resize(); }
  // between acts: a dive down through the rock to the next circle
  descend() {
    const s = el('div', 'scr');
    const ci = this.run.circle;
    s.innerHTML = `<div style="margin-top:20vh"></div><h2>Deeper</h2><h1>Circle ${ROMAN[ci]}</h1><p class="lede">${CIRCLES[ci].name}, where ${CIRCLES[ci].sin.replace(/^the /, 'the ')} are kept.</p>`;
    const b = el('button', 'btn gold', 'Go down'); b.onclick = () => this.toMap(); s.append(b);
    s.classList.add('veil');
    this.idleScene();
    this.screens.show(s, { dim: false });
  }
  gameOver(win) {
    store.del(SAVE);
    this.endBattle();
    this.idleScene();
    if (!win) this.angelFig.alpha = .35;
    this.screens.end(win);
  }

  /* ---------- a few words for a first fight ---------- */
  coachFight(b, bv) {
    if (this.prefs.coach.done || bv.auto || q.has('demo')) return;
    const steps = [
      ['draw', () => b.round === 1, 'The demons draw <em>first</em>, from the same deck as you. Each holds its card <em>upside down</em> over its head: that is what it will do when your turn ends. Hover or tap it to read it.'],
      ['play', () => true, 'Your turn. <em>Drag</em> a card up to play it, or <em>tap</em> it and then tap a demon. Each card costs <em>Grace</em> (the blue orb).'],
      ['holy', () => b.hand.some(c => c.id === 'holyWater' || c.id === 'offering'), '<em>Holy Water</em> burns any demon that draws it. <em>Offering</em> puts a card from your hand on top of the deck, so the next demon draws it. Try feeding them Holy Water.'],
      ['end', () => b.turn >= 1, 'When you\'re done, press <em>End Turn</em> (or E). Cards left in your hand go to the discard pile, which the demons also draw from when the deck is reshuffled.'],
    ];
    const show = (key, html) => {
      if (this.prefs.coach[key]) return;
      this.prefs.coach[key] = 1; this.savePrefs();
      $('.coach')?.remove();
      const c = el('div', 'coach', `<span class="tag">HOW IT WORKS</span>${html}<div><button class="ok">Got it</button><button class="skip">Skip tips</button></div>`);
      c.style.left = '50%'; c.style.transform = 'translateX(-50%)'; c.style.top = innerWidth / innerHeight < .9 ? '58%' : '64px';
      document.body.append(c);
      c.querySelector('.ok').onclick = () => c.remove();
      c.querySelector('.skip').onclick = () => { this.prefs.coach.done = 1; this.savePrefs(); c.remove(); };
    };
    const origEv = bv.ev.bind(bv);
    bv.ev = async (type, d, bb) => {
      const r = await origEv(type, d, bb);
      if (this.prefs.coach.done) return r;
      if (type === 'demonDraw' && b.round === 1 && !this.prefs.coach.draw) { show('draw', steps[0][2]); await new Promise(res => { const t = setInterval(() => { if (!$('.coach')) { clearInterval(t); res(); } }, 100); }); }
      return r;
    };
    this.onTurnStart = bvv => {
      if (this.prefs.coach.done) return;
      if (!this.prefs.coach.play) show('play', steps[1][2]);
      else if (!this.prefs.coach.holy && steps[2][1]()) show('holy', steps[2][2]);
    };
    this.onPlayed = () => {
      if (this.prefs.coach.done) return;
      if (this.prefs.coach.play && !this.prefs.coach.end && b.grace === 0) show('end', steps[3][2]);
    };
  }

  /* ---------- ?demo: straight into a fight, for the preview ---------- */
  demo() {
    const run = this.run = new Run(4242);
    run.act = 1; run.map = run.makeMap();
    run.pos = { row: 6, col: 3 };
    run.addCharm('thurible'); run.addCharm('eye'); run.addCharm('lambWool');
    for (const id of ['searingLight', 'rebuke', 'consecrate', 'pillarFire', 'redemption']) run.deck.push({ uid: 9000 + run.deck.length, id, plus: id === 'pillarFire' });
    if (q.has('deck')) run.deck = q.get('deck').split(',').map((id, i) => ({ uid: 9100 + i, id, plus: false }));
    if (q.has('circle')) { const c = +q.get('circle'); run.act = Math.floor(c / 3); run.pos = { row: (c % 3) * 3, col: 3 }; }
    run.hp = 58;
    this.updateTop();
    const enc = { enemies: (q.get('enemies') ?? 'imp,heretic,cleric').split(','), kind: q.get('kind') ?? 'fight' };
    if (q.has('hp')) run.hp = +q.get('hp');
    this.startFight(enc);
  }
}

const app = new App();
await Promise.all([document.fonts.load('400 20px "IM Fell English SC"'), document.fonts.load('400 20px "IM Fell English"'), document.fonts.load('italic 400 20px "IM Fell English"'), document.fonts.load('600 20px "Alegreya Sans"'), document.fonts.load('800 20px "Alegreya Sans"')]).catch(() => {});
app.start();
app.boot();
window.app = app;
