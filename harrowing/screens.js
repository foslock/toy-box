// Everything between fights, as pages over the scene: the title, the blessing at the gate, the map, rewards, the
// Ferryman's shop, Sanctuaries, lost souls, reliquaries, your deck, and the end of the descent either way.
import { CARDS, def, makeCard, uprightText, reversedText, KEYWORDS } from './cards.js';
import { CHARMS } from './charms.js';
import { CIRCLES, ACTS } from './enemies.js';
import { BLESSINGS, blessingChoices, NODE, ROWS } from './run.js';
import { paintFace, CW, CH } from './face.js';
import { drawGlyph } from './art.js';
import { MapView, NODE_GLYPH } from './map.js';
import { $, el, img, icon, richHTML, keywordsIn } from './hud.js';
import { canvas, rad, lin } from './paint.js';
import { inspect } from './inspect.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];

// a card on the page: a copy of its painted face that tilts toward the pointer
export function cardEl(card, o = {}) {
  const d = def(card);
  const e = el('div', 'pcard' + (d.rarity === 'rare' ? ' rare' : ''));
  e.style.setProperty('--w', (o.w ?? 160) + 'px');
  const inn = el('div', 'in');
  const c = document.createElement('canvas');
  const scale = Math.min(2, devicePixelRatio || 1);
  c.width = Math.round((o.w ?? 160) * scale); c.height = Math.round(c.width * CH / CW);
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(paintFace(card, {}), 0, 0, c.width, c.height);
  inn.append(c, el('div', 'sheen'));
  e.append(inn);
  e.addEventListener('pointermove', ev => {
    const r = e.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    e.style.setProperty('--ry', ((x - .5) * 22).toFixed(1) + 'deg'); e.style.setProperty('--rx', ((.5 - y) * 18).toFixed(1) + 'deg');
    e.style.setProperty('--mx', (x * 100).toFixed(0) + '%'); e.style.setProperty('--my', (y * 100).toFixed(0) + '%');
  });
  e.addEventListener('pointerleave', () => { e.style.setProperty('--ry', '0deg'); e.style.setProperty('--rx', '0deg'); });
  if (o.price != null) { const p = el('div', 'price' + (o.sale ? ' sale' : '') + (o.poor ? ' poor' : ''), `${img('coin', 'gold')}${o.price}`); e.append(p); }
  if (o.count > 1) e.append(el('div', 'count', '×' + o.count));
  // the demon's reading, the right way up, under the card
  if (o.caption) { e.classList.add('capd'); if (o.price != null) e.classList.add('priced'); e.append(el('div', 'cap', `${img('horned', 'red')}<b>${esc(d.rtitle)}:</b> ${richHTML(reversedText(card) || 'Nothing happens.')}`)); }
  // where clicking the card does something else, a small medallion opens it up to read both sides
  const look = () => { const list = o.list ?? [card]; inspect(list, Math.max(0, list.indexOf(card))); };
  if (o.inspectBtn !== false && o.onClick) {
    const f = el('button', 'flip', '<i></i>'); f.title = 'Read both sides'; f.setAttribute('aria-label', 'Read both sides');
    f.onclick = ev => { ev.stopPropagation(); look(); };
    e.append(f);
  }
  e.addEventListener('contextmenu', ev => { ev.preventDefault(); look(); });
  e.addEventListener('click', () => o.onClick ? o.onClick(e) : look());
  e.title = `If a demon draws it: ${reversedText(card).replace(/\[(\d+)[+-]?\]/g, '$1').replace(/\*/g, '')}`;
  return e;
}
function charmCard(id, o = {}) {
  const c = CHARMS[id];
  const e = el(o.buy ? 'button' : 'div', 'charmcard' + (o.buy ? ' buy' : ''), `${img(c.glyph, c.rarity === 'boss' ? 'red' : 'gold', '')}<div><b>${esc(c.name)}</b><span>${esc(c.text)}</span>${o.price != null ? `<div class="price${o.poor ? ' poor' : ''}" style="margin-top:6px;font:900 16px var(--B)">${img('coin', 'gold')} ${o.price}</div>` : ''}</div>`);
  if (o.buy) e.style.border = '0';
  return e;
}
// an event's picture: a little shadow theatre, the emblem cut from black paper against the glow
function artCanvas(glyph, mood = 'gold') {
  const c = canvas(560, 400), g = c.getContext('2d');
  const sky = mood === 'red' ? ['#160406', '#7a1a0e', '#ffb070'] : mood === 'blue' ? ['#06101e', '#2a4a6a', '#e4f2fa'] : ['#160c06', '#7a4416', '#ffe2a6'];
  g.fillStyle = lin(g, 0, 0, 0, 400, [[0, sky[0]], [.55, sky[1]], [.86, sky[2]], [1, sky[2]]]); g.fillRect(0, 0, 560, 400);
  g.fillStyle = rad(g, 280, 330, 10, 300, [[0, 'rgba(255,246,220,.55)'], [1, 'rgba(255,246,220,0)']]); g.fillRect(0, 0, 560, 400);
  const ridge = (y, amp, col, f) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 400); for (let x = 0; x <= 560; x += 10) g.lineTo(x, y + Math.sin(x * f) * amp + Math.sin(x * f * 2.7 + 1) * amp * .5); g.lineTo(560, 400); g.fill(); };
  ridge(300, 18, 'rgba(20,12,12,.45)', .02); ridge(338, 10, '#0d0a0b', .045);
  drawGlyph(g, glyph, 170, 96, 220, { body: '#0d0a0b', outline: '#0d0a0b', accent: '#2a1c18', detail: sky[2], hole: sky[2], glow: 'rgba(0,0,0,.35)', glowBlur: 4 });
  c.className = 'art';
  return c;
}

export class Screens {
  constructor(app) { this.app = app; this.root = $('#screen'); this.mapView = null; }
  show(node, o = {}) {
    this.root.hidden = false; this.root.className = o.dim === false ? '' : 'dim';
    this.root.innerHTML = ''; this.root.append(node); this.root.scrollTop = 0;
    this.app.sound.page();
    cancelAnimationFrame(this.mapRaf);
  }
  hide() { this.root.hidden = true; this.root.innerHTML = ''; cancelAnimationFrame(this.mapRaf); }
  get open() { return !this.root.hidden; }

  /* ---------- the title ---------- */
  title(hasSave) {
    const s = el('div', 'scr');
    s.innerHTML = `<div class="titlebox">
      <div class="inscription">LASCIATE OGNE SPERANZA, VOI CH'INTRATE<small>Abandon all hope, ye who enter here</small></div>
      <h1>HARROWING</h1>
      <p class="lede">An angel goes down into Hell, circle by circle, to the Devil at the bottom of the pit. You carry one deck — and every demon you meet draws from it too.</p>
      <div class="row" id="tb"></div>
      <button class="btn ghost glassy" id="how" style="min-height:40px">How it works</button>
    </div>`;
    const tb = $('#tb', s);
    if (hasSave) { const c = el('button', 'btn gold', 'Continue'); c.onclick = () => this.app.continueRun(); tb.append(c); }
    const n = el('button', hasSave ? 'btn ghost' : 'btn gold', hasSave ? 'New descent' : 'Descend'); n.onclick = () => this.app.newRun(); tb.append(n);
    $('#how', s).onclick = () => this.rules(() => this.title(hasSave));
    this.show(s, { dim: false });
  }
  rules(back) {
    const s = el('div', 'scr');
    s.innerHTML = `<h2>One deck, two readings</h2>
      <div class="rules">
        <div>Every card is printed like a tarot card: <b>your</b> reading upright on top, the <b>demon's</b> reading upside down at the bottom.</div>
        <div>Each round <b>the demons draw first</b>, from the same deck as you. A demon holds its card over its head, turned upside down so you can read its side: that is what it will do at the end of your turn. Then you draw five.</div>
        <div>Spend <b>Grace</b> to play cards. Kill a demon before it acts and its card falls to the discard pile. <b>Disarm</b> knocks a card out of its hand, <b>Redeem</b> takes it for yourself, <b>Rebuke</b> makes it play the card on itself.</div>
        <div><b>Holy</b> cards burn the demons who draw them. Curses are useless to you but often trouble a demon. <b>Offer</b> puts a card from your hand on top of the deck, and the next demon to draw takes it. <b>Foresee</b> shows you the top of the deck.</div>
        <div>Every card you add is a card the demons can draw. And watch out: <b>Fallen</b> angels read your cards upright, and the Devil reads them whichever way hurts you more.</div>
        <div>To read both sides of any card the right way up, <b>right-click</b> it or <b>hold</b> your finger on it (or tap its <b>◐</b>). Your whole deck is under the scroll at the top, or press <b>D</b>.</div>
        <div>Desktop: drag cards up to play, or tap a card then its target. Keys: <b>1–9</b> pick a card, <b>Enter</b> plays it, <b>Tab</b> changes target, <b>I</b> looks at it closely, <b>E</b> ends the turn.</div>
      </div>`;
    const b = el('button', 'btn gold', 'Back'); b.onclick = back; s.append(b);
    this.show(s);
  }

  /* ---------- the blessing at the gate ---------- */
  blessing() {
    const run = this.app.run;
    const s = el('div', 'scr');
    s.innerHTML = `<h2>At the Gate</h2><p class="lede">Before the gate a light finds you, the last light from above. "Take something with you," it says. "Where you are going, nothing will be given."</p><div class="col" id="bc"></div>`;
    for (const id of blessingChoices(run)) {
      const B = BLESSINGS[id];
      const c = el('button', 'choice', `${esc(B.text)}`);
      c.onclick = () => {
        if (B.apply) { B.apply(run); this.app.save(); this.app.toMap(); }
        else if (B.pick === 'rare') this.cardReward(run.cardChoices('boss', 3), () => { this.app.save(); this.app.toMap(); }, { title: 'Choose a rare card', skip: false });
        else this.deckPick(B.pick, 1, () => { this.app.save(); this.app.toMap(); }, { cancel: false });
      };
      $('#bc', s).append(c);
    }
    this.show(s);
  }

  /* ---------- the map ---------- */
  map(viewOnly = false) {
    const run = this.app.run;
    const s = el('div', 'scr');
    s.style.paddingTop = '58px';
    const wrap = el('div'); wrap.id = 'mapWrap';
    const c = document.createElement('canvas'); c.id = 'mapCanvas';
    wrap.append(c);
    const legend = el('div', 'legend', Object.entries(NODE_GLYPH).filter(([k]) => k !== 'boss').map(([k, g]) => `<span>${img(g, 'gold', '')}${NODE[k].name}</span>`).join(''));
    s.append(wrap, legend);
    if (viewOnly) { const b = el('button', 'btn ghost x', 'Close ✕'); b.onclick = () => this.app.closeMapPeek(); s.append(b); }
    this.show(s);
    const W = Math.min(760, this.root.clientWidth - 24);
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = W * dpr; c.height = Math.round(W * 1.32 + 120) * dpr;
    c.style.height = (c.height / dpr) + 'px';
    const mv = this.mapView = new MapView(c, run, { viewOnly }); mv.dpr = dpr;
    const loop = t => { mv.draw(t / 1000); this.mapRaf = requestAnimationFrame(loop); };
    this.mapRaf = requestAnimationFrame(loop);
    if (!viewOnly) c.onclick = e => {
      const r = c.getBoundingClientRect();
      const n = mv.hit(e.clientX - r.left, e.clientY - r.top);
      if (n) { this.app.sound.step(); this.app.enterNode(n); }
    };
    // scroll so the next choices are in view
    requestAnimationFrame(() => {
      const ch = run.choices()[0]; if (!ch) return;
      const p = mv.pos(ch); this.root.scrollTop = Math.max(0, p.y / dpr - this.root.clientHeight * .45);
    });
  }

  /* ---------- after a fight ---------- */
  rewards(rw, kind, done) {
    const run = this.app.run;
    const s = el('div', 'scr');
    s.innerHTML = `<h1>${kind === 'boss' ? 'The master falls' : 'Victory'}</h1><p class="lede">${kind === 'boss' ? 'The way down opens before you.' : 'The demons are ash. What do you take?'}</p><div class="col" id="rws"></div>`;
    const list = $('#rws', s);
    const items = [];
    const ob = el('button', 'reward', `${img('coin', 'gold', '')} ${rw.obols} obols`);
    ob.onclick = () => { run.obols += rw.obols; ob.classList.add('taken'); this.app.sound.coin(); this.app.updateTop(); };
    items.push(ob);
    if (rw.cards?.length) {
      const cb = el('button', 'reward', `${img('scroll', 'gold', '')} Add a card to your deck`);
      cb.onclick = () => this.cardReward(rw.cards, picked => { if (picked) rw.cardsTaken = true; this.rewards(rw, kind, done); }, { title: 'Choose a card', skip: true });
      cb.dataset.k = 'cards';
      items.push(cb);
    }
    if (rw.charm) {
      const ch = CHARMS[rw.charm];
      const cc = el('button', 'reward', `${img(ch.glyph, 'gold', '')} ${esc(ch.name)} <small style="font-weight:500;color:var(--ink2)">— ${esc(ch.text)}</small>`);
      cc.onclick = () => { run.addCharm(rw.charm); cc.classList.add('taken'); rw.charmTaken = true; this.app.sound.redeem(); this.app.updateTop(); };
      cc.dataset.k = 'charm';
      items.push(cc);
    }
    for (const it of items) list.append(it);
    if (rw.obolsTaken) ob.classList.add('taken');
    ob.addEventListener('click', () => { rw.obolsTaken = true; });
    if (rw.cardsTaken) items.find(i => i.dataset.k === 'cards')?.classList.add('taken');
    if (rw.charmTaken) items.find(i => i.dataset.k === 'charm')?.classList.add('taken');
    const go = el('button', 'btn gold', 'Continue');
    go.onclick = () => { if (!rw.obolsTaken) { run.obols += rw.obols; rw.obolsTaken = true; } this.app.updateTop(); done(); };
    s.append(go);
    this.show(s);
  }
  cardReward(cards, done, o = {}) {
    const run = this.app.run;
    const s = el('div', 'scr');
    s.innerHTML = `<h2>${o.title ?? 'Choose a card'}</h2><p>Every card you add, the demons can draw too: under each is what it does in their hands. Tap <b>◐</b> to look closer.</p><div class="cards-row" id="cr"></div>`;
    const w = Math.min(190, (Math.min(innerWidth, 900) - 60) / Math.max(3, cards.length));
    for (const c of cards) {
      const e = cardEl(c, { w, list: cards, caption: true, onClick: () => { run.addCard(c); this.app.sound.redeem(); o.after?.(c); done(c); } });
      $('#cr', s).append(e);
    }
    if (o.skip !== false) { const sk = el('button', 'btn ghost', 'Skip'); sk.onclick = () => done(null); s.append(sk); }
    this.show(s);
  }
  bossCharms(ids, done) {
    const run = this.app.run;
    const s = el('div', 'scr');
    s.innerHTML = `<h2>Spoils of the pit</h2><p class="lede">Something the master of this pit kept. Each is power, at a price.</p><div class="col" id="bc"></div>`;
    for (const id of ids) {
      const c = charmCard(id, { buy: true });
      c.onclick = () => { run.addCharm(id); this.app.sound.power(); this.app.updateTop(); done(); };
      $('#bc', s).append(c);
    }
    const sk = el('button', 'btn ghost', 'Take nothing'); sk.onclick = () => done(); s.append(sk);
    this.show(s);
  }

  /* ---------- the Ferryman ---------- */
  shop(stock, done) {
    const run = this.app.run;
    const s = el('div', 'scr');
    const draw = () => {
      s.innerHTML = `<h2>The Ferryman</h2><p class="lede">"Coin for the crossing," says Charon, and lifts the lid of a chest of things the dead left behind.</p><div class="cards-row" id="sc"></div><div class="charmrow" id="sh"></div><div class="row" id="sx"></div>`;
      const w = Math.min(160, (Math.min(innerWidth, 1000) - 70) / 5);
      for (const it of stock.cards) {
        const poor = run.obols < it.price;
        const e = cardEl(it.card, { w, price: it.price, sale: it.sale, poor, caption: true, list: stock.cards.map(x => x.card), onClick: () => {
          if (it.sold) return;
          if (run.obols < it.price) { this.app.toast('Not enough obols.'); this.app.sound.nope(); return; }
          run.obols -= it.price; run.addCard(it.card); it.sold = true; this.app.sound.coin(); this.app.updateTop(); draw();
        } });
        if (it.sold) e.classList.add('sold');
        $('#sc', s).append(e);
      }
      for (const ch of stock.charms) {
        const poor = run.obols < ch.price;
        const e = charmCard(ch.id, { buy: !ch.sold, price: ch.price, poor });
        if (ch.sold) e.style.opacity = .3;
        e.onclick = () => {
          if (ch.sold) return;
          if (run.obols < ch.price) { this.app.toast('Not enough obols.'); this.app.sound.nope(); return; }
          run.obols -= ch.price; run.addCharm(ch.id); ch.sold = true; this.app.sound.coin(); this.app.updateTop(); draw();
        };
        $('#sh', s).append(e);
      }
      const rm = el('button', 'btn ghost', stock.removed ? 'Absolution given' : `Absolution: remove a card <small>${img('coin', 'gold')}${stock.remove}</small>`);
      rm.disabled = stock.removed || run.obols < stock.remove;
      rm.onclick = () => this.deckPick('remove', 1, picked => { if (picked) { run.obols -= stock.remove; run.removeCost += 25; stock.removed = true; this.app.updateTop(); } this.shop(stock, done); }, { cancel: true });
      const leave = el('button', 'btn gold', 'Leave'); leave.onclick = done;
      $('#sx', s).append(rm, leave);
    };
    draw();
    this.show(s);
  }

  /* ---------- a Sanctuary ---------- */
  rest(done) {
    const run = this.app.run;
    const s = el('div', 'scr');
    s.append(artCanvas('sanctuary'));
    s.insertAdjacentHTML('beforeend', `<h2>A Sanctuary</h2><p class="lede">A chapel carved into the rock, older than Hell. Its candles never go out.</p><div class="col" id="rc"></div>`);
    const heal = run.restHeal();
    const r = el('button', 'choice', `Rest<small>${run.canRest() ? `Heal ${heal} HP (${run.hp}/${run.maxHp}).` : 'The Iron Crown will not let you rest.'}</small>`);
    r.disabled = !run.canRest();
    r.onclick = () => { run.heal(heal); this.app.sound.heal(); this.app.updateTop(); done(); };
    const b = el('button', 'choice', `Bless a card<small>Upgrade one card in your deck.</small>`);
    b.disabled = !run.deck.some(c => CARDS[c.id].plus && !c.plus);
    b.onclick = () => this.deckPick('bless', 1, picked => picked ? done() : this.rest(done), { cancel: true });
    $('#rc', s).append(r, b);
    this.show(s);
  }

  /* ---------- a reliquary ---------- */
  treasure(id, done) {
    const run = this.app.run;
    const s = el('div', 'scr');
    s.append(artCanvas('treasure'));
    s.insertAdjacentHTML('beforeend', `<h2>A Reliquary</h2><p class="lede">An iron box, hidden in a crack in the rock. Someone hid this from the demons.</p>`);
    if (id) {
      const c = charmCard(id); s.append(c);
      const t = el('button', 'btn gold', 'Take it'); t.onclick = () => { run.addCharm(id); this.app.sound.redeem(); this.app.updateTop(); done(); };
      s.append(t);
    } else { s.append(el('p', '', 'It is empty.')); const t = el('button', 'btn gold', 'Go on'); t.onclick = done; s.append(t); }
    this.show(s);
  }

  /* ---------- a lost soul (an event) ---------- */
  event(e, done) {
    const run = this.app.run;
    const s = el('div', 'scr');
    s.append(artCanvas(e.art, run.act === 2 ? 'blue' : 'gold'));
    s.insertAdjacentHTML('beforeend', `<h2>${esc(e.title)}</h2><p class="lede">${esc(e.text)}</p><div class="col" id="ec"></div>`);
    for (const ch of e.choices(run)) {
      const b = el('button', 'choice', `${esc(ch.label)}<small>${esc(ch.detail)}</small>`);
      b.disabled = !!ch.disabled;
      b.onclick = () => this.eventOutcome(ch.go(run), done);
      $('#ec', s).append(b);
    }
    this.show(s);
  }
  eventOutcome(out, done) {
    const run = this.app.run;
    this.app.updateTop();
    const after = () => {
      if (run.hp <= 0) return this.app.gameOver(false);
      if (out.fight) return this.app.startFight({ enemies: out.fight.enemies, kind: out.fight.kind, fromEvent: true });
      done();
    };
    const s = el('div', 'scr');
    s.insertAdjacentHTML('beforeend', `<p class="lede" style="margin-top:12vh">${esc(out.text)}</p>`);
    if (out.charm) s.append(charmCard(out.charm));
    const go = el('button', 'btn gold', 'Continue');
    go.onclick = () => {
      if (out.pick) this.deckPick(out.pick, out.n ?? 1, () => { if (out.cards) this.cardReward(out.cards, after, { title: 'Choose a card' }); else after(); }, { cancel: false });
      else if (out.cards) this.cardReward(out.cards, after, { title: 'Choose a card' });
      else after();
    };
    s.append(go);
    this.show(s);
  }

  /* ---------- your deck ---------- */
  deckView(close) {
    const run = this.app.run;
    this.cardBrowser({ title: 'Your deck', note: 'The demons draw from this deck too.', cards: run.deck, close });
  }
  // A browsable list of cards: copies stacked, sorted as you like, and a switch that turns every card round to show
  // the side the demons would play. Tapping a card opens it up large, with both readings the right way up.
  cardBrowser(o) {
    const s = el('div', 'scr browser');
    let sort = o.keepOrder ? 'order' : 'type', side = 'up';
    const TYPE = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
    const typeOf = c => { const d = def(c); return d.rarity === 'infernal' ? 5 : TYPE[d.type] ?? 6; };
    const costOf = c => { const d = def(c); return d.unplayable ? 99 : d.cost < 0 ? 50 : d.cost; };
    const draw = () => {
      // stack copies of the same card (unless the order matters)
      let items = [];
      if (sort === 'order') items = o.cards.map(c => ({ card: c, n: 1 }));
      else { const m = new Map(); for (const c of o.cards) { const k = c.id + (c.plus ? '+' : ''); if (m.has(k)) m.get(k).n++; else m.set(k, { card: c, n: 1 }); } items = [...m.values()]; }
      const by = { type: (a, b) => typeOf(a.card) - typeOf(b.card) || def(a.card).title.localeCompare(def(b.card).title), cost: (a, b) => costOf(a.card) - costOf(b.card) || typeOf(a.card) - typeOf(b.card) || def(a.card).title.localeCompare(def(b.card).title), name: (a, b) => def(a.card).title.localeCompare(def(b.card).title) };
      if (by[sort]) items.sort(by[sort]);
      const tally = {}; for (const c of o.cards) { const d = def(c), k = d.rarity === 'infernal' ? 'Infernal' : { attack: 'Attack', skill: 'Skill', power: 'Power', curse: 'Curse', status: 'Status' }[d.type]; tally[k] = (tally[k] ?? 0) + 1; }
      const tl = Object.entries(tally).map(([k, n]) => `${n} ${k}${n > 1 ? (k === 'Status' ? 'es' : k === 'Infernal' ? '' : 's') : ''}`).join(' · ');
      const sorts = (o.keepOrder ? [['order', o.orderName ?? 'Order']] : []).concat([['type', 'Type'], ['cost', 'Cost'], ['name', 'Name']]);
      s.innerHTML = `<h2>${o.title} <small style="font:600 16px var(--B);color:var(--ink3)">${o.cards.length} card${o.cards.length === 1 ? '' : 's'}</small></h2>
        <p class="tally">${tl || 'Empty.'}${o.note ? ` <span style="color:var(--ink3)">${o.note}</span>` : ''}</p>
        <div class="tools">
          <div class="seg" id="sortSeg"><span>Sort</span>${sorts.map(([k, n]) => `<button data-k="${k}" class="${sort === k ? 'on' : ''}">${n}</button>`).join('')}</div>
          <div class="seg" id="sideSeg"><span>Show</span><button data-k="up" class="${side === 'up' ? 'on' : ''}">${img('sun', 'gold')} Your side</button><button data-k="down" class="${side === 'down' ? 'on' : ''}">${img('horned', 'red')} The demons'</button></div>
        </div>
        <p class="hint">Tap a card to read both sides, large.</p>
        <div class="deckgrid" id="dg"></div>`;
      const w = innerWidth < 600 ? 104 : 140;
      $('#dg', s).style.setProperty('--w', w + 'px');
      const list = items.map(it => it.card);
      items.forEach((it, i) => {
        const e = cardEl(it.card, { w, count: it.n, list, inspectBtn: false, onClick: () => inspect(list, i, { turned: side === 'down' }) });
        e.style.setProperty('--d', Math.min(i * 18, 400) + 'ms');
        if (side === 'down') e.classList.add('turned');
        $('#dg', s).append(e);
      });
      for (const b of $('#sortSeg', s).querySelectorAll('button')) b.onclick = () => { sort = b.dataset.k; this.app.sound.click?.(); draw(); };
      for (const b of $('#sideSeg', s).querySelectorAll('button')) b.onclick = () => {
        if (side === b.dataset.k) return;
        side = b.dataset.k; this.app.sound.flip?.();
        for (const x of $('#sideSeg', s).querySelectorAll('button')) x.classList.toggle('on', x.dataset.k === side);
        for (const c of $('#dg', s).children) c.classList.toggle('turned', side === 'down');
      };
      const x = el('button', 'btn ghost x', 'Close ✕'); x.onclick = o.close; s.append(x);
    };
    draw();
    this.show(s);
  }
  // pick n cards from the deck to remove, bless, transform or copy
  deckPick(mode, n, done, o = {}) {
    const run = this.app.run;
    const verbs = { remove: 'Remove', bless: 'Bless', transform: 'Transform', copy: 'Copy' };
    let left = n;
    const s = el('div', 'scr');
    const draw = () => {
      s.innerHTML = `<h2>${verbs[mode]} ${left > 1 ? left + ' cards' : 'a card'}</h2><p>${mode === 'bless' ? 'A Blessed card is stronger. Tap to Bless it.' : mode === 'remove' ? 'Tap a card to remove it from your deck for good.' : mode === 'transform' ? 'Tap a card to turn it into a random card of the same rarity.' : 'Tap a card to add a copy of it.'}</p><div class="deckgrid" id="dg"></div>`;
      const w = innerWidth < 600 ? 104 : 140;
      $('#dg', s).style.setProperty('--w', w + 'px');
      let options = run.deck.slice();
      if (mode === 'bless') options = options.filter(c => CARDS[c.id].plus && !c.plus);
      if (mode === 'transform' || mode === 'copy') options = options.filter(c => CARDS[c.id].type !== 'curse' || mode === 'transform');
      for (const c of options) {
        const shown = mode === 'bless' ? { ...c, plus: true } : c;
        const e = cardEl(shown, { w, list: options.map(x => mode === 'bless' ? { ...x, plus: true } : x), onClick: () => {
          if (mode === 'remove') run.removeCard(c);
          else if (mode === 'bless') run.bless(c);
          else if (mode === 'transform') run.transform(c);
          else if (mode === 'copy') run.addCard(makeCard(c.id, c.plus));
          this.app.sound[mode === 'bless' ? 'heal' : mode === 'remove' ? 'burn' : 'redeem']();
          left--;
          this.app.updateTop();
          if (left <= 0 || !run.deck.length) done(true); else draw();
        } });
        $('#dg', s).append(e);
      }
      if (!options.length) { s.append(el('p', '', 'Nothing to choose.')); const b = el('button', 'btn gold', 'Go on'); b.onclick = () => done(false); s.append(b); }
      if (o.cancel) { const b = el('button', 'btn ghost', 'Cancel'); b.onclick = () => done(false); s.append(b); }
    };
    draw();
    this.show(s);
  }
  // choose one card from a list (the discard pile, for Divine Order)
  pickFromList(cards, prompt, cb) {
    const s = el('div', 'scr');
    s.innerHTML = `<h2>Choose a card</h2><p>${richHTML(prompt)}</p><div class="deckgrid" id="dg"></div>`;
    const w = innerWidth < 600 ? 104 : 130;
    $('#dg', s).style.setProperty('--w', w + 'px');
    for (const c of cards) $('#dg', s).append(cardEl(c, { w, list: cards, onClick: () => { this.hide(); cb(c); } }));
    this.show(s);
  }

  /* ---------- the end ---------- */
  end(win, stats) {
    const run = this.app.run;
    const s = el('div', 'scr');
    const ci = run.circle, C = CIRCLES[ci];
    s.innerHTML = win
      ? `<div style="margin-top:6vh"></div><h1>To see the stars</h1><p class="lede">The Devil is broken in his ice. You climb past him, out of the pit and up through the far side of the world, and come out under the open sky — and thence you come forth, to see again the stars.</p>`
      : `<div style="margin-top:6vh"></div><h1>Your light goes out</h1><p class="lede">In the ${ORDINAL[ci]} circle, among ${C.sin}, the angel falls. The demons shuffle your cards back into the dark.</p>`;
    const st = el('div', 'stats', [
      ['Reached', `Circle ${ROMAN[ci]}, ${C.name}`],
      ['Floors dug', run.floor],
      ['Demons fought', run.stats.fights],
      ['Times demons were Scorched', run.stats.scorched],
      ['Cards Offered', run.stats.offered],
      ['Deck', run.deck.length + ' cards'],
      ['Charms', run.charms.length],
    ].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join(''));
    s.append(st);
    const again = el('button', 'btn gold', 'Descend again'); again.onclick = () => this.app.newRun();
    s.append(again);
    this.show(s);
  }
  menu() {
    if ($('.menu')) { $('.menu').remove(); return; }
    const app = this.app;
    const m = el('div', 'menu');
    const snd = el('button', 'btn ghost', `Sound: ${app.sound.enabled ? 'on' : 'off'}`);
    snd.onclick = () => { app.sound.set(!app.sound.enabled); snd.textContent = `Sound: ${app.sound.enabled ? 'on' : 'off'}`; app.prefs.sound = app.sound.enabled; app.savePrefs(); if (app.sound.enabled) app.sound.setDrone(app.run?.circle ?? 0); };
    const spd = el('button', 'btn ghost', `Speed: ${app.speed}×`);
    spd.onclick = () => { app.speed = app.speed === 1 ? 1.6 : app.speed === 1.6 ? 2.4 : 1; spd.textContent = `Speed: ${app.speed}×`; app.prefs.speed = app.speed; app.savePrefs(); };
    const how = el('button', 'btn ghost', 'How it works'); how.onclick = () => { m.remove(); const was = this.open; const saved = this.root.firstChild; this.rules(() => { if (was && saved) { this.root.innerHTML = ''; this.root.append(saved); } else this.hide(); }); };
    const ab = el('button', 'btn ghost', 'Abandon this descent'); ab.onclick = () => { m.remove(); if (confirm('Abandon this descent? Your progress will be lost.')) app.abandon(); };
    m.append(snd, spd, how, ab);
    document.body.append(m);
    setTimeout(() => addEventListener('pointerdown', function close(e) { if (!m.contains(e.target) && e.target.id !== 'menuBtn') { m.remove(); removeEventListener('pointerdown', close); } }), 0);
  }
}
