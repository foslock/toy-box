// Looking closely at a card: the card itself, large, which turns round when you tap it (so the demon's half reads
// the right way up), and beside it both readings written out the right way up, so nobody has to read upside down.
// Opened from any list of cards (the deck, the piles, rewards, the Ferryman) or from a card in a fight, and steps
// through the list with the arrows, arrow keys or a swipe.
import { def, uprightText, reversedText } from './cards.js';
import { paintFace } from './face.js';
import { $, el, img, richHTML, keywordsIn, tipHTML } from './hud.js';

let open = null;
export const inspecting = () => !!open;
export const defaults = { sfx: null };   // the app's sounds, set once

// cards: the list to step through; i: where to start. o.turned: start turned round; o.text(card) → { up, down }
// with the numbers as they'd really come out; o.note(card) → a line about this card here; o.sfx: the sounds
export function inspect(cards, i = 0, o = {}) {
  close();
  o = { sfx: defaults.sfx, ...o };
  const root = el('div', 'inspect');
  root.id = 'inspect';
  root.innerHTML = `<div class="insp" role="dialog" aria-label="Card">
    <div class="insp-card"><div class="insp-face"></div><div class="insp-cap"></div></div>
    <div class="insp-read"></div>
    <div class="insp-nav">
      <button class="btn ghost insp-prev" aria-label="Previous card">‹</button>
      <span class="insp-n"></span>
      <button class="btn ghost insp-next" aria-label="Next card">›</button>
      <span class="insp-gap"></span>
      <button class="btn ghost insp-turn">Turn it round</button>
      <button class="btn gold insp-close">Close</button>
    </div></div>`;
  document.body.append(root);
  const st = open = { root, cards, i, turned: !!o.turned, o };
  const face = $('.insp-face', root), read = $('.insp-read', root), cap = $('.insp-cap', root);
  const many = cards.length > 1;
  $('.insp-prev', root).hidden = $('.insp-next', root).hidden = $('.insp-n', root).hidden = !many;
  const show = () => {
    const card = cards[st.i], d = def(card);
    const t = o.text?.(card) ?? { up: uprightText(card), down: reversedText(card) };
    face.innerHTML = '';
    const c = paintFace(card, {}), cv = document.createElement('canvas');
    cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0);
    face.append(cv);
    face.classList.toggle('turned', st.turned);
    const keys = keywordsIn(t.up + ' ' + t.down);
    if (d.holy && !keys.includes('Holy')) keys.unshift('Holy');
    if (d.rarity === 'infernal') keys.push('Infernal');
    if (d.type === 'curse') keys.push('Curse');
    if (d.type === 'power') keys.push('Power');
    const cost = d.unplayable ? 'Unplayable' : d.cost < 0 ? 'X Grace' : `${d.cost} Grace`;
    const kind = (d.holy ? 'Holy ' : '') + ({ attack: 'Attack', skill: 'Skill', power: 'Power', curse: 'Curse', status: 'Status' }[d.type] ?? '');
    read.innerHTML = `
      <div class="reading up${st.turned ? '' : ' on'}"><div class="rh">${img('sun', 'gold')}<span>Your reading</span><i>${kind} · ${cost}</i></div><b class="rt">${d.title}</b><div class="rx">${richHTML(t.up || 'Nothing.')}</div></div>
      <div class="reading down${st.turned ? ' on' : ''}"><div class="rh">${img('horned', 'red')}<span>If a demon draws it</span></div><b class="rt">${d.rtitle}</b><div class="rx">${richHTML(t.down || 'Nothing happens.')}</div></div>
      ${o.note?.(card) ? `<div class="rnote">${o.note(card)}</div>` : ''}
      <div class="rkeys">${tipHTML(keys)}<div class="kw dim">Fallen demons read your side instead; the Devil reads whichever side hurts you more.</div></div>`;
    cap.textContent = st.turned ? 'The demon\'s side · tap to turn back' : 'Tap the card to turn it round';
    $('.insp-n', root).textContent = `${st.i + 1} / ${cards.length}`;
    $('.insp-turn', root).textContent = st.turned ? 'Your side' : 'The demon\'s side';
  };
  const turn = () => { st.turned = !st.turned; face.classList.toggle('turned', st.turned); o.sfx?.flip?.(); show(); };
  const step = k => { if (!many) return; st.i = (st.i + k + cards.length) % cards.length; o.sfx?.tick?.(); show(); face.animate([{ transform: `${st.turned ? 'rotate(180deg) ' : ''}translateX(${k * 40}px)`, opacity: .2 }, { transform: st.turned ? 'rotate(180deg)' : 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' }); };
  face.onclick = turn;
  $('.insp-turn', root).onclick = turn;
  $('.insp-prev', root).onclick = () => step(-1);
  $('.insp-next', root).onclick = () => step(1);
  $('.insp-close', root).onclick = close;
  root.addEventListener('click', e => { if (e.target === root) close(); });
  // swipe between cards
  let sx = null;
  root.addEventListener('pointerdown', e => { sx = [e.clientX, e.clientY]; });
  root.addEventListener('pointerup', e => { if (!sx) return; const dx = e.clientX - sx[0], dy = e.clientY - sx[1]; sx = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1); });
  st.key = e => {
    const k = e.key;
    if (k === 'Escape' || k === 'i' || k === 'I') close();
    else if (k === 'ArrowRight') step(1);
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'r' || k === 'R' || k === ' ' || k === 'Enter' || k === 't' || k === 'T') turn();
    else if (k !== 'Tab') return;
    e.preventDefault(); e.stopImmediatePropagation();
  };
  addEventListener('keydown', st.key, true);
  show();
  requestAnimationFrame(() => root.classList.add('on'));
  o.sfx?.page?.();
}
export function close() {
  if (!open) return;
  const st = open; open = null;
  removeEventListener('keydown', st.key, true);
  st.root.classList.remove('on');
  setTimeout(() => st.root.remove(), 180);
  st.o.onClose?.();
}
