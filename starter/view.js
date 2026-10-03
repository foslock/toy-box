// The page: lays the boxes out for each phase, keeps the figures, the lists and the news up to date, and plays the
// curtain between phases, the card when you come back, and the ending. It reads the state; main.js owns it.
import * as G from './sim.js';
import { PHASES, ENDING } from './content.js';
import { num, rate, money, mass, dur, when, hourOf, cost as costText } from './fmt.js';
import { makeJar, makeTown, makeWorld, makeCosmos, drawEndJar, vesselOf } from './art.js';

const $ = id => document.getElementById(id);
const THEME = ['#f3ead6', '#ebe5d5', '#0e2824', '#070920'];
const BODY = ['#f3ead6', '#ebe5d5', '#0b211e', '#05061a'];

// Which boxes go in which column, wide and narrow.
const LAYOUT = [
  { wide: [['newsBox', 'jarBox', 'figBox', 'mkBox', 'pjBox']], narrow: ['newsBox', 'jarBox', 'figBox', 'mkBox', 'pjBox'] },
  { wide: [['mapBox', 'figBox', 'newsBox'], ['jarBox', 'actBox', 'mkBox'], ['pjBox']], narrow: ['mapBox', 'figBox', 'jarBox', 'actBox', 'pjBox', 'mkBox', 'newsBox'],
    mid: [['mapBox', 'figBox', 'newsBox'], ['jarBox', 'actBox', 'pjBox', 'mkBox']], flex: [1.35, 1, 1.05] },
  { wide: [['mapBox', 'figBox'], ['pjBox', 'mkBox', 'newsBox', 'jarBox']], narrow: ['mapBox', 'figBox', 'pjBox', 'mkBox', 'newsBox', 'jarBox'], flex: [1.5, 1] },
  { wide: [['figBox', 'actBox', 'mkBox', 'jarBox'], ['mapBox', 'newsBox'], ['pjBox']], narrow: ['mapBox', 'actBox', 'figBox', 'pjBox', 'mkBox', 'newsBox', 'jarBox'],
    mid: [['mapBox', 'actBox', 'newsBox'], ['figBox', 'pjBox', 'mkBox', 'jarBox']], flex: [1.05, 1.5, 1] },
];
const HEADS = [
  { mkHead: 'Grow', pjHead: 'Upgrades' },
  { mapHead: 'The Parish', figHead: 'Figures', actHead: 'At the Baker’s', mkHead: 'Openings', pjHead: 'Notices', newsHead: 'News in Brief', jarHead: 'The Original Jar' },
  { mapHead: 'Holdings', figHead: 'The Ledger', mkHead: 'Expansion', pjHead: 'Initiatives', newsHead: 'The Wire', jarHead: 'The Mother Jar' },
  { mapHead: 'Everything', figHead: 'Reckoning', actHead: 'Warmth', mkHead: 'Spore Clouds', pjHead: 'Workings', newsHead: 'Signals', jarHead: 'The First Jar' },
];
const JARCAP = [
  '', 'On the baker’s counter, at number 12. Still yours. Tap to bubble.',
  'In a museum in Much Proving now, behind glass. Tap to bubble.', 'Somewhere very far behind you. Tap to bubble.',
];
const EMPTY = ['Nothing yet. Keep bubbling.', 'No notices this week.', 'No initiatives pending.', 'Nothing to do but spread.'];

export function makeView(h) {
  const app = $('app'), cols = $('cols');
  const jar = makeJar($('jar'));
  let town = null, world = null, cosmos = null;
  let phase = -1;
  const pjEls = new Map(), mkEls = new Map(), figEls = new Map();
  let textT = 0, lastTapFx = 0;

  // ---- layout ------------------------------------------------------------------------------------------------------
  const mq = window.matchMedia('(max-width: 760px)'), mqMid = window.matchMedia('(max-width: 1040px)');
  function arrange() {
    const L = LAYOUT[phase];
    const isNarrow = mq.matches, isMid = !isNarrow && mqMid.matches && L.mid;
    const hold = $('boxes');
    for (const b of cols.querySelectorAll('.box')) hold.appendChild(b);
    cols.textContent = '';
    const groups = isNarrow ? [L.narrow] : isMid ? L.mid : L.wide;
    groups.forEach((ids, i) => {
      const c = document.createElement('div');
      c.className = 'col';
      if (!isNarrow && !isMid && L.flex) c.style.flex = `${L.flex[i]} 1 0`;
      for (const id of ids) c.appendChild($(id));
      cols.appendChild(c);
    });
  }
  for (const m of [mq, mqMid]) m.addEventListener ? m.addEventListener('change', () => phase >= 0 && arrange()) : m.addListener(() => phase >= 0 && arrange());

  function layout(s) {
    phase = s.phase;
    app.dataset.phase = PHASES[phase].id;
    document.querySelector('meta[name=theme-color]').setAttribute('content', THEME[phase]);
    document.body.style.setProperty('--body-bg', BODY[phase]);
    arrange();
    for (const id of ['mapHead', 'figHead', 'actHead', 'mkHead', 'pjHead', 'newsHead', 'jarHead']) $(id).textContent = HEADS[phase][id] || '';
    $('mapBox').hidden = phase === 0;
    $('actBox').hidden = phase !== 1 && phase !== 3;
    $('town').toggleAttribute('hidden', phase !== 1); $('world').hidden = phase !== 2; $('cosmos').hidden = phase !== 3;
    $('giveBtn').hidden = phase !== 1; $('warm').hidden = phase !== 3;
    if (phase === 1 && !town) town = makeTown($('town'));
    if (phase === 2 && !world) world = makeWorld($('world'));
    if (phase === 3 && !cosmos) cosmos = makeCosmos($('cosmos'));
    $('mTitle').textContent = phase === 1 ? 'The Much Proving Gazette' : phase === 2 ? s.name : phase === 3 ? 'Beyond' : '';
    for (const m of [pjEls, mkEls, figEls]) { for (const e of m.values()) e.remove?.(); m.clear(); }
    $('figList').textContent = '';
    $('pjList').textContent = ''; $('mkList').textContent = '';
    rebuildNews(s);
    render(s, 0, true);
  }

  // ---- news --------------------------------------------------------------------------------------------------------
  const MAXNEWS = [4, 9, 7, 6];
  function rebuildNews(s) {
    const list = $('newsList');
    list.textContent = '';
    const lines = s.log.filter(l => l.phase === s.phase).slice(-MAXNEWS[s.phase]);
    for (const l of lines) list.prepend(li(l, false));
  }
  function li(l, fresh) {
    const e = document.createElement('li');
    e.className = (l.kind || '') + (fresh ? ' fresh' : '');
    e.textContent = l.text;
    return e;
  }
  function log(l) {
    if (l.phase !== phase) return;
    const list = $('newsList');
    list.prepend(li(l, true));
    while (list.children.length > MAXNEWS[phase]) list.lastChild.remove();
  }

  // ---- figures -----------------------------------------------------------------------------------------------------
  function figs(s, r, k) {
    const rows = [];
    const add = (id, label, value, sub, extra) => rows.push({ id, label, value, sub, extra });
    if (s.phase === 0) {
      add('b', 'Bubbles', num(s.b), r.bps > 0 ? `${rate(r.bps)} a second` : '');
      if (s.feeds) add('g', 'In the jar', `${Math.floor(s.grams)} g`, `of ${num(k.cap)} g`);
      if (s.feeds) add('fed', 'Fed', `${num(s.feeds)} time${s.feeds === 1 ? '' : 's'}`);
      if (s.loaves) add('loaves', 'Loaves', num(s.loaves));
      if (s.loaves || s.adm) add('adm', 'Admiration', num(s.adm));
      if (s.binned && !s.own.toogood) add('bin', 'In the bin', mass(s.binned));
    } else if (s.phase === 1) {
      add('jars', 'Kitchens keeping a jar', `${num(Math.round(s.jars))}`, `of ${num(G.KITCHENS)}`, { meter: s.jars / G.KITCHENS });
      if (!s.own.reservoir) {
        add('R', 'Each jar is passed on', `${r.R.toFixed(1)} times`, r.R < 1 ? 'before it’s forgotten — not enough' : 'before it’s forgotten');
        add('reach', 'Kitchens that might', `${Math.round(Math.min(1, k.reach) * 100)}%`);
      }
      if (s.forgotten >= 1) add('forgot', 'Jars forgotten', num(s.forgotten));
      if (s.own.honesty) add('m', 'Money', money(s.money), `${money(r.mps)} a second`);
      add('b', 'Bubbles', num(s.b), `${rate(r.bps)} a second`);
    } else if (s.phase === 2) {
      add('hosts', 'People who eat you', num(s.hosts), `of ${num(G.PEOPLE)}`, { meter: s.hosts / G.PEOPLE });
      add('demand', 'People who want you', num(r.demand), r.short ? 'more than you can feed' : '');
      add('flour', 'Flour', `${num(r.flour)} t`, `a second: enough for ${num(r.supply)}`);
      add('land', 'Land under wheat', `${s.n.field}%`, `of ${num(k.land)}% you can use`, { meter: s.n.field / 100 });
      if (k.ocean) add('sea', 'Sea under wheat', `${s.n.kelp}%`);
      add('m', 'Money', money(s.money), `${money(r.mps)} a second`);
      add('b', 'Bubbles', num(s.b), `${rate(r.bps)} a second`);
      if (k.crust) add('mass', 'Weight of you', mass(G.massG(s)));
    } else {
      add('sys', 'Star systems leavened', num(Math.exp(s.lnSys)));
      add('rise', 'Risen', `${(G.rise(s) * 100).toFixed(1)}%`, 'of the way to doubled', { meter: G.rise(s) });
      add('grow', 'Spreading', r.grow > 0 ? `×2 every ${(Math.LN2 / r.grow).toFixed(1)} s` : '—', s.chill > 0 ? 'recovering' : '');
      add('b', 'Bubbles', num(s.b), `${rate(r.bps)} a second`);
      if (s.collapses) add('col', 'Collapses', num(s.collapses));
    }
    const dl = $('figList');
    const ids = new Set(rows.map(x => x.id));
    for (const [id, e] of figEls) if (!ids.has(id)) { e.dt.remove(); e.dd.remove(); figEls.delete(id); }
    for (const row of rows) {
      let e = figEls.get(row.id);
      if (!e) {
        const dt = document.createElement('dt'), dd = document.createElement('dd');
        if (textT > 0) { dt.className = dd.className = 'new'; }
        dl.append(dt, dd); e = { dt, dd, k: '' }; figEls.set(row.id, e);
      }
      const key = row.label + row.value + row.sub + (row.extra ? row.extra.meter.toFixed(3) : '');
      if (key === e.k) continue;
      e.k = key;
      e.dt.textContent = row.label;
      e.dd.innerHTML = '';
      e.dd.append(row.value);
      if (row.sub) { const sm = document.createElement('small'); sm.textContent = row.sub; e.dd.append(sm); }
      if (row.extra && row.extra.meter != null) {
        const m = document.createElement('span'); m.className = 'meter'; m.style.setProperty('--p', Math.min(1, row.extra.meter).toFixed(4));
        m.append(document.createElement('i')); e.dd.append(m);
      }
    }
  }

  // ---- projects and makers -----------------------------------------------------------------------------------------
  const progress = (s, c) => Math.min(...['b', 'm', 'a'].filter(x => c[x]).map(x => Math.min(1, (x === 'b' ? s.b : x === 'm' ? s.money : s.adm) / c[x])));
  function projects(s) {
    const open = G.openProjects(s);
    const ids = new Set(open.map(p => p.id));
    for (const [id, e] of pjEls) if (!ids.has(id)) { e.remove(); pjEls.delete(id); }
    const list = $('pjList');
    for (const p of open) {
      let b = pjEls.get(p.id);
      if (!b) {
        b = document.createElement('button');
        b.className = 'pj' + (s.t - s.shown[p.id] < 3 ? ' fresh' : '');
        b.dataset.id = p.id;
        b.innerHTML = '<span class="pj-name"></span><span class="pj-flavor"></span><span class="pj-effect"></span><span class="pj-cost"></span>';
        b.children[0].textContent = G.nameIt(s, p.name);
        b.children[1].textContent = G.nameIt(s, p.flavor);
        b.children[2].textContent = G.nameIt(s, p.effect);
        b.addEventListener('click', () => h.buy(p.id));
        pjEls.set(p.id, b);
        // keep the order the content gives
        for (const q of G.PROJECTS) if (pjEls.has(q.id)) list.appendChild(pjEls.get(q.id));
      }
      const ok = G.canBuy(s, p.id);
      b.classList.toggle('ok', ok);
      b.setAttribute('aria-disabled', ok ? 'false' : 'true');
      // the price is a button-shaped pill: it fills as you save up, and says Buy once you can
      const price = (ok ? 'Buy · ' : '') + costText(p.cost);
      if (b.children[3].textContent !== price) b.children[3].textContent = price;
      b.style.setProperty('--p', progress(s, p.cost).toFixed(3));
    }
    $('pjEmpty').textContent = open.length ? '' : EMPTY[s.phase];
    $('pjBox').hidden = s.phase === 0 && !open.length && !s.own.wild && s.clicks < 3;
  }
  function makers(s, k) {
    const open = G.openMakers(s);
    const ids = new Set(open.map(m => m.id));
    for (const [id, e] of mkEls) if (!ids.has(id)) { e.remove(); mkEls.delete(id); }
    const list = $('mkList');
    for (const m of open) {
      let b = mkEls.get(m.id);
      if (!b) {
        b = document.createElement('button');
        b.className = 'mk';
        b.innerHTML = '<span class="mk-name"></span><span class="mk-n"></span><span class="mk-eff"></span><span class="mk-cost"></span>';
        b.children[0].textContent = m.name;
        holdToRepeat(b, () => h.make(m.id));
        mkEls.set(m.id, b);
        list.appendChild(b);
      }
      const full = s.n[m.id] >= G.makerMax(s, m.id);
      const c = G.costOf(s, m.id);
      b.children[1].textContent = '×' + num(s.n[m.id]);
      b.children[2].textContent = m.effect(k);
      const ok = G.canMake(s, m.id);
      const price = full ? (m.id === 'kelp' ? 'All the sea' : s.n[m.id] >= 100 ? 'All the land' : 'No more land, yet')
        : (ok ? 'Buy · ' : '') + (m.cur === 'm' ? money(c) : `${num(c)} bubbles`);
      if (b.children[3].textContent !== price) b.children[3].textContent = price;
      b.classList.toggle('ok', ok); b.classList.toggle('full', full);
      const have = m.cur === 'm' ? s.money : s.b;
      b.style.setProperty('--p', full ? 0 : Math.min(1, have / c).toFixed(3));
    }
    $('mkBox').hidden = !open.length;
  }
  // tap to buy one; hold to keep buying
  function holdToRepeat(b, fn) {
    let timer = 0, held = false;
    const stop = () => { clearTimeout(timer); timer = 0; };
    b.addEventListener('pointerdown', e => {
      if (e.button) return;
      held = false; stop();
      const sx = e.clientX, sy = e.clientY;
      const move = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) { stop(); b.removeEventListener('pointermove', move); } };
      b.addEventListener('pointermove', move);
      timer = setTimeout(function rep() { held = true; if (fn() !== false) timer = setTimeout(rep, 90); else timer = 0; }, 420);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
    b.addEventListener('click', e => { if (held) { held = false; e.preventDefault(); return; } fn(); });
    b.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ---- actions -----------------------------------------------------------------------------------------------------
  function actions(s, k) {
    if (s.phase === 1) {
      const gb = $('giveBtn');
      gb.hidden = !!s.own.reservoir;
      gb.disabled = !G.canGive(s);
      gb.style.setProperty('--p', s.giveT > 0 ? (1 - s.giveT / 4).toFixed(3) : 0);
      const small = gb.querySelector('small');
      const txt = s.giveT > 0 ? 'The baker is out delivering…' : s.grams < 120 ? 'Not enough of you in the jar yet' : '100 g of you, in a jam jar, to a neighbour';
      if (small.textContent !== txt) small.textContent = txt;
      $('actBox').hidden = !!s.own.reservoir;
    }
    if (s.phase === 3) {
      const inp = $('warmIn');
      if (document.activeElement !== inp || k.auto) inp.value = s.warmth;
      inp.disabled = !!k.auto;
      $('safeMark').style.setProperty('--p', Math.min(1, k.safe));
      $('warmVal').textContent = k.auto ? 'Held by instinct' : s.chill > 0 ? 'Recovering' : s.warmth > k.safe ? 'Too warm' : 'Warmth';
      const om = $('overMeter');
      om.style.setProperty('--p', Math.min(1, s.over).toFixed(3));
      om.classList.toggle('hot', s.over > .6);
      $('overVal').textContent = s.over > 0.01 ? `${Math.round(s.over * 100)}%` : '';
    }
  }

  // ---- the header and the masthead -----------------------------------------------------------------------------------
  function header(s) {
    $('mass').textContent = mass(G.massG(s));
    $('youLabel').textContent = s.phase === 0 ? (s.seen['k-name'] ? s.name : 'You') : `You, ${s.name}`;
    const d = when(s.cal, s.phase, s.calBeyond || 0);
    $('date').textContent = d;
    if (s.phase === 1) $('mLine').innerHTML = `<span>No. ${412 + Math.floor((s.t - s.phaseAt[1]) / 4)}</span><span>${d}</span><span>One Penny</span>`;
    else if (s.phase === 2) $('mLine').textContent = `Global Holdings · ${d}`;
    else if (s.phase === 3) $('mLine').textContent = d;
    if (s.phase === 0) {
      const hr = hourOf(s.cal);
      const night = hr >= 22 || hr < 6 ? 1 : hr >= 21 ? hr - 21 : hr < 7 ? 7 - hr : 0;
      app.style.setProperty('--night', night.toFixed(2));
    } else app.style.setProperty('--night', 0);
    let cap = JARCAP[s.phase];
    if (s.phase === 0) {
      const r = s._r || G.rates(s);
      cap = s.clicks < 6 ? 'Tap the jar to bubble.' : !s.ownN && G.canBuy(s, 'wild') ? 'You can afford <b>Wild yeast</b>. Tap it below to buy it.'
        : !s.own.wild ? 'Each bubble gets you closer to doubled. Double, and the baker feeds you.'
        : isFinite(r.doubling) ? `You double every <b>${Math.round(r.doubling)} s</b> on your own. Tapping helps.` : '';
    }
    if ($('jarCap').innerHTML !== cap) $('jarCap').innerHTML = cap;
  }

  // ---- every frame -------------------------------------------------------------------------------------------------
  function render(s, dt, force = false) {
    const k = G.stats(s);
    const r = s._r || G.rates(s);
    jar.draw(s, dt, {
      vessel: vesselOf(s), cap: k.cap, name: s.seen['k-name'] ? s.name : '', rye: !!s.own.rye, hooch: !!s.own.hooch,
      liveliness: Math.log10(1 + r.jarB * 3),
    });
    if (s.phase === 1 && town) town.draw(s);
    if (s.phase === 2 && world) world.draw(s, dt);
    if (s.phase === 3 && cosmos) cosmos.draw(s, dt, { rise: G.rise(s), warmth: s.warmth, over: s.over, glass: !!s.own.glass, band: !!s.seen['b-r90'] });
    textT -= dt;
    if (textT > 0 && !force) return;
    textT = .12;
    header(s);
    figs(s, r, k);
    projects(s);
    makers(s, k);
    actions(s, k);
  }

  // ---- effects -------------------------------------------------------------------------------------------------------
  function tapFx(x, y, amount) {
    const now = performance.now();
    if (now - lastTapFx < 70) return;
    lastTapFx = now;
    const wrap = $('jarWrap'), r = wrap.getBoundingClientRect();
    const e = document.createElement('span');
    e.className = 'tapfx';
    e.textContent = '+' + num(amount);
    e.style.left = (x == null ? r.width / 2 : x - r.left) + 'px';
    e.style.top = (y == null ? r.height * .3 : y - r.top - 18) + 'px';
    wrap.appendChild(e);
    setTimeout(() => e.remove(), 950);
  }

  function curtain(s, then) {
    const c = $('curtain'), P = PHASES[s.phase];
    const look = [['#f3ead6', '#2b2620', 'Fraunces'], ['#ebe5d5', '#1c1a15', 'UnifrakturMaguntia'], ['#0e2824', '#e3bd68', 'Poiret One'], ['#070920', '#f1c879', 'Cinzel']][s.phase];
    c.style.setProperty('--cbg', look[0]); c.style.setProperty('--cfg', look[1]);
    $('cT').style.fontFamily = `'${look[2]}', serif`;
    $('cN').textContent = P.numeral;
    $('cT').textContent = P.title;
    $('cS').textContent = ['', 'Pop. 6,000. One jar of you, next door.', 'Population 8.1 billion. Most of them have never heard of you.', 'There is nothing left on Earth to eat.'][s.phase];
    c.classList.add('on');
    setTimeout(() => { then(); }, 1200);
    setTimeout(() => c.classList.remove('on'), 3600);
  }

  function away(sum, s) {
    const { before: a, after: b, seconds } = sum;
    const items = [];
    if (b.b - a.b > 1) items.push(`${num(b.b - a.b)} bubbles`);
    if (b.feeds > a.feeds) items.push(`The baker fed you ${num(b.feeds - a.feeds)} time${b.feeds - a.feeds === 1 ? '' : 's'}`);
    if (b.loaves > a.loaves) items.push(`${num(b.loaves - a.loaves)} more loaves`);
    if (s.phase === 0 && b.adm - a.adm >= 1) items.push(`${num(b.adm - a.adm)} admiration`);
    if (s.phase === 1 && Math.round(b.jars) !== Math.round(a.jars)) items.push(`${Math.round(b.jars) > Math.round(a.jars) ? 'Up' : 'Down'} to ${num(Math.round(b.jars))} kitchens keeping a jar`);
    if (b.money - a.money >= 1) items.push(`${money(b.money - a.money)} more in the tin`);
    if (s.phase === 2 && b.hosts - a.hosts >= 1) items.push(`${num(b.hosts - a.hosts)} more people eating you`);
    if (s.phase === 3 && b.lnSys > a.lnSys) items.push(`${((b.lnSys - a.lnSys) / G.LN_STARS * 100).toFixed(1)}% more of everything`);
    if (!items.length) return;
    $('awayFor').textContent = `You were gone ${dur(seconds)}. You kept going.`;
    const ul = $('awayList'); ul.textContent = '';
    for (const t of items) { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }
    $('away').hidden = false;
    $('awayOk').focus({ preventScroll: true });
  }

  function ending(s, onFeed) {
    const e = $('ending');
    drawEndJar($('endJar'));
    e.hidden = false;
    requestAnimationFrame(() => e.classList.add('on'));
    const box = $('endLines'); box.textContent = '';
    ENDING.forEach((line, i) => setTimeout(() => { const p = document.createElement('p'); p.textContent = line; box.appendChild(p); }, 2200 + i * 2300));
    setTimeout(() => {
      const b = document.createElement('button'); b.id = 'endBtn'; b.textContent = 'Feed me';
      b.addEventListener('click', () => { b.remove(); onFeed(); });
      box.after(b); b.focus({ preventScroll: true });
    }, 2200 + ENDING.length * 2300 + 600);
  }
  function endCard(s, onAgain) {
    const box = $('endLines'); box.textContent = '';
    box.style.minHeight = '0';
    $('endJar').style.display = 'none';
    const p = document.createElement('p'); p.textContent = 'You feel enormous.'; box.appendChild(p);
    setTimeout(() => {
      const t = document.createElement('h1'); t.id = 'endTitle'; t.textContent = 'Starter';
      box.before(t);
      const dl = document.createElement('dl'); dl.id = 'endStats';
      const rows = [['Played for', dur(s.endedAt || s.t)], ['Taps', num(s.clicks)], ['Times fed', num(s.feeds)], ['Loaves', num(s.loaves)],
        ['Jars given away by hand', num(s.given)], ['People', num(G.PEOPLE)], ['Collapses', num(s.collapses)], ['Generation', num(s.gen)]];
      for (const [a, b] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = a; dd.textContent = b; dl.append(dt, dd); }
      box.after(dl);
      const again = document.createElement('button'); again.id = 'endBtn'; again.textContent = 'Begin again';
      const note = document.createElement('p'); note.style.cssText = 'margin:0;font-size:14px;color:#6e6354;max-width:24em';
      note.textContent = 'A spoonful of you goes into a new jar, on a new counter. It bubbles a little faster than you did.';
      again.addEventListener('click', onAgain);
      dl.after(note); note.after(again);
    }, 2400);
  }

  return { layout, render, log, tapFx, curtain, away, ending, endCard, jar, get phase() { return phase; } };
}
