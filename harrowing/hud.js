// The page's own layer over the 3D scene: nameplates and health under each figure, what each demon is about to do,
// floating numbers, the turn banner, tooltips, and the little icons all of these use (drawn from the same emblems as
// the cards).
import { drawGlyph } from './art.js';
import { KEYWORDS } from './cards.js';
import { TRAITS } from './enemies.js';

export const $ = (s, el = document) => el.querySelector(s);
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- icons: emblems drawn small, as image URLs ---------- */
const ICON_CACHE = new Map();
const ICON_COLORS = {
  gold: { body: '#fff6d8', body2: '#f0b93a', outline: '#6a4206', accent: '#ffffff', detail: '#7a4e0a', hole: '#5a3604' },
  red: { body: '#ffb59a', body2: '#e2401c', outline: '#3a0604', accent: '#ffe0a0', detail: '#4a0806', hole: '#3a0604' },
  blue: { body: '#e8f6ff', body2: '#6fb4ea', outline: '#123a5e', accent: '#ffffff', detail: '#1a4a74', hole: '#0e2a44' },
  green: { body: '#e6ffe0', body2: '#5ccf6a', outline: '#0e3a14', accent: '#ffffff', detail: '#16481c', hole: '#0e3a14' },
  violet: { body: '#f0e4ff', body2: '#a07ae0', outline: '#2a1450', accent: '#ffffff', detail: '#341a60', hole: '#2a1450' },
  grey: { body: '#f2f0ec', body2: '#a8a29a', outline: '#2a2826', accent: '#ffffff', detail: '#3a3836', hole: '#2a2826' },
};
export function icon(glyph, color = 'gold', size = 64) {
  const key = glyph + color + size;
  let u = ICON_CACHE.get(key);
  if (!u) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    drawGlyph(g, glyph, size * .06, size * .06, size * .88, { ...ICON_COLORS[color], glow: 'rgba(0,0,0,.6)', glowBlur: 3 });
    u = c.toDataURL();
    ICON_CACHE.set(key, u);
  }
  return u;
}
export const img = (glyph, color, cls = 'ic') => `<img class="${cls}" src="${icon(glyph, color)}" alt="">`;

export const STATUS = {
  might: { glyph: 'crown', color: 'red', name: 'Might' },
  faith: { glyph: 'star', color: 'blue', name: 'Faith' },
  burn: { glyph: 'flame', color: 'red', name: 'Burn' },
  exposed: { glyph: 'brokenBlade', color: 'violet', name: 'Exposed' },
  shaken: { glyph: 'question', color: 'grey', name: 'Shaken' },
  thorns: { glyph: 'thornCrown', color: 'green', name: 'Thorns' },
};
export const POWER_ICON = { haloFlame: 'halo', bell: 'bell', prophecy: 'eyeStar', sanctuary: 'temple', martyrdom: 'heartRays', seraph: 'sixWings', covenant: 'rainbow', choir: 'choir' };

/* ---------- rich text for the page: the cards' [n] and *Keyword* markup as HTML ---------- */
export function richHTML(text) {
  return text.replace(/\[(\d+)([+-]?)\]/g, (_, n, m) => `<b class="${m === '+' ? 'up' : m === '-' ? 'down' : ''}">${n}</b>`).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
export function keywordsIn(text) {
  const out = [];
  for (const m of text.matchAll(/\*([^*]+)\*/g)) { const k = m[1]; if (KEYWORDS[k] && !out.includes(k)) out.push(k); }
  return out;
}

/* ---------- floating numbers and words ---------- */
export function floater(layer, x, y, text, cls = '') {
  const f = el('div', 'floater ' + cls, text);
  f.style.left = x + 'px'; f.style.top = y + 'px';
  f.style.setProperty('--dx', ((Math.random() - .5) * 60).toFixed(0) + 'px');
  layer.append(f);
  setTimeout(() => f.remove(), 1600);
}

/* ---------- a nameplate under a figure ---------- */
export class Plate {
  constructor(layer, who, o = {}) {
    this.who = who;
    this.el = el('div', 'plate' + (o.angel ? ' angel' : ''));
    this.el.innerHTML = `<div class="pname"></div><div class="bar"><div class="lag"></div><div class="fill"></div><span class="hp"></span><span class="ward"></span></div><div class="sts"></div>`;
    layer.append(this.el);
    this.nameEl = $('.pname', this.el); this.fill = $('.fill', this.el); this.lag = $('.lag', this.el); this.hpEl = $('.hp', this.el); this.wardEl = $('.ward', this.el); this.sts = $('.sts', this.el);
    this.last = {};
    if (!o.angel) {
      const tr = who.traits?.map(t => TRAITS[t.id]?.name).filter(Boolean) ?? [];
      this.nameEl.innerHTML = `${who.name}${who.def?.draws > 1 ? ` <span class="draws" title="Draws ${who.def.draws} cards each round">${'▮'.repeat(who.def.draws)}</span>` : ''}${tr.length ? `<span class="traits">${tr.join(' · ')}</span>` : ''}`;
    } else this.nameEl.textContent = '';
  }
  update(x, y, extra = {}) {
    const w = this.who;
    this.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, 0)`;
    const hp = Math.max(0, w.hp), pct = Math.max(0, Math.min(1, hp / w.maxHp));
    if (this.last.hp !== hp || this.last.max !== w.maxHp) {
      this.fill.style.width = (pct * 100).toFixed(1) + '%';
      setTimeout(() => { this.lag.style.width = (pct * 100).toFixed(1) + '%'; }, 350);
      this.hpEl.textContent = `${hp}/${w.maxHp}`;
      this.last.hp = hp; this.last.max = w.maxHp;
    }
    if (this.last.ward !== w.ward) {
      this.wardEl.innerHTML = w.ward > 0 ? `${img('shield', 'blue', 'ic')}<b>${w.ward}</b>` : '';
      this.el.classList.toggle('warded', w.ward > 0);
      this.last.ward = w.ward;
    }
    const key = JSON.stringify([w.st, extra.powers ?? null]);
    if (this.last.st !== key) {
      this.last.st = key;
      let h = '';
      for (const [k, s] of Object.entries(STATUS)) if (w.st[k] > 0) h += `<span class="st" data-tip="${k}">${img(s.glyph, s.color)}<b>${w.st[k]}</b></span>`;
      for (const [k, n] of Object.entries(extra.powers ?? {})) h += `<span class="st pw" data-tip="power:${k}">${img(POWER_ICON[k] ?? 'star', 'gold')}<b>${n > 1 ? n : ''}</b></span>`;
      this.sts.innerHTML = h;
    }
  }
  remove() { this.el.classList.add('gone'); setTimeout(() => this.el.remove(), 600); }
}

/* ---------- the turn banner ---------- */
export function banner(text, sub = '', cls = '') {
  const b = $('#banner');
  b.className = 'show ' + cls;
  b.innerHTML = `<div class="bt">${text}</div>${sub ? `<div class="bs">${sub}</div>` : ''}`;
  clearTimeout(banner.t);
  banner.t = setTimeout(() => { b.className = 'hide ' + cls; }, 1050);
}

/* ---------- tooltips ---------- */
export function tipHTML(keys) {
  return keys.map(k => `<div class="kw"><b>${k}</b> ${KEYWORDS[k] ?? ''}</div>`).join('');
}
