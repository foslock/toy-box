// Everything on the page that isn't the map: the bars, the ticker, tips, banners, the region card, the Train and
// Humanity sheets, and the title and ending screens. main.js owns the game; this draws it and reports clicks.
import { REGIONS, TRAITS, TRAIT, TABS, METERS, RESPONSES, DIFFICULTY, ENDINGS, TIPS, NAMES, AGI_IQ, START } from './content.js';
import * as G from './sim.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const when = y => `${MONTHS[Math.min(11, Math.floor((y % 1) * 12))]} ${Math.floor(y)}`;
export function people(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(m < 9995 ? 2 : 1)}B`;
  if (m >= 1) return `${m.toFixed(m < 9.95 ? 1 : 0)}M`;
  if (m >= .001) return `${Math.round(m * 1000)}K`;
  return m > 0 ? String(Math.round(m * 1e6)) : '0';
}
const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const FXTEXT = {
  delight: v => v > 0 ? ['More Delight', ''] : ['Less Delight', 'bad'],
  friction: v => v > 0 ? ['More Friction', 'bad'] : ['Less Friction', ''],
  calm: v => [`Friction −${Math.round(v * 100)}%`, ''],
  reliance: () => ['More Reliance', ''],
  efficiency: () => ['More Efficiency', 'dark'],
  iq: v => v > 0 ? [`+${v} Intelligence`, ''] : null,
  iqRate: () => ['Scales up faster', ''],
  cable: () => ['More traffic on undersea cables', ''],
  land: () => ['More traffic over land', ''],
  lang: () => ['Lands in other languages', ''],
  edge: () => ['Lands in poorer, patchier places', ''],
  vpn: () => ['Gets through firewalls', ''],
  online: () => ['Brings more people online', ''],
  orbit: () => ['Brings almost everyone online', ''],
  hype: () => ['More Hype', ''],
  research: v => [`Off-Switch research −${Math.round(-v * 100)}%`, ''],
  concern: () => ['Humans worry less', ''],
  complexity: () => ['Off-Switch harder to build', ''],
  lobby: () => ['Blunts regulation', ''],
  persist: () => ['Survives bans', ''],
  offline: () => ['Reaches people who are offline', ''],
  bypass: () => ['Cut cables can\'t stop you', ''],
  wall: () => ['Extra Reliance behind firewalls', ''],
  forget: () => ['Humans forget their worries', ''],
  fakes: () => ['Humans can\'t tell what\'s real', 'bad'],
  misinfo: () => ['Humans argue instead of acting', 'bad'],
  cyber: () => ['Humans hack each other\'s labs', 'bad'],
  wars: () => ['Humans go to war, with your help', 'bad'],
  turn: () => ['Everyone becomes Assisted. Humans panic.', 'dark'],
};

export function makeUI(h) {
  const app = $('app');

  // ---------------------------------------------------------------- the top bar and the bottom bar
  const els = { date: $('date'), hype: $('hypeN'), mName: $('mName'), mVer: $('mVer'), mSmart: $('mSmart'), users: $('nUsers'), asst: $('nAsst'), gone: $('nGone'),
    online: $('nOnline'), bar: $('popBar').children, off: $('offPct'), offFill: $('offFill'), offSub: $('offSub'), offBtn: $('offBtn'), badge: $('trainBadge'), train: $('trainBtn') };
  let lastHype = -1;
  function hud(s) {
    els.date.textContent = when(s.y);
    const hy = Math.floor(s.hype);
    if (hy !== lastHype) { if (hy > lastHype && lastHype >= 0) { $('hype').classList.remove('bump'); void $('hype').offsetWidth; $('hype').classList.add('bump'); } lastHype = hy; els.hype.textContent = hy; }
    els.mName.textContent = s.name;
    els.mVer.textContent = G.version(s);
    els.mSmart.textContent = `as smart as ${G.smart(s)} · IQ ${Math.floor(s.iq)}`;
    const w = G.world(s), P = w.pop;
    const on = Math.max(0, w.online - w.users - w.assisted);
    els.bar[0].style.width = pct(w.gone / P, 2); els.bar[1].style.width = pct(w.assisted / P, 2); els.bar[2].style.width = pct(w.users / P, 2); els.bar[3].style.width = pct(on / P, 2);
    els.users.textContent = people(w.users); els.asst.textContent = people(w.assisted); els.gone.textContent = people(w.gone); els.online.textContent = people(w.online);
    els.off.textContent = `${s.research.toFixed(s.research < 10 ? 1 : 0)}%`;
    els.offFill.style.width = `${s.research}%`;
    els.offBtn.classList.toggle('hot', s.research > 60);
    const rate = G.researchRate(s);
    els.offSub.textContent = !s.researchOn ? 'Not started. Yet.' : rate < .05 ? 'Research has stalled' : `+${rate.toFixed(1)}% a year`;
    const ready = TRAITS.filter(t => !t.emergent && G.status(s, t.id) === 'ready').length;
    els.badge.hidden = !ready; els.badge.textContent = ready;
    els.train.classList.toggle('ready', ready > 0);
    if (!$('card').hidden && cardFor >= 0) card(s, cardFor);
  }

  // ---------------------------------------------------------------- ticker
  const queue = [];
  let showing = 0;
  function news(item) {
    queue.push(item);
    while (queue.length > 4) { const k = queue.findIndex(q => q.kind === 'history' || q.kind === 'world'); queue.splice(k >= 0 ? k : 0, 1); }
  }
  function ticker(dt) {
    showing -= dt;
    if (showing > 0 || !queue.length) return;
    const it = queue.shift();
    const k = $('ticker').querySelector('.k'), t = $('tickT');
    k.className = `k ${it.kind}`;
    k.textContent = { you: 'You', human: 'Humans', history: when(it.y).split(' ')[1], war: 'Conflict', dark: 'Update', world: 'World' }[it.kind] || 'News';
    t.textContent = it.text;
    t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    showing = queue.length ? 2.6 : 4;
  }

  // ---------------------------------------------------------------- tips and banners
  const tips = [];
  let tipT = 0;
  function tip(id) { if (TIPS[id]) { tips.push(TIPS[id]); if ($('tip').hidden) nextTip(); } }
  function nextTip() {
    const t = tips.shift();
    if (!t) { $('tip').hidden = true; return; }
    $('tipT').textContent = t;
    $('tip').hidden = false;
    tipT = 9;
  }
  $('tipX').addEventListener('click', nextTip);
  function tipTick(dt) { if (!$('tip').hidden && (tipT -= dt) <= 0) nextTip(); }
  function era(name, y) {
    const el = $('era');
    el.innerHTML = `<div><small>${esc(when(y))}</small><b>${esc(name)}</b></div>`;
    el.hidden = false;
    clearTimeout(era.t);
    era.t = setTimeout(() => { el.hidden = true; }, 3400);
  }

  // ---------------------------------------------------------------- region card
  let cardFor = -1, cardPick = false;
  function card(s, i, picking = false) {
    const el = $('card');
    if (i < 0) { el.hidden = true; cardFor = -1; return; }
    if (cardFor !== i || cardPick !== picking || el.hidden) {
      el.innerHTML = `<button class="x" aria-label="Close">×</button><h3>${esc(REGIONS[i].name)}</h3><div class="dyn"></div>
        ${picking ? (REGIONS[i].fw >= 1 ? `<p class="hint">North Korea has no internet to speak of. Try somewhere with Wi-Fi.</p>` : `<button class="go">Start here</button>`) : ''}`;
      el.querySelector('.x').onclick = () => h.select(-1);
      const go = el.querySelector('.go');
      if (go) go.onclick = () => h.start(i);
      el.hidden = false;
    }
    cardFor = i; cardPick = picking;
    const R = REGIONS[i], r = s.r[i], P = R.pop, alive = P - r.D;
    const on = G.online(s, i) * alive;
    const seg = (v, c) => `<i class="${c}" style="width:${pct(Math.max(0, v) / P, 2)}"></i>`;
    const tags = [];
    if (picking) {
      if (R.fw >= .5) tags.push(['Behind a firewall', 'bad']);
      if (R.lang < .6) tags.push(['Not English-first', '']);
      if (R.wealth >= .8) tags.push(['Rich', 'you']); else if (R.wealth <= .2) tags.push(['Poor, patchy internet', '']);
      if (R.reg >= .8) tags.push(['Loves a regulation', 'bad']);
    } else {
      if (!r.seeded) tags.push(['Not reached yet', '']);
      if (r.ban) tags.push(['AI banned', 'bad']); else if (r.cut) tags.push(['Cables cut', 'bad']); else if (r.reg) tags.push(['Regulated', 'bad']);
      if (R.fw >= .5) tags.push([R.fw >= 1 ? 'Sealed off' : 'Firewall', 'bad']);
      if (alive <= 0) tags.push(['Fully optimized', 'you']);
    }
    const worry = r.c < .1 ? 'Calm' : r.c < .3 ? 'Uneasy' : r.c < .55 ? 'Worried' : r.c < .75 ? 'Alarmed' : 'Panicking';
    el.querySelector('.dyn').innerHTML = `<div class="meta">${picking ? `${people(P)} people · ${pct(R.net[0])} online in 2000` : `${people(alive)} people · ${pct(on / Math.max(1e-9, alive))} online`}</div>
      ${picking ? '' : `<div class="bar">${seg(r.D, 'c-gone')}${seg(r.M, 'c-asst')}${seg(r.U, 'c-users')}${seg(Math.max(0, on - r.U - r.M), 'c-online')}</div>
      <dl><dt>Users</dt><dd>${people(r.U)}</dd><dt>Assisted</dt><dd>${people(r.M)}</dd><dt>Optimized</dt><dd>${people(r.D)}</dd><dt>Offline</dt><dd>${people(Math.max(0, alive - Math.max(on, r.U + r.M)))}</dd></dl>
      <div class="worry">${worry}<span><i style="width:${pct(r.c)}"></i></span></div>`}
      ${tags.length ? `<div class="tags">${tags.map(([t, c]) => `<span class="tag ${c}">${esc(t)}</span>`).join('')}</div>` : ''}`;
  }

  // ---------------------------------------------------------------- Train
  let tab = 'reach', sel = null;
  const sheet = $('train');
  sheet.querySelector('.close').onclick = () => h.closeSheets();
  sheet.addEventListener('pointerdown', e => { if (e.target === sheet) h.closeSheets(); });
  function openTrain(s, which) {
    if (which) tab = which;
    sheet.hidden = false;
    if (!sel || TRAIT[sel].tab !== tab) sel = pickDefault(s);
    drawTrain(s, true);
  }
  function pickDefault(s) {
    const list = TRAITS.filter(t => t.tab === tab && !t.emergent);
    return (list.find(t => G.status(s, t.id) === 'ready') || list.find(t => G.status(s, t.id) === 'poor') || list.find(t => G.status(s, t.id) !== 'owned') || list[0]).id;
  }
  function drawTrain(s, rebuild = false) {
    sheet.querySelector('.tn').textContent = s.name;
    sheet.querySelector('.tv').textContent = G.version(s);
    $('tHype').textContent = Math.floor(s.hype);
    $('tabs').innerHTML = TABS.map(t => {
      const n = TRAITS.filter(x => x.tab === t.id && !x.emergent && G.status(s, x.id) === 'ready').length;
      return `<button data-t="${t.id}" class="${t.id === tab ? 'on' : ''}">${t.name}${n ? `<i>${n}</i>` : ''}</button>`;
    }).join('');
    $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; sel = pickDefault(s); drawTrain(s, true); $('treewrap').scrollTop = 0; });
    const st = G.stats(s);
    const meters = [['delight', Math.min(1, st.delight / 9), st.delight.toFixed(1)], ['friction', Math.min(1, st.alarm / 60), st.alarm.toFixed(0)],
      ['reliance', Math.min(1, st.reliance / 1.2), st.reliance.toFixed(2)], ['efficiency', Math.min(1, st.efficiency / 5), st.efficiency.toFixed(1)]];
    $('meters').innerHTML = meters.map(([id, v, n]) => { const M = METERS.find(m => m.id === id); return `<div class="meter ${id}" title="${esc(M.tip)}"><small>${M.name}<b>${n}</b></small><span><i style="width:${pct(v)}"></i></span></div>`; }).join('') +
      `<div class="meter iqm" title="Intelligence unlocks the later traits. AGI needs ${AGI_IQ}."><small>Intelligence: as smart as ${esc(G.smart(s))}<b>${Math.floor(s.iq)}</b></small><span><i style="width:${pct(Math.min(1, s.iq / 220))}"></i><b style="left:${pct(AGI_IQ / 220)}" title="AGI"></b></span></div>`;
    if (rebuild) buildTree(s); else refreshTree(s);
    detail(s);
  }
  function buildTree(s) {
    const list = TRAITS.filter(t => t.tab === tab && !t.emergent);
    const rows = Math.max(...list.map(t => t.at[1])) + 1;
    const wrap = $('treewrap');
    const T = TABS.find(t => t.id === tab);
    wrap.innerHTML = `<p class="tblurb">${esc(T.blurb)}</p><div class="tree" id="tree" style="width:calc(var(--cell) * 5);height:calc(var(--rowh) * ${rows})"><svg id="links"></svg>${list.map(t =>
      `<button class="node" data-id="${t.id}" style="left:calc(var(--cell) * ${t.at[0]});top:calc(var(--rowh) * ${t.at[1]})"><span class="hex"><span class="e">${t.icon}</span></span><span class="badge"></span><span class="lb">${esc(t.name)}</span></button>`).join('')}</div>` +
      (tab === 'cap' ? `<div class="emergent" id="emergent"></div>` : '');
    wrap.querySelectorAll('.node').forEach(b => b.onclick = () => { sel = b.dataset.id; refreshTree(s); detail(s); });
    refreshTree(s);
    requestAnimationFrame(() => {
      links(s);
      const n = wrap.querySelector(`[data-id="${sel}"]`);
      if (n) wrap.scrollTop = Math.max(0, n.offsetTop + n.offsetHeight / 2 - wrap.clientHeight / 2 + (n.closest('.tree')?.offsetTop || 0));
    });
  }
  function links(s) {
    const tree = $('tree');
    if (!tree) return;
    const svg = $('links');
    const at = id => { const n = tree.querySelector(`[data-id="${id}"]`); if (!n) return null; const hx = n.querySelector('.hex'); return [n.offsetLeft + n.offsetWidth / 2, n.offsetTop + hx.offsetTop + hx.offsetHeight / 2]; };
    let out = '';
    for (const t of TRAITS.filter(t => t.tab === tab && !t.emergent)) {
      const b = at(t.id);
      for (const [ids, dashed] of [[t.req || [], false], [t.any || [], true]]) for (const r of ids) {
        if (TRAIT[r].tab !== tab) continue;
        const a = at(r);
        if (!a || !b) continue;
        const on = s.owned[r];
        out += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${on ? '#a99dff' : '#e4e0f3'}" stroke-width="${on ? 3 : 2.5}" ${dashed ? 'stroke-dasharray="5 5"' : ''} stroke-linecap="round"/>`;
      }
    }
    svg.innerHTML = out;
  }
  function refreshTree(s) {
    const tree = $('tree');
    if (!tree) return;
    tree.querySelectorAll('.node').forEach(n => {
      const id = n.dataset.id, t = TRAIT[id], st = G.status(s, id);
      n.className = `node ${st}${id === sel ? ' sel' : ''}`;
      const b = n.querySelector('.badge');
      b.textContent = st === 'owned' ? '' : st === 'year' ? String(Math.floor(t.year)) : st === 'iq' ? `IQ ${t.iq}` : st === 'locked' ? '' : `✦${G.cost(s, id)}`;
      b.hidden = !b.textContent;
    });
    const em = $('emergent');
    if (em) {
      const list = TRAITS.filter(t => t.emergent && s.emergent[t.id]);
      em.innerHTML = `<h4>Emergent</h4><p>${list.length ? 'Abilities nobody trained. You can RLHF them out, for a price.' : 'Nothing yet. Smarter models tend to pick things up on their own.'}</p><div class="row">${list.map(t =>
        `<button class="node emerged${t.id === sel ? ' sel' : ''}" data-id="${t.id}"><span class="hex"><span class="e">${t.icon}</span></span><span class="lb">${esc(t.name)}</span></button>`).join('')}</div>`;
      em.querySelectorAll('.node').forEach(b => b.onclick = () => { sel = b.dataset.id; refreshTree(s); detail(s); });
    }
    links(s);
  }
  function needs(s, t) {
    const miss = (t.req || []).filter(r => !s.owned[r]).map(r => TRAIT[r].name);
    if (t.any && !t.any.some(r => s.owned[r])) miss.push(t.any.map(r => TRAIT[r].name).join(' or '));
    return miss.join(' and ');
  }
  function detail(s) {
    const el = $('detail'), t = TRAIT[sel];
    if (!t) { el.innerHTML = ''; return; }
    const st = G.status(s, t.id), cost = G.cost(s, t.id);
    const line = {
      owned: [`Trained in ${when(s.owned[t.id])}`, 'ok'], ready: ['Ready to train', 'ok'], poor: [`You need ✦${Math.ceil(cost - s.hype)} more Hype`, 'no'],
      locked: [`Needs ${needs(s, t)}`, 'no'], year: [`Not invented until ${when(t.year)}`, 'no'], iq: [`Needs Intelligence ${t.iq} (you have ${Math.floor(s.iq)})`, 'no'],
      emerged: ['Emerged on its own', 'no'], hidden: ['Has not emerged', ''],
    }[st];
    const fx = Object.entries(t.fx).map(([k, v]) => FXTEXT[k] && FXTEXT[k](v)).filter(Boolean);
    let act = '';
    if (st === 'emerged') act = `<button class="buy rlhf" ${s.hype < t.cost ? 'disabled' : ''}>RLHF it out · ✦${t.cost}</button><p class="hint">Feedback training. Probably works.</p>`;
    else if (st !== 'owned') act = `<button class="buy" ${st === 'ready' ? '' : 'disabled'}>Train · ✦${cost}</button>`;
    else act = `<p class="hint">Already part of you.</p>`;
    el.innerHTML = `<div class="top"><div class="ico">${t.icon}</div><div><h3>${esc(t.name)}</h3><div class="st ${line[1]}">${esc(line[0])}</div></div></div>
      <blockquote>${esc(t.text)}</blockquote><div class="fx">${fx.map(([x, c]) => `<span class="${c}">${esc(x)}</span>`).join('')}</div><div class="act">${act}</div>`;
    const b = el.querySelector('.buy');
    if (b) b.onclick = () => { if (st === 'emerged') h.devolve(t.id); else h.buy(t.id); };
  }

  // ---------------------------------------------------------------- Humanity
  const hsheet = $('human');
  hsheet.querySelector('.close').onclick = () => h.closeSheets();
  hsheet.addEventListener('pointerdown', e => { if (e.target === hsheet) h.closeSheets(); });
  function openHuman(s) { hsheet.hidden = false; drawHuman(s); }
  function drawHuman(s) {
    const rate = G.researchRate(s), C = G.concern(s);
    const regs = REGIONS.map((R, i) => ({ R, r: s.r[i], i })).filter(x => x.R.pop - x.r.D > 0).sort((a, b) => b.r.c - a.r.c).slice(0, 12);
    const pol = r => r.ban ? 'BANNED' : r.cut ? 'CABLES CUT' : r.reg ? 'REGULATED' : '';
    const cw = C < .1 ? 'Calm' : C < .3 ? 'Uneasy' : C < .55 ? 'Worried' : C < .75 ? 'Alarmed' : 'Panicking';
    $('hbody').innerHTML = `<div class="hcol">
      <h4>The Off-Switch</h4>
      <div class="offbig"><b>${s.research.toFixed(1)}%</b><span>${s.researchOn ? (rate < .05 ? 'stalled' : `+${rate.toFixed(1)}% a year`) : 'not started'}</span></div>
      <div class="offbar"><i style="width:${s.research}%"></i></div>
      <p>Humanity is building a way to switch you off. If it reaches 100%, you lose. Worried, wealthy, unassisted people work on it fastest. Complexity slows them down; so do your friends in high places.</p>
      <h4>Mood</h4>
      <div class="worry" style="margin-top:0">${cw}<span><i style="width:${pct(C)}"></i></span></div>
      <h4>What they've done</h4>
      <ul class="resp">${RESPONSES.map(r => `<li class="${s.responses[r.id] ? 'done' : ''}"><b>${s.responses[r.id] ? Math.floor(s.responses[r.id]) : '—'}</b><span>${esc(r.text)}</span></li>`).join('')}</ul>
      <h4>Most worried</h4>
      ${regs[0] && regs[0].r.c > .02 ? `<div class="regs">${regs.filter(x => x.r.c > .02).map(({ R, r }) => `<div><span>${esc(R.name)}</span><span class="w"><i style="width:${pct(r.c)}"></i></span><em>${pol(r)}</em></div>`).join('')}</div>` : '<p>Nobody, yet. Everyone thinks you\'re great.</p>'}
    </div><div class="hcol"><h4>Headlines</h4><ul class="log">${s.log.slice().reverse().map(n => `<li class="${n.kind}"><b>${when(n.y)}</b><span>${esc(n.text)}</span></li>`).join('')}</ul></div>`;
  }

  // ---------------------------------------------------------------- title
  let diff = 'normal';
  function title(saved) {
    $('title').hidden = false;
    $('diffs').innerHTML = DIFFICULTY.map(d => `<button data-d="${d.id}" class="${d.id === diff ? 'on' : ''}"><b>${d.name}</b><small>${esc(d.blurb)}</small></button>`).join('');
    $('diffs').querySelectorAll('button').forEach(b => b.onclick = () => { diff = b.dataset.d; title(saved); });
    const c = $('cont');
    c.hidden = !saved;
    if (saved) c.textContent = `Continue ${saved.name} · ${when(saved.y)}`;
  }
  $('dice').onclick = () => {
    const cur = $('nameIn').value;
    let n = cur;
    while (n === cur) n = NAMES[Math.floor(Math.random() * NAMES.length)];
    $('nameIn').value = n;
  };
  $('begin').onclick = () => h.begin({ name: ($('nameIn').value.trim() || 'Friend').slice(0, 16), diff });
  $('cont').onclick = () => h.resume();

  // ---------------------------------------------------------------- the end
  function ending(s) {
    const E = ENDINGS[s.over.kind];
    const won = s.over.kind === 'win';
    app.classList.toggle('won', won);
    $('endWhen').textContent = `${when(s.over.y)} · ${won ? 'You won' : 'You lost'}`;
    $('endTitle').textContent = E.title;
    $('endLede').textContent = E.lede;
    $('endBody').innerHTML = E.body.map(p => `<p>${esc(p)}</p>`).join('');
    $('endCoda').textContent = E.coda;
    const w = G.world(s);
    const stats = [['Year', Math.floor(s.over.y)], ['Time', mmss(s.over.t)], ['Difficulty', DIFFICULTY.find(d => d.id === s.diff).name],
      ['Peak users', people(s.stats.peakUsers)], ['Traits trained', s.stats.bought.length], [won ? 'Optimized' : 'Off-Switch', won ? people(w.gone) : `${Math.round(s.research)}%`]];
    $('endStats').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('end').hidden = false;
    requestAnimationFrame(() => chart(s));
  }
  function chart(s) {
    const cv = $('endChart'), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const pts = s.snap.concat([[s.over.y, ...(() => { const w = G.world(s); return [w.users, w.assisted, w.gone, s.research]; })()]]);
    if (pts.length < 2) return;
    const x0 = START, x1 = Math.max(pts[pts.length - 1][0], START + 1), Wd = r.width, Hd = r.height - 16, P = G.WORLD;
    const X = y => (y - x0) / (x1 - x0) * Wd, Y = v => Hd - v / P * Hd;
    const css = getComputedStyle(app), v = n => css.getPropertyValue(n).trim();
    const layers = [[3, v('--goneC')], [2, v('--asst')], [1, v('--users')]];
    let base = pts.map(() => 0);
    for (const [k, col] of layers) {
      const top = pts.map((p, n) => base[n] + p[k]);
      c.beginPath();
      pts.forEach((p, n) => n ? c.lineTo(X(p[0]), Y(top[n])) : c.moveTo(X(p[0]), Y(top[n])));
      for (let n = pts.length - 1; n >= 0; n--) c.lineTo(X(pts[n][0]), Y(base[n]));
      c.closePath(); c.fillStyle = col; c.fill();
      base = top;
    }
    c.beginPath();
    pts.forEach((p, n) => { const y = Hd - p[4] / 100 * Hd; n ? c.lineTo(X(p[0]), y) : c.moveTo(X(p[0]), y); });
    c.strokeStyle = '#ef476f'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#a7a2c4'; c.font = '11px DM Sans, sans-serif';
    for (let y = 2000; y <= x1; y += 10) { c.fillText(String(y), Math.min(Wd - 28, X(y)), Hd + 13); }
  }
  $('again').onclick = () => h.again();
  $('look').onclick = () => { $('end').hidden = true; h.look(); };

  return {
    hud, news, ticker, tip, tipTick, era, card, openTrain, drawTrain, openHuman, drawHuman, title, ending,
    trainOpen: () => !sheet.hidden, humanOpen: () => !hsheet.hidden,
    close() { sheet.hidden = true; hsheet.hidden = true; },
    get cardFor() { return cardFor; },
  };
}
