// Moonrise Manor: screens, input, lessons. The rules live in rules.js.
import * as R from './rules.js';
import * as A from './art.js';
import { Sound } from './sound.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo'), DEBUG = params.has('debug');
const $ = s => document.querySelector(s);
const B = document.body;
const snd = new Sound();
const { YOU, ROOMS, G, RI } = R;
const SEATS = ['colonel', 'reverend', 'doctor', 'ada', YOU, 'ida', 'cook', 'widow', 'poet'];
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

let g = null;
const ui = { phase: 'title', sel: {}, queue: [], done: null, lesson: false, step: null, only: {}, lastAdv: 0 };
const nameOf = id => id === YOU ? 'You' : R.nameOf(id);
const roomName = i => ROOMS[i].name;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const listOf = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

// ------------------------------------------------------------------ build the wall of portraits
document.body.insertAdjacentHTML('afterbegin', A.DEFS);
const wall = $('#wall');
for (const id of SEATS) {
  const b = document.createElement('button');
  b.className = 'pp' + (id === YOU ? ' you' : '');
  b.dataset.id = id;
  b.setAttribute('aria-label', R.nameOf(id));
  b.innerHTML = A.portraitSVG(id, 0) +
    `<svg class="crepe" viewBox="0 0 100 124" preserveAspectRatio="xMidYMid meet"><path d="M 52 2 L 74 2 L 98 40 L 98 62 Z" fill="#0a0706"/><path d="M 63 2 L 98 51" stroke="#3a2a22" stroke-width="1.2"/></svg>` +
    `<span class="stamp">Ice House</span><span class="flash"></span><span class="votes"></span><span class="pips"></span>` +
    `<span class="nm">${id === YOU ? 'You' : esc(R.shortOf(id).replace(/^the /, ''))}</span>`;
  b.addEventListener('click', () => portraitTap(id));
  wall.appendChild(b);
}
const pp = id => wall.querySelector(`.pp[data-id="${id}"]`);
$('#mapBox').innerHTML = A.planSVG();
const plan = $('#mapBox .plan');
plan.addEventListener('click', e => {
  const t = e.target.closest('.tok'), r = e.target.closest('.room');
  if (t) return mapTap({ token: t.dataset.id, room: roomAt(e) });
  if (r) return mapTap({ room: +r.dataset.room });
});
// the token layer sits above the rooms, so find the room under a token tap by position
function roomAt(evt) {
  const pt = plan.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
  const p = pt.matrixTransform(plan.getScreenCTM().inverse());
  const c = Math.floor((p.x - A.PAD) / A.CELL), r = Math.floor((p.y - A.PAD) / A.CELL);
  return c >= 0 && c < 3 && r >= 0 && r < 3 ? r * 3 + c : null;
}

function refreshWall() {
  if (!g) return;
  const nightTime = B.classList.contains('night');
  for (const id of SEATS) {
    const el = pp(id);
    const fate = id === YOU ? null : g.fate[id];
    el.classList.toggle('dead', fate?.kind === 'killed');
    el.classList.toggle('gone', fate?.kind === 'exiled');
    el.querySelector('.stamp').textContent = fate?.kind === 'exiled' ? 'Ice House' : '';
    const alive = id === YOU || g.alive.includes(id);
    let mood = 0, glow = false;
    if (id === YOU) glow = nightTime;
    else if (alive && !nightTime && g.n >= 1 && ui.phase !== 'dawn') mood = R.moodToward(g, id);
    const eye = el.querySelector('.eye');
    if (eye && eye.dataset.m !== `${mood}${glow}`) { eye.innerHTML = A.eyeOnly(id, mood, glow); eye.dataset.m = `${mood}${glow}`; }
    const s = alive && !R.isCleared(g, id) ? Math.max(0, R.score(g, id)) : 0;
    el.querySelector('.blush').setAttribute('opacity', Math.min(.55, s / 22).toFixed(2));
    let pips = '';
    if (alive) {
      if (R.isCleared(g, id)) pips += `<span class="pip c" title="Above suspicion">cleared</span>`;
      else if (R.vouchedNights(g, id)) pips += `<span class="pip v" title="Vouched for on one night">✓</span>`;
      const m = g.marks[id], lies = m.lies + m.conflicts + m.leaving + m.doctor + m.recall + m.falseSwear;
      if (lies) pips += `<span class="pip x" title="Caught out">${lies > 1 ? lies : '✗'}</span>`;
    }
    el.querySelector('.pips').innerHTML = pips;
  }
}
function flashOn(id, text) {
  const el = pp(id); if (!el) return;
  const f = el.querySelector('.flash');
  f.textContent = text; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}

// ------------------------------------------------------------------ map tokens
function drawTokens(mode) {
  const nt = R.night(g);
  const tg = plan.querySelector('.tokens'), fx = plan.querySelector('.doorfx');
  let html = '';
  const byRoom = {};
  const present = mode === 'night' ? g.alive.slice() : [...g.alive, nt.victim].filter(Boolean);
  for (const id of present) (byRoom[nt.room[id]] ||= []).push(id);
  if (mode === 'claim') (byRoom[nt.lurk] ||= []).push(YOU);
  for (const r in byRoom) {
    const ids = byRoom[r];
    ids.forEach((id, k) => {
      const [x, y] = A.slot(+r, k, ids.length);
      const cls = [];
      if (mode === 'night') {
        const can = R.canTake(g, id) && (!ui.only.victim || ui.only.victim === id);
        cls.push(can ? 'can' : 'no');
        if (ui.sel.victim === id) cls.push('prey');
      } else {
        cls.push('ghost');
        if (id === nt.victim) cls.push('prey');
      }
      if (G[id]?.sleeper || G[id]?.drunk) cls.push('sleep');
      if (id === YOU) cls.push('me');
      html += A.tokenSVG(id, x, y, cls.join(' '));
      if ((G[id]?.sleeper || G[id]?.drunk) && id !== nt.victim) html += `<text class="zz" x="${x + 12}" y="${y - 12}">${G[id].drunk ? 'hic' : 'z z'}</text>`;
    });
  }
  tg.innerHTML = html;
  let f = '';
  // the cook's ears
  if (g.alive.includes('cook') && (mode === 'claim' || ui.sel.victim)) {
    for (const r of R.neighbours(nt.room.cook)) {
      const [x, y] = A.roomXY(r);
      f += `<text class="eartxt" x="${x + 7}" y="${y + A.CELL - 7}">((( Mrs Hobb hears</text>`;
    }
  }
  const lurk = mode === 'night' ? ui.sel.lurk : nt.lurk, vr = mode === 'night' ? (ui.sel.victim ? nt.room[ui.sel.victim] : null) : nt.vroom;
  if (lurk != null && vr != null) {
    const [ax, ay] = A.roomXY(lurk), [bx, by] = A.roomXY(vr);
    const mx = (ax + bx) / 2 + 50, my = (ay + by) / 2 + 50;
    const horiz = ay === by;
    f += horiz ? `<line class="doorline" x1="${mx}" y1="${my - 11}" x2="${mx}" y2="${my + 11}"/>` : `<line class="doorline" x1="${mx - 11}" y1="${my}" x2="${mx + 11}" y2="${my}"/>`;
  }
  fx.innerHTML = f;
  // room states
  for (const el of plan.querySelectorAll('.room')) {
    const i = +el.dataset.room;
    let can = false, sel = false, danger = false;
    if (mode === 'night' && ui.sel.victim) {
      can = R.adjacent(i, nt.room[ui.sel.victim]) && (ui.only.lurk == null || ui.only.lurk === i);
      sel = ui.sel.lurk === i;
      danger = sel && R.lurkReport(g, i).awake.length > 0;
    }
    if (mode === 'claim') {
      can = i !== nt.vroom && (ui.only.claim == null || ui.only.claim === i);
      sel = ui.sel.claim === i;
      danger = sel && claimNotes(i).some(n => n[0] === 'bad');
    }
    el.classList.toggle('can', can && !sel);
    el.classList.toggle('sel', sel);
    el.classList.toggle('danger', danger);
    el.classList.toggle('body', mode === 'claim' && i === nt.vroom);
  }
}

// ------------------------------------------------------------------ header
function header(t, s) {
  $('#whenT').textContent = t; $('#whenS').textContent = s || '';
  let m = '';
  for (let i = 1; i <= R.N_NIGHTS; i++) m += `<i class="${g && i < g.n ? 'past' : g && i === g.n ? 'now' : ''}"></i>`;
  $('#moons').innerHTML = m;
}
const NIGHT_NAMES = ['', 'The first night', 'The second night', 'The third night', 'The fourth night', 'The last night of the full moon'];

// ------------------------------------------------------------------ panel helpers
function panel(prompt, chips = '', actions = '') {
  $('#speech').hidden = true;
  $('#prompt').innerHTML = prompt; $('#choices').innerHTML = chips; $('#actions').innerHTML = actions;
  $('#prompt').hidden = !prompt; $('#choices').hidden = !chips;
  requestAnimationFrame(placeCoach);
}
const lock = () => { ui.keyLock = performance.now() + 400; $('#panel').scrollTop = 0; };
function notesHTML(notes) {
  return notes.length ? `<ul class="notes">${notes.map(([k, t]) => `<li class="${k}">${t}</li>`).join('')}</ul>` : '';
}
$('#choices').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  snd.tap();
  choose(b.dataset);
});
$('#actions').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  act(b.dataset.act);
});

// ------------------------------------------------------------------ the speech player
function play(lines, done) {
  ui.queue = lines.slice(); ui.done = done;
  $('#prompt').hidden = true; $('#choices').hidden = true; $('#actions').innerHTML = '';
  $('#speech').hidden = false;
  advance(true);
}
function advance(force) {
  const now = performance.now();
  if (!force && now - ui.lastAdv < 220) return;
  ui.lastAdv = now;
  for (const el of wall.querySelectorAll('.speaking')) el.classList.remove('speaking');
  const l = ui.queue.shift();
  if (!l) { $('#speech').hidden = true; const d = ui.done; ui.done = null; refreshWall(); d && d(); return; }
  const sp = $('#speech');
  sp.className = l.who ? '' : 'narr';
  if (l.kind === 'refute' || l.kind === 'conflict') sp.classList.add('refute');
  const who = sp.querySelector('.who');
  who.innerHTML = l.who ? `<svg viewBox="0 0 100 120">${A.silhouette(l.who, 0, { noEye: true, wolfOpacity: 0 })}</svg>${esc(nameOf(l.who))}` : '';
  sp.querySelector('.line').textContent = l.text;
  sp.querySelector('.more span').textContent = ui.queue.length ? '' : '';
  sp.querySelector('.more b').textContent = ui.queue.length ? 'Go on ›' : 'Continue ›';
  if (l.who && pp(l.who)) pp(l.who).classList.add('speaking');
  if ((l.kind === 'refute' || l.kind === 'conflict') && l.mark) {
    flashOn(l.mark, l.kind === 'conflict' ? 'Contradicted' : l.mark === YOU ? 'Caught out' : 'Caught lying');
    snd.sting();
  } else if (l.kind === 'clue' || l.kind === 'ears') snd.quill();
  else if (l.kind === 'body') snd.bell();
  else if (l.kind === 'accuse' && l.mark) flashOn(l.mark, 'Suspected');
  refreshWall();
  requestAnimationFrame(placeCoach);
  lessonHook('line', l);
}
$('#speech').addEventListener('click', () => advance());

// ------------------------------------------------------------------ phases
function newGame(lesson) {
  const seed = DEBUG && params.get('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  g = R.newGame(seed, { tutorial: lesson });
  if (DEBUG) window.mm.g = g;
  ui.lesson = lesson; ui.only = {};
  $('#title').hidden = true; $('#end').hidden = true;
  for (const el of wall.querySelectorAll('.votes')) el.innerHTML = '';
  refreshWall();
  enterNight();
}

function enterNight() {
  lock();
  ui.phase = 'night'; ui.sel = { victim: null, lurk: null };
  B.classList.add('night', 'showMap'); B.classList.remove('day');
  snd.ambience('night');
  header(`Night ${R.roman(g.n)}`, NIGHT_NAMES[g.n]);
  for (const el of wall.querySelectorAll('.votes')) el.innerHTML = '';
  refreshWall();
  renderNight();
  lessonHook('night');
}
function lurkNotes(r) {
  const rep = R.lurkReport(g, r), notes = [];
  const awake = rep.awake.map(id => R.shortOf(id));
  if (awake.length) notes.push(['bad', `${capital(listOf(awake))} ${awake.length > 1 ? 'are' : 'is'} awake in here, and will see you slip out at midnight.`]);
  else if (rep.colonel) notes.push(['ok', `The Colonel will doze off. Say at dinner that you were here, and he will swear to it.`]);
  if (rep.poet && !awake.length) notes.push(['ok', `Mr Lark is too drunk to notice you go.`]);
  if (rep.mum.length && !awake.length) notes.push(['ok', `Lady Marrow will swear she was in the Conservatory, so she can't say she saw you here.`]);
  if (!rep.here.length) notes.push(['meh', `Empty. Nobody here can vouch for you.`]);
  if (rep.heardBy) notes.push(['meh', `Mrs Hobb, next door in the ${roomName(R.night(g).room.cook)}, will hear someone in here.`]);
  if (g.alive.includes('doctor') && ui.sel.victim !== 'doctor') notes.push(['meh', `Tomorrow Dr Quill will study the body. The day after, he names the room the beast came from.`]);
  else if (ui.sel.victim === 'doctor') notes.push(['ok', `With Dr Quill dead, nobody will read the wounds.`]);
  return notes;
}
const capital = s => s ? s[0].toUpperCase() + s.slice(1) : s;
function renderNight() {
  const nt = R.night(g);
  drawTokens('night');
  const prey = g.alive.filter(id => R.canTake(g, id));
  let p = `<h3>Choose your prey</h3><p class="small">Only a guest who is alone can be taken. Tap one on the plan.</p>`;
  let chips = prey.map(id => `<button class="chip${ui.sel.victim === id ? ' on' : ''}" data-victim="${id}" ${ui.only.victim && ui.only.victim !== id ? 'disabled' : ''}>${esc(R.nameOf(id))}<small>${roomName(nt.room[id])}</small></button>`).join('');
  let actions = '';
  if (ui.sel.victim) {
    const vr = nt.room[ui.sel.victim];
    p = `<h3>${esc(R.nameOf(ui.sel.victim))}, alone in the ${roomName(vr)}</h3><p class="small">You strike through a connecting door. Choose a room next door to lurk in until midnight.</p>`;
    chips = `<button class="chip" data-victim="">‹ Other prey</button>` + R.neighbours(vr).map(r => {
      const rep = R.lurkReport(g, r);
      const occ = rep.here.length ? rep.here.map(id => R.shortOf(id).replace(/^the /, '')).join(', ') : 'empty';
      return `<button class="chip${ui.sel.lurk === r ? ' on' : ''}${rep.awake.length ? ' warn' : ''}" data-lurk="${r}" ${ui.only.lurk != null && ui.only.lurk !== r ? 'disabled' : ''}>${roomName(r)}<small>${esc(occ)}</small></button>`;
    }).join('');
    if (ui.sel.lurk != null) p += notesHTML(lurkNotes(ui.sel.lurk));
    actions = `<button class="act" data-act="hunt" ${ui.sel.lurk == null ? 'disabled' : ''}>Hunt</button>`;
  }
  panel(p, chips, actions);
}

function hunt() {
  const v = ui.sel.victim, l = ui.sel.lurk;
  R.hunt(g, l, v);
  ui.phase = 'hunting';
  hideCoach();
  snd.howl();
  const veil = $('#veil'), vt = $('#veilText');
  veil.className = 'red on';
  vt.innerHTML = `<div>${esc(R.nameOf(v))}<small>never sees the morning.</small></div>`;
  vt.classList.add('on');
  setTimeout(() => { vt.classList.remove('on'); veil.className = 'on'; }, 2300);
  setTimeout(() => { enterDawn(); veil.className = ''; }, 3100);
}

function enterDawn() {
  ui.phase = 'dawn';
  B.classList.remove('night', 'showMap'); B.classList.add('day');
  snd.ambience('day');
  header(`Day ${R.roman(g.n)}`, 'Breakfast, and a body');
  refreshWall();
  const lines = R.dawn(g);
  play(lines, enterClaim);
}

function claimNotes(room) {
  const nt = R.night(g), notes = [];
  const here = g.alive.filter(id => nt.room[id] === room);
  const honest = here.filter(id => !G[id].drunk && !(G[id].liar && nt.room[id] !== RI.conserv));
  const doctorAlive = g.alive.includes('doctor');
  if (room === nt.lurk) {
    const awake = honest.filter(id => !G[id].sleeper);
    if (awake.length) notes.push(['bad', `${capital(listOf(awake.map(R.shortOf)))} saw you slip out, whatever you say.`]);
    if (here.includes('colonel')) notes.push(['ok', `The truth. The Colonel saw you come in and will swear you stayed.`]);
    else if (here.includes('poet')) notes.push(['meh', `The truth, but Mr Lark is too drunk to vouch for you.`]);
    else notes.push(['meh', awake.length ? `The truth, for what it's worth.` : `The truth. Nobody can vouch for you, but nobody can say otherwise.`]);
    if (doctorAlive) notes.push(['bad', `Tomorrow Dr Quill names this room as the one the beast came from.`]);
    if (room === RI.conserv && g.alive.includes('widow') && nt.room.widow !== RI.conserv) notes.push(['bad', `Lady Marrow will swear she was alone in here.`]);
  } else {
    const saw = g.alive.filter(id => nt.room[id] === nt.lurk && !G[id].drunk && !G[id].sleeper && !(G[id].liar && nt.lurk !== RI.conserv));
    if (saw.length) notes.push(['bad', `${capital(listOf(saw.map(R.shortOf)))} saw you slip out of the ${roomName(nt.lurk)}, whatever you say.`]);
    if (g.alive.includes('colonel') && nt.room.colonel === nt.lurk) notes.push(['bad', `The Colonel saw you come into the ${roomName(nt.lurk)}. He'll correct you.`]);
    const awake = honest.filter(id => id !== 'colonel');
    if (awake.length) notes.push(['bad', `${capital(listOf(awake.map(R.shortOf)))} ${awake.length > 1 ? 'were' : 'was'} in here, and will say you weren't.`]);
    if (here.includes('colonel')) notes.push(['bad', `The Colonel took his port in here. He'll say you never came in.`]);
    if (room === RI.conserv && g.alive.includes('widow') && nt.room.widow !== RI.conserv) notes.push(['bad', `Lady Marrow will swear she was alone in here.`]);
    if (here.includes('poet') && here.length === 1) notes.push(['ok', `Mr Lark was in here, far too drunk to say otherwise.`]);
    if (g.alive.includes('cook')) {
      const k = nt.room.cook;
      if (k !== room && R.adjacent(k, room)) {
        if (!here.length) notes.push(['bad', `Mrs Hobb, next door in the ${roomName(k)}, heard nothing in here.`]);
        else if (!honest.filter(id => id !== 'colonel').length) notes.push(['ok', `Mrs Hobb heard someone in here, which suits you.`]);
      }
      if (R.adjacent(k, nt.lurk) && k !== nt.lurk && !g.alive.some(id => nt.room[id] === nt.lurk))
        notes.push(['meh', `Mrs Hobb heard someone in the ${roomName(nt.lurk)}. If nobody owns up to it, the whole table grows warier.`]);
    }
    if (doctorAlive) {
      const others = g.alive.filter(id => G[id].liar && nt.lurk === RI.conserv ? true : nt.room[id] === nt.lurk && !(G[id].liar && nt.lurk !== RI.conserv));
      notes.push(others.length
        ? ['ok', `Tomorrow Dr Quill names the ${roomName(nt.lurk)}, where ${listOf(others.map(R.shortOf))} will have said they were.`]
        : ['meh', `Tomorrow Dr Quill names the ${roomName(nt.lurk)}. If nobody claimed it, the table will know someone lied.`]);
    }
  }
  if (!notes.some(n => n[0] === 'bad') && room !== nt.lurk) notes.unshift(['ok', `Nobody can say you weren't.`]);
  notes.push(R.adjacent(room, nt.vroom) ? ['meh', `Next door to the body: unvouched, you'll be looked at harder.`] : ['ok', `Well away from the body.`]);
  return notes;
}
function enterClaim() {
  lock();
  ui.phase = 'claim'; ui.sel.claim = null;
  B.classList.add('showMap');
  header(`Day ${R.roman(g.n)}`, 'Dinner');
  renderClaim();
  lessonHook('claim');
}
function renderClaim() {
  const nt = R.night(g);
  drawTokens('claim');
  let p = `<h3>“And where were you last night?”</h3><p class="small">You were truly in the ${roomName(nt.lurk)}. Choose the room you'll claim.</p>`;
  const chips = R.claimable(g).map(r => `<button class="chip${ui.sel.claim === r ? ' on' : ''}" data-claim="${r}" ${ui.only.claim != null && ui.only.claim !== r ? 'disabled' : ''}>${roomName(r)}${r === nt.lurk ? '<small>the truth</small>' : ''}</button>`).join('');
  if (ui.sel.claim != null) p += notesHTML(claimNotes(ui.sel.claim));
  panel(p, chips, `<button class="act" data-act="claim" ${ui.sel.claim == null ? 'disabled' : ''}>Say it</button>`);
}

function enterTestimony() {
  ui.phase = 'testimony';
  B.classList.remove('showMap');
  snd.quill();
  const lines = R.testimony(g, ui.sel.claim);
  play(lines, enterRemark);
}

function enterRemark() {
  lock();
  ui.phase = 'remark'; ui.sel.remark = ui.sel.remark || null; ui.sel.target = null;
  ui.sel.remark = null;
  renderRemark();
  lessonHook('remark');
}
function renderRemark() {
  const kinds = [['quiet', 'Say nothing'], ['doubt', 'Cast doubt…'], ['swear', 'Swear you saw…']];
  let p = `<h3>Your turn to speak</h3>`;
  let chips = kinds.map(([k, t]) => `<button class="chip${ui.sel.remark === k ? ' on' : ''}" data-remark="${k}">${t}</button>`).join('');
  const notes = [];
  if (ui.sel.remark === 'doubt') notes.push(['ok', `Safe. Asks whether anyone saw them. Only works on someone nobody vouched for last night.`]);
  if (ui.sel.remark === 'swear') {
    const nt = R.night(g);
    notes.push(['meh', `Strong, and a lie you must live with. If anyone vouched for them, you're caught out.`]);
    if (g.confirmations[`${g.n}:${YOU}`]) notes.push(['bad', `You were vouched for, sitting in the ${roomName(nt.claims.you)} all night. Seeing anything by the body throws that away.`]);
    else if (!R.adjacent(nt.claims.you, nt.vroom)) notes.push(['bad', `You said the ${roomName(nt.claims.you)}, well away from the body. Swearing puts you by the ${roomName(nt.vroom)} yourself.`]);
    else notes.push(['ok', `You said the ${roomName(nt.claims.you)}, next door to the body, so you could have seen.`]);
    notes.push(['meh', `If the beast later takes the guest you swore against, the table will remember.`]);
  }
  if (ui.sel.remark && ui.sel.remark !== 'quiet') {
    p += `<p class="small">About whom? <b>✓ vouched</b> means someone said they were with that guest last night; <b>alone</b> means nobody did.</p>`;
    chips += '<br style="flex-basis:100%">' + R.remarkTargets(g).map(id => {
      const v = g.confirmations[`${g.n}:${id}`];
      const tag = R.isCleared(g, id) ? '<i class="tg">cleared</i>' : v ? '<i class="tg">✓ vouched</i>' : '<i class="tg a">alone</i>';
      return `<button class="chip${ui.sel.target === id ? ' on' : ''}" data-target="${id}">${esc(R.shortOf(id).replace(/^the /, ''))}${tag}</button>`;
    }).join('');
  }
  p += notesHTML(notes);
  const ready = ui.sel.remark === 'quiet' || (ui.sel.remark && ui.sel.target);
  panel(p, chips, `<button class="act" data-act="remark" ${ready ? '' : 'disabled'}>Speak</button>`);
}
function doRemark() {
  const lines = R.remark(g, ui.sel.remark, ui.sel.target);
  const talk = R.chatter(g);
  play([...lines, ...talk], enterVote);
}

function enterVote() {
  lock();
  ui.phase = 'vote'; ui.sel.vote = null;
  for (const id of g.alive) pp(id).classList.add('pickable');
  renderVote();
  lessonHook('vote');
}
function renderVote() {
  for (const id of g.alive) pp(id).classList.toggle('picked', ui.sel.vote === id);
  const need = R.exileVotes(g), word = need === 3 ? 'three' : 'two';
  const p = `<h3>The vote</h3><p class="small">${capital(word)} votes lock a guest in the ice house until the police come${need === 2 ? ', now that so few are left' : ''}. A tie, or fewer than ${word}, and nobody goes. Tap a portrait.</p>`;
  const chips = g.alive.map(id => `<button class="chip${ui.sel.vote === id ? ' on' : ''}" data-vote="${id}">${esc(R.shortOf(id).replace(/^the /, ''))}</button>`).join('');
  panel(p, chips, `<button class="act quiet" data-act="abstain">Abstain</button><button class="act" data-act="vote" ${ui.sel.vote ? '' : 'disabled'}>Vote</button>`);
}
function castVote(v) {
  for (const el of wall.querySelectorAll('.pickable, .picked')) el.classList.remove('pickable', 'picked');
  ui.phase = 'tally';
  panel('<h3>The vote</h3><p class="small">One by one, they choose.</p>');
  const res = R.resolveVote(g, v);
  const order = [YOU, ...SEATS.filter(id => id !== YOU)].filter(id => res.v[id]);
  let i = 0;
  const step = () => {
    if (i < order.length) {
      const voter = order[i++], t = res.v[voter];
      const tok = document.createElement('span');
      tok.className = 'vt';
      tok.innerHTML = `<svg viewBox="0 0 100 120"><rect width="100" height="120" fill="#efe2c6"/><g transform="translate(6 10) scale(.9)">${A.silhouette(voter, 0, { noEye: true, wolfOpacity: 0 })}</g></svg>`;
      pp(t).querySelector('.votes').appendChild(tok);
      snd.knock();
      setTimeout(step, 420);
      return;
    }
    setTimeout(() => afterVote(res), 500);
  };
  setTimeout(step, 300);
}
function afterVote(res) {
  const lines = [];
  const abst = g.alive.filter(id => !res.v[id]).length + (res.out && res.out !== YOU && !res.v[res.out] ? 1 : 0);
  if (res.out === YOU) {
    lines.push({ who: null, kind: 'refute', text: `${res.t.you} votes for you. The Colonel and the cook take your arms, and the ice house door slams behind you.` });
  } else if (res.out) {
    lines.push({ who: null, kind: 'body', text: `${R.nameOf(res.out)} is marched out to the ice house, protesting all the way.` });
    if (res.out === 'widow') lines.push({ who: 'cook', text: 'And she still smells of the Colonel\'s port.' });
  } else {
    const top = Object.entries(res.t).sort((a, b) => b[1] - a[1])[0];
    lines.push({ who: null, text: top ? `The table cannot agree. Nobody is locked away tonight.` : `Nobody will raise a hand. Nobody is locked away tonight.` });
  }
  if (res.out) setTimeout(() => snd.slam(), 50);
  play(lines, () => {
    refreshWall();
    if (g.over) return endGame();
    lock();
    panel(`<h3>The candles gutter</h3><p class="small">The guests drift off to the rooms they favour. The moon is rising.</p>`, '', `<button class="act" data-act="nightfall">Night falls</button>`);
    lessonHook('nightfall');
  });
}

function whyList() {
  const m = g.marks.you, out = [];
  const n = (k, one, many) => m[k] ? out.push(m[k] === 1 ? one : many.replace('#', m[k])) : 0;
  n('leaving', 'seen slipping out at midnight', 'seen slipping out # times');
  n('lies', 'caught in a lie', 'caught in # lies');
  n('conflicts', 'a story that clashed with another', '# stories that clashed with others');
  n('doctor', 'claimed the very room Dr Quill named', 'claimed the room Dr Quill named, # times');
  n('recall', 'the Colonel remembered your empty chair', 'the Colonel remembered your empty chair');
  n('falseSwear', 'swore against someone the beast then killed', 'swore against # guests the beast then killed');
  const nights = m.unverAdj + m.unverFar;
  if (nights) out.push(`nobody vouched for you on ${nights} night${nights > 1 ? 's' : ''}${m.unverAdj ? `, ${m.unverAdj} of them next door to a body` : ''}`);
  if (m.swore) out.push(`you swore against ${m.swore} guest${m.swore > 1 ? 's' : ''}, which made you look keen`);
  if (m.remarks) out.push('the table talked about you');
  return out.length ? out : ['a bad feeling'];
}
function endGame() {
  ui.phase = 'over';
  hideCoach();
  const o = g.over;
  const killed = Object.keys(g.fate).filter(id => g.fate[id].kind === 'killed');
  const exiled = Object.keys(g.fate).filter(id => g.fate[id].kind === 'exiled');
  $('#endT').textContent = o.win ? 'The Moon Wanes' : 'The Ice House';
  $('#endP').textContent = o.win
    ? (o.why === 'few' ? `Too few are left to stop you. You finish your supper alone, and leave on the morning train.` : `Five nights, and not one of them saw through you. On the sixth morning you catch the early train, and wave.`)
    : `Locked in the ice house on day ${R.roman(o.n)}. At moonrise the door splinters, but by then the whole county is awake and waiting.`;
  $('#endPts').innerHTML = R.GUESTS.map(x => {
    const f = g.fate[x.id];
    return `<span class="${f ? 'k' : ''}"><svg viewBox="0 0 100 124">${A.portraitSVG(x.id, 0).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>${f ? (f.kind === 'killed' ? '† ' : 'Ice House') : 'lived'}</span>`;
  }).join('');
  $('#endS').textContent = `${killed.length} taken by the beast, ${exiled.length} locked away by their friends. Caught in ${g.marks.you.lies + g.marks.you.conflicts} lie${g.marks.you.lies + g.marks.you.conflicts === 1 ? '' : 's'}.`;
  $('#endWhy').innerHTML = o.win ? '' : `<b>The case against you:</b> ${whyList().join('; ')}.`;
  $('#end').hidden = false;
  store.set('mm-lesson', '1');
  $('#againBtn').focus();
}

// ------------------------------------------------------------------ input
function choose(d) {
  if (ui.phase === 'night') {
    if ('victim' in d) { ui.sel.victim = d.victim || null; ui.sel.lurk = null; renderNight(); lessonHook('victim'); }
    if ('lurk' in d) { ui.sel.lurk = +d.lurk; renderNight(); lessonHook('lurk'); }
  } else if (ui.phase === 'claim' && 'claim' in d) { ui.sel.claim = +d.claim; renderClaim(); lessonHook('claimPick'); }
  else if (ui.phase === 'remark') {
    if ('remark' in d) { ui.sel.remark = d.remark; ui.sel.target = null; }
    if ('target' in d) ui.sel.target = d.target;
    renderRemark();
  } else if (ui.phase === 'vote' && 'vote' in d) { ui.sel.vote = d.vote; renderVote(); }
}
function act(a) {
  snd.tap();
  if (a === 'hunt' && ui.phase === 'night' && ui.sel.victim && ui.sel.lurk != null) hunt();
  else if (a === 'claim' && ui.phase === 'claim' && ui.sel.claim != null) { hideCoach(); enterTestimony(); }
  else if (a === 'remark' && ui.phase === 'remark') { hideCoach(); doRemark(); }
  else if (a === 'vote' && ui.phase === 'vote' && ui.sel.vote) { hideCoach(); castVote(ui.sel.vote); }
  else if (a === 'abstain' && ui.phase === 'vote') { hideCoach(); castVote(null); }
  else if (a === 'nightfall' && !g.over) { hideCoach(); R.startNight(g); enterNight(); }
}
function mapTap({ token, room }) {
  if (ui.phase === 'night') {
    const nt = R.night(g);
    const lurkOK = room != null && ui.sel.victim && R.adjacent(room, nt.room[ui.sel.victim]);
    if (token && !lurkOK && R.canTake(g, token) && token !== ui.sel.victim && (!ui.only.victim || ui.only.victim === token)) { snd.tap(); return choose({ victim: token }); }
    if (room == null) return;
    if (ui.sel.victim && R.adjacent(room, nt.room[ui.sel.victim]) && (ui.only.lurk == null || ui.only.lurk === room)) { snd.tap(); return choose({ lurk: String(room) }); }
    if (!ui.sel.victim || room !== nt.room[ui.sel.victim]) {
      const alone = g.alive.filter(id => nt.room[id] === room && R.canTake(g, id) && (!ui.only.victim || ui.only.victim === id));
      if (alone.length === 1) { snd.tap(); return choose({ victim: alone[0] }); }
    }
  } else if (ui.phase === 'claim' && room != null && room !== R.night(g).vroom && (ui.only.claim == null || ui.only.claim === room)) { snd.tap(); choose({ claim: String(room) }); }
}
function portraitTap(id) {
  if (ui.phase === 'vote' && g.alive.includes(id)) { snd.tap(); ui.sel.vote = id; renderVote(); }
  else if ($('#speech').hidden === false) advance();
}

addEventListener('keydown', e => {
  const k = e.key;
  if (!$('#book').hidden) { if (k === 'Escape' || k === 'n' || k === 'N') { e.preventDefault(); closeBook(); } return; }
  if (!$('#title').hidden || !$('#end').hidden) return;
  if (k === 'n' || k === 'N') { e.preventDefault(); openBook(); return; }
  if (k === 'm' || k === 'M') { toggleMute(); return; }
  if (k === ' ' || k === 'Enter') {
    // the focused button handles it, except a portrait you've already tapped: that would swallow the key
    const fb = e.target.closest && e.target.closest('button');
    if (fb && !(fb.classList.contains('pp') && !(ui.phase === 'vote' && fb.classList.contains('pickable') && ui.sel.vote !== fb.dataset.id))) return;
    e.preventDefault();
    if (e.repeat || performance.now() < (ui.keyLock || 0)) return;
    if (!$('#speech').hidden) return advance();
    if (!$('#coach').hidden && !$('#coachNext').hidden) return coachNext();
    const b = [...$('#actions').querySelectorAll('.act:not(.quiet)')].find(x => !x.disabled);
    if (b) b.click();
    return;
  }
  if (/^[1-9]$/.test(k) && (ui.phase === 'night' || ui.phase === 'claim')) { mapTap({ room: +k - 1 }); return; }
});

// ------------------------------------------------------------------ notebook
function openBook() {
  if (!g) return;
  snd.quill();
  const rows = [YOU, ...R.GUESTS.map(x => x.id)];
  const ns = g.nights.filter(nt => Object.keys(nt.claims).length);
  let h = '';
  if (ns.length) {
    h += `<h4>Where everyone said they were</h4><div class="nbwrap"><table class="nb"><tr><th></th>${ns.map(nt => `<th>Night ${R.roman(nt.n)}</th>`).join('')}</tr>`;
    for (const id of rows) {
      const fate = g.fate[id];
      h += `<tr class="${fate ? 'gone' : ''}"><td class="who">${id === YOU ? 'You' : esc(R.shortOf(id).replace(/^the /, ''))}</td>`;
      for (const nt of ns) {
        let c = '';
        if (nt.victim === id) c = `† ${roomName(nt.vroom)}`;
        else if (nt.claims[id] != null) {
          c = roomName(nt.claims[id]);
          const v = g.confirmations[`${nt.n}:${id}`];
          if (v) c += ` <small style="color:#4a6a2a">✓ ${esc(v.map(w => R.shortOf(w).replace(/^the /, '')).join(', '))}</small>`;
          if (nt.refuted?.includes(id)) c += ` <small>✗ contradicted</small>`;
          if (id === YOU && nt.claims[id] !== nt.lurk) c += ` <small>truly: ${roomName(nt.lurk)}</small>`;
        } else if (fate && fate.n < nt.n) c = '';
        h += `<td>${c}</td>`;
      }
      h += '</tr>';
    }
    h += '</table></div>';
  }
  const ev = [];
  for (const nt of g.nights) {
    if (!nt.victim) continue;
    let t = `<b>Night ${R.roman(nt.n)}.</b> ${esc(R.nameOf(nt.victim))} killed in the ${roomName(nt.vroom)}. You lurked in the ${roomName(nt.lurk)}.`;
    if (nt.doctorRoom != null) t += ` Dr Quill: the beast came from the ${roomName(nt.doctorRoom)}.`;
    if (nt.heard) t += ` Mrs Hobb, in the ${roomName(nt.heard.at)}, heard ${nt.heard.heard.length ? 'someone in the ' + listOf(nt.heard.heard.map(roomName)) : 'nothing'}.`;
    const sw = g.sworn.filter(s => s.n === nt.n);
    if (sw.length) t += ` You swore you saw ${esc(listOf(sw.map(s => R.nameOf(s.target))))}.`;
    for (const id in g.fate) if (g.fate[id].kind === 'exiled' && g.fate[id].n === nt.n) t += ` ${esc(R.nameOf(id))} was locked in the ice house.`;
    ev.push(`<li>${t}</li>`);
  }
  if (ev.length) h += `<h4>What happened</h4><ul class="ev">${ev.join('')}</ul>`;
  const sus = [YOU, ...g.alive].filter(id => !R.isCleared(g, id)).sort((a, b) => R.score(g, b) - R.score(g, a));
  if (g.n >= 1 && ns.length) h += `<h4>Who the table suspects most</h4><p>${sus.map(id => id === YOU ? '<b>You</b>' : esc(R.nameOf(id))).join(' · ')}</p>`;
  h += `<h4>The guests</h4><div class="who-list">${R.GUESTS.map(x => `<div><svg viewBox="0 0 100 120">${A.silhouette(x.id, 0, { noEye: true })}</svg><span><b>${esc(x.name)}</b>${esc(x.trait)}</span></div>`).join('')}</div>`;
  h += `<h4>The rules</h4><p>Each night take one guest who is <b>alone</b>, from a room <b>next door</b>. Anyone awake in your room sees you slip out. At dinner everyone says where they were, and honest guests name who was with them, so a lie about a busy room is caught. A guest vouched for on two nights is <b>above suspicion</b>. Three votes lock a guest in the ice house. Survive five dinners.</p>
    <p class="small" style="font-style:italic">Keys: 1–9 pick rooms, Space or Enter goes on, N opens this notebook, M mutes.</p>`;
  $('#bookBody').innerHTML = h;
  $('#book').hidden = false;
  $('#coach').style.visibility = 'hidden';
  $('#bookClose').focus();
}
function closeBook() { $('#book').hidden = true; $('#coach').style.visibility = ''; $('#bookBtn').blur(); }
$('#bookBtn').addEventListener('click', openBook);
$('#bookClose').addEventListener('click', closeBook);
$('#book').addEventListener('click', e => { if (e.target.id === 'book') closeBook(); });
function toggleMute() { snd.setOn(!snd.on); $('#muteBtn').classList.toggle('off', !snd.on); store.set('mm-mute', snd.on ? '0' : '1'); }
$('#muteBtn').addEventListener('click', e => { toggleMute(); if (e.detail) e.currentTarget.blur(); });
if (store.get('mm-mute') === '1') { snd.on = false; $('#muteBtn').classList.add('off'); }
addEventListener('pointerdown', () => { snd.init(); snd.resume(); }, { capture: true });
addEventListener('keydown', () => { snd.init(); snd.resume(); }, { capture: true });

// ------------------------------------------------------------------ title and end
$('#startLesson').addEventListener('click', () => newGame(true));
$('#startPlain').addEventListener('click', () => newGame(false));
$('#againBtn').addEventListener('click', () => { $('#end').hidden = true; newGame(false); });
$('#endBook').addEventListener('click', openBook);
if (store.get('mm-lesson') === '1') {
  const a = $('#startLesson'), b = $('#startPlain');
  a.textContent = 'Lessons again'; a.className = 'act quiet';
  b.textContent = 'Begin'; b.className = 'act';
  b.parentNode.insertBefore(b, a);
}

// ------------------------------------------------------------------ lessons
const coachEl = $('#coach');
function coach(html, target, opts = {}) {
  coachEl.querySelector('p').innerHTML = html;
  $('#coachNext').hidden = !opts.next;
  $('#coachNext').textContent = opts.nextLabel || 'Next';
  coachEl.hidden = false;
  ui.coachTarget = target; ui.coachNext = opts.next || null;
  ui.keyLock = performance.now() + 900;
  placeCoach();
}
function hideCoach() { coachEl.hidden = true; ui.coachTarget = null; }
function placeCoach() {
  if (coachEl.hidden) return;
  const arrow = coachEl.querySelector('.arrow');
  const W = innerWidth, H = innerHeight;
  const cw = coachEl.offsetWidth, ch = coachEl.offsetHeight;
  const panelR = $('#panel').getBoundingClientRect(), stageR = $('#stage').getBoundingClientRect();
  const t = typeof ui.coachTarget === 'function' ? ui.coachTarget() : ui.coachTarget ? document.querySelector(ui.coachTarget) : null;
  const tr = t ? t.getBoundingClientRect() : null;
  const wide = W / H > 1.1;
  let x, y, ax = null, ay = null, side = null;
  if (wide) {
    // over the stage, near the top or bottom away from the target
    x = Math.min(stageR.right - cw - 10, Math.max(stageR.left + 10, (tr ? tr.left + tr.width / 2 : stageR.left + stageR.width / 2) - cw / 2));
    if (tr && tr.left >= panelR.left - 4) { x = panelR.left - cw - 16; y = Math.min(H - ch - 10, Math.max(10, tr.top + tr.height / 2 - ch / 2)); side = 'right'; }
    else if (tr) { y = tr.top - ch - 14 > stageR.top ? tr.top - ch - 14 : tr.bottom + 14; side = y < tr.top ? 'down' : 'up'; }
    else y = stageR.top + 8;
  } else {
    x = (W - cw) / 2;
    if (tr && tr.top >= panelR.top - 4) { y = panelR.top - ch - 12; side = 'down'; }
    else if (tr) { y = tr.top - ch - 14 > stageR.top - 30 ? tr.top - ch - 14 : tr.bottom + 14; side = y < tr.top ? 'down' : 'up'; }
    else y = stageR.top + 6;
    if (y + ch > panelR.top - 4 && side !== 'down') y = Math.max(6, panelR.top - ch - 8);
  }
  x = Math.max(8, Math.min(W - cw - 8, x)); y = Math.max(6, Math.min(H - ch - 6, y));
  coachEl.style.left = x + 'px'; coachEl.style.top = y + 'px';
  if (tr && side) {
    arrow.style.display = 'block';
    if (side === 'right') { arrow.style.left = (cw - 8) + 'px'; arrow.style.top = Math.max(10, Math.min(ch - 20, tr.top + tr.height / 2 - y - 7)) + 'px'; arrow.style.borderWidth = '1.5px 1.5px 0 0'; }
    else {
      arrow.style.left = Math.max(12, Math.min(cw - 26, tr.left + tr.width / 2 - x - 7)) + 'px';
      arrow.style.top = side === 'down' ? (ch - 8) + 'px' : '-8px';
      arrow.style.borderWidth = side === 'down' ? '0 1.5px 1.5px 0' : '1.5px 0 0 1.5px';
    }
  } else arrow.style.display = 'none';
}
addEventListener('resize', () => requestAnimationFrame(placeCoach));
function coachNext() { const f = ui.coachNext; if (typeof f === 'function') { snd.tap(); f(); } else hideCoach(); }
$('#coachNext').addEventListener('click', coachNext);
$('#coachSkip').addEventListener('click', () => { endLesson(); });
function endLesson() { ui.lesson = false; ui.only = {}; hideCoach(); store.set('mm-lesson', '1'); if (ui.phase === 'night') renderNight(); if (ui.phase === 'claim') renderClaim(); }
const tok = id => () => plan.querySelector(`.tok[data-id="${id}"]`);
const room = i => () => plan.querySelector(`.room[data-room="${i}"] .floor`);

function lessonHook(ev, data) {
  if (!ui.lesson) return;
  const n = g.n;
  if (n === 1 && ev === 'night') {
    ui.only = { victim: 'reverend', lurk: RI.conserv, claim: RI.hall };
    renderNight();
    coach(`You are <b>Mr Fenwick</b>, and for five nights the moon is full. This is the manor at midnight. Your wolf's eyes can see every guest, wherever they are.`, null, { next: () =>
      coach(`You can only take a guest who is <b>alone</b>. The Reverend is praying by himself in the Chapel. <b>Tap him.</b>`, tok('reverend')) });
  }
  if (n === 1 && ev === 'victim' && ui.sel.victim === 'reverend')
    coach(`You strike through a connecting door, so you must lurk in a room <b>next door</b>. Mr Lark is drunk in the Gallery. The Conservatory is empty. <b>Tap the Conservatory.</b>`, room(RI.conserv));
  if (n === 1 && ev === 'lurk')
    coach(`Anyone awake in your room would see you slip out at midnight. Nobody is in here. <b>Hunt.</b>`, '#actions .act');
  if (n === 1 && ev === 'claim')
    coach(`Dinner. Everyone says where they spent the night, and honest guests name who was with them. So a lie about a busy room gets caught on the spot.`, null, { next: () =>
      coach(`The truth is dangerous: tomorrow <b>Dr Quill</b> will name the Conservatory. Say you were elsewhere, and <b>Lady Marrow</b>, who always claims the Conservatory, takes the blame. The Great Hall was empty, and Mrs Hobb can't hear it. <b>Tap the Great Hall.</b>`, room(RI.hall)) });
  if (n === 1 && ev === 'claimPick')
    coach(`Each room you pick lists what you know will happen. <b>Say it.</b>`, '#actions .act');
  if (n === 1 && ev === 'remark')
    coach(`A gold <b>✓</b> marks a guest someone vouched for. Vouched for on two nights, a guest is <b>above suspicion</b>. A red mark is a lie caught. The redder the frame, the more the table suspects them.`, () => wall, { next: () =>
      coach(`Now you may speak. <b>Swearing</b> you saw someone hits hard, but you'd have to have been out by the Chapel yourself, and you said the Great Hall. <b>Doubt</b> is safe: cast doubt on Mr Lark, alone next door to the Chapel.`, '#choices') });
  if (n === 1 && ev === 'vote')
    coach(`Watch their eyes. A <b>red glare</b> means that guest would vote for you right now. Three votes lock someone in the ice house. Vote for whoever the table already doubts.`, () => wall);
  if (n === 1 && ev === 'nightfall') coach(`The game is yours now, with one last lesson when night falls.`, '#actions .act');
  if (n === 2 && ev === 'night') {
    ui.only = {}; renderNight();
    coach(`<b>The Colonel</b> dozes after his port. Lurk in his room, claim it at dinner, and he'll swear you were with him all night: that counts as being vouched for. But he may remember otherwise later. The <b>Notebook</b> keeps every claim.`, '#bookBtn', { next: endLesson, nextLabel: 'Got it' });
  }
}

// ------------------------------------------------------------------ demo (for the preview shot) and debug
function demo() {
  $('#title').hidden = true;
  g = R.newGame(7, { tutorial: true });
  ui.lesson = false;
  R.hunt(g, RI.conserv, 'reverend');
  R.dawn(g);
  const lines = R.testimony(g, RI.library);   // the twins were in the Library
  B.classList.remove('night', 'showMap'); B.classList.add('day');
  ui.phase = 'testimony';
  refreshWall();
  const pick = lines.find(l => l.kind === 'refute') || lines[2];
  play([pick], () => {});
  const f = pp(YOU).querySelector('.flash');
  f.textContent = 'Caught out'; f.classList.remove('on'); f.style.opacity = 1; f.style.transform = 'translate(-50%, -50%) rotate(-10deg)';
}
if (DEBUG) window.mm = { R, ui, get g() { return g; }, set g(v) { g = v; }, advance, choose, act, mapTap, refreshWall, openBook, closeBook, newGame };
if (DEMO) demo();
else $('#startLesson').focus({ preventScroll: true });
header('Moonrise Manor', '');
if (DEMO) header('Day I', 'Dinner');
