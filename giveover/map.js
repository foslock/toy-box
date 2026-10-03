// The world map: a dot for every bit of land, lit by who's online, who uses you, who's Assisted and who's gone; the
// undersea cables with packets running along them; bubbles to tap. Pan with a drag, zoom with a pinch or the wheel.
import { landDots, project, W, H } from './worldmap.js';
import { REGIONS } from './content.js';
import { EDGES, N, RI, online, stats } from './sim.js';

const STEP = 5;
const DOTS = landDots(STEP);
const DX = new Float32Array(DOTS.length), DY = new Float32Array(DOTS.length), DR = new Uint8Array(DOTS.length);
const HQ = new Float32Array(DOTS.length);   // quantile of each dot's random number within its region (who comes online first)
const Q = new Float32Array(DOTS.length);    // quantile of each dot's distance from where you arrived (who you reach first)
const BY = REGIONS.map(() => []);
DOTS.forEach((d, k) => { DX[k] = d.x; DY[k] = d.y; DR[k] = RI[d.region]; BY[DR[k]].push(k); });
for (const list of BY) {
  list.sort((a, b) => DOTS[a].h - DOTS[b].h).forEach((k, n) => { HQ[k] = (n + .5) / list.length; Q[k] = HQ[k]; });
}
const SORTED = BY.map(l => l.slice());      // each region's dots in reach order
const entryOf = new Array(N).fill(null);
function setEntry(i, lonlat) {
  const [ex, ey] = project(lonlat[0], lonlat[1]);
  const list = BY[i];
  const score = new Map();
  let far = 1;
  for (const k of list) far = Math.max(far, Math.hypot(DX[k] - ex, DY[k] - ey));
  for (const k of list) score.set(k, .72 * Math.hypot(DX[k] - ex, DY[k] - ey) / far + .28 * DOTS[k].h);
  SORTED[i] = list.slice().sort((a, b) => score.get(a) - score.get(b));
  SORTED[i].forEach((k, n) => { Q[k] = (n + .5) / list.length; });
  entryOf[i] = lonlat;
}
// where each region's label sits, in world units
const AT = REGIONS.map(r => project(r.at[0], r.at[1]));

// Smooth each cable through its points (Catmull-Rom), in world units; longitudes past ±180 run off one edge and back
// in at the other, so a path can be drawn twice.
function smooth(pts, per = 10) {
  const P = pts.map(([lon, lat]) => project(lon, lat));
  if (P.length < 3) return P;
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
const ROUTES = EDGES.map(e => {
  const pts = e.sea ? smooth(e.path) : [AT[e.a], AT[e.b]];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const xs = pts.map(p => p[0]);
  const shifts = [0];
  if (Math.min(...xs) < 0) shifts.push(W);
  if (Math.max(...xs) > W) shifts.push(-W);
  return { pts, cum, len: cum[cum.length - 1], shifts };
});
function along(route, p) {
  const d = Math.max(0, Math.min(1, p)) * route.len, { cum, pts } = route;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const t = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const LIGHT = { sea: [244, 242, 251], grid: [230, 226, 244], off: [221, 217, 236], on: [186, 180, 218], offS: [214, 206, 244], onS: [178, 166, 236], users: [143, 128, 255], asst: [59, 35, 184], gone: [201, 193, 244], cable: [205, 199, 232], label: [115, 109, 150] };
const DARK = { sea: [17, 14, 34], grid: [29, 25, 54], off: [46, 40, 78], on: [78, 70, 120], offS: [52, 44, 92], onS: [88, 76, 140], users: [143, 128, 255], asst: [222, 216, 255], gone: [84, 70, 200], cable: [50, 44, 88], label: [154, 148, 196] };

export function makeMap(canvas, { onTap, onPop, pad }) {
  const ctx = canvas.getContext('2d');
  let cw = 0, ch = 0, dpr = 1;
  const view = { cx: W / 2, cy: H / 2, z: 1, fitZ: 1 };
  let fitted = false;
  const pos = new Map();          // bubble id → world [x, y]
  const fx = [];                  // ripples
  let selected = -1, picking = false, hover = -1;
  let t = 0, dusk = 0;
  const bubbleHits = [];

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    cw = r.width; ch = r.height;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    const p = pad();
    const availH = Math.max(80, ch - p.top - p.bottom);
    const prev = view.fitZ;
    view.fitZ = Math.min(cw / W, availH / H);
    if (!fitted) { fit(); fitted = true; }
    else { view.z *= view.fitZ / prev; clampView(); }
  }
  function fit(i = -1, whole = false) {
    const p = pad(), availH = Math.max(80, ch - p.top - p.bottom);
    view.z = ch > cw * 1.05 && !whole ? Math.min(view.fitZ * 2.6, Math.max(view.fitZ * 1.3, availH * .8 / H)) : view.fitZ;
    view.cx = i >= 0 ? AT[i][0] : W / 2;
    view.cy = H / 2 + 20;
    clampView();
  }
  function clampView() {
    const p = pad();
    view.z = Math.max(view.fitZ * .95, Math.min(view.fitZ * 7, view.z));
    const halfW = cw / 2 / view.z, availH = ch - p.top - p.bottom, halfH = availH / 2 / view.z;
    view.cx = W <= halfW * 2 ? W / 2 : Math.max(halfW - 20, Math.min(W - halfW + 20, view.cx));
    view.cy = H <= halfH * 2 ? H / 2 : Math.max(halfH - 30, Math.min(H - halfH + 30, view.cy));
  }
  const sx = x => (x - view.cx) * view.z + cw / 2;
  const sy = y => { const p = pad(); return (y - view.cy) * view.z + p.top + (ch - p.top - p.bottom) / 2; };
  const wx = X => (X - cw / 2) / view.z + view.cx;
  const wy = Y => { const p = pad(); return (Y - p.top - (ch - p.top - p.bottom) / 2) / view.z + view.cy; };

  // ---- input --------------------------------------------------------------------------------------------------------
  const ptrs = new Map();
  let drag = null, pinch = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false, t: performance.now() };
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, wx: wx((a.x + b.x) / 2), wy: wy((a.y + b.y) / 2) };
      if (drag) drag.moved = true;
    }
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') hover = regionAt(e.clientX - r.left, e.clientY - r.top); return; }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      view.z = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d);
      clampView();
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      view.cx += pinch.wx - wx(mx); view.cy += pinch.wy - wy(my);
      clampView();
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 7) { drag.moved = true; canvas.classList.add('dragging'); }
      if (drag.moved) { view.cx = drag.cx - dx / view.z; view.cy = drag.cy - dy / view.z; clampView(); }
    }
  });
  const end = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) {
      canvas.classList.remove('dragging');
      if (drag && !drag.moved && e.type === 'pointerup') {
        const r = canvas.getBoundingClientRect();
        tap(e.clientX - r.left, e.clientY - r.top);
      }
      drag = null;
    } else if (ptrs.size === 1) {
      const [p] = [...ptrs.values()];
      drag = { x: p.x, y: p.y, cx: view.cx, cy: view.cy, moved: true };
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { hover = -1; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const bx = wx(mx), by = wy(my);
    view.z *= Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0015));
    clampView();
    view.cx += bx - wx(mx); view.cy += by - wy(my);
    clampView();
  }, { passive: false });

  function tap(X, Y) {
    let best = null, bd = Infinity;
    for (const h of bubbleHits) { const d = Math.hypot(h.x - X, h.y - Y); if (d < h.r + 14 && d < bd) { bd = d; best = h; } }
    if (best) { onPop(best.id); return; }
    onTap(regionAt(X, Y));
  }
  function regionAt(X, Y) {
    const x = wx(X), y = wy(Y);
    const rad = Math.max(STEP * 1.6, 10 / view.z);
    let best = -1, bd = rad * rad;
    for (let k = 0; k < DOTS.length; k++) {
      const dx = DX[k] - x, dy = DY[k] - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = DR[k]; }
    }
    return best;
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------
  function render(s, dt) {
    t += dt;
    if (!cw) size();
    const st = stats(s);
    dusk += ((s.owned.turn ? 1 : 0) - dusk) * Math.min(1, dt * .9);
    if (Math.abs(dusk - (s.owned.turn ? 1 : 0)) < .002) dusk = s.owned.turn ? 1 : 0;
    const C = {};
    for (const k in LIGHT) C[k] = rgb(mix(LIGHT[k], DARK[k], dusk));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.sea;
    ctx.fillRect(0, 0, cw, ch);
    document.body.style.background = C.sea;

    // graticule
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = -180; lon <= 180; lon += 30) { const X = sx(project(lon, 0)[0]); ctx.moveTo(X, sy(0)); ctx.lineTo(X, sy(H)); }
    for (const lat of [-30, 0, 30, 60]) { const Y = sy(project(0, lat)[1]); ctx.moveTo(sx(0), Y); ctx.lineTo(sx(W), Y); }
    ctx.stroke();

    // which way each region's dots fall
    for (let i = 0; i < N; i++) {
      const r = s.r[i];
      if (r.seeded && r.entry && entryOf[i] !== r.entry && (!entryOf[i] || entryOf[i][0] !== r.entry[0] || entryOf[i][1] !== r.entry[1])) setEntry(i, r.entry);
    }
    const th = REGIONS.map((R, i) => {
      const r = s.r[i], P = R.pop;
      const g = r.D / P, m = r.M / P, u = r.U / P;
      const alive = P - r.D;
      const reached = g + m + u;
      const onFree = Math.max(0, online(s, i, st) * alive - r.U - r.M) / P;
      return { g, gm: g + m, reached, onShare: reached < 1 ? onFree / (1 - reached) : 0, seen: r.seeded };
    });

    // dots
    const z = view.z, sp = STEP * z, rad = Math.max(.7, Math.min(sp * .36, 5));
    const x0 = wx(-sp), x1 = wx(cw + sp), y0 = wy(-sp), y1 = wy(ch + sp);
    const paths = { off: new Path2D(), on: new Path2D(), offS: new Path2D(), onS: new Path2D(), users: new Path2D(), asst: new Path2D(), gone: new Path2D(), sel: new Path2D() };
    const round = rad > 1.6;
    for (let k = 0; k < DOTS.length; k++) {
      const x = DX[k], y = DY[k];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const i = DR[k], T = th[i], q = Q[k];
      const X = sx(x), Y = sy(y);
      let p;
      if (q < T.g) { const g = rad * .8; paths.gone.rect(X - g, Y - g, g * 2, g * 2); continue; }
      else if (q < T.gm) p = paths.asst;
      else if (q < T.reached) p = paths.users;
      else p = HQ[k] < T.onShare ? (T.seen ? paths.onS : paths.on) : (T.seen ? paths.offS : paths.off);
      const rr = i === selected || i === hover ? rad * 1.18 : rad;
      if (round) { p.moveTo(X + rr, Y); p.arc(X, Y, rr, 0, Math.PI * 2); } else p.rect(X - rr, Y - rr, rr * 2, rr * 2);
      if ((i === selected || (picking && i === hover)) && round) { paths.sel.moveTo(X + rr + 1.6, Y); paths.sel.arc(X, Y, rr + 1.6, 0, Math.PI * 2); }
    }
    if (selected >= 0 || picking) { ctx.fillStyle = picking ? 'rgba(108,92,255,.55)' : 'rgba(255,146,51,.85)'; ctx.fill(paths.sel); }
    ctx.fillStyle = C.off; ctx.fill(paths.off);
    ctx.fillStyle = C.on; ctx.fill(paths.on);
    ctx.fillStyle = C.offS; ctx.fill(paths.offS);
    ctx.fillStyle = C.onS; ctx.fill(paths.onS);
    ctx.fillStyle = C.users; ctx.fill(paths.users);
    ctx.fillStyle = C.asst; ctx.fill(paths.asst);
    ctx.fillStyle = C.gone; ctx.fill(paths.gone);

    // cables
    const lw = Math.max(1, Math.min(2, z * 1.1));
    for (let k = 0; k < EDGES.length; k++) {
      const e = EDGES[k], route = ROUTES[k];
      const cut = !st.bypass && (s.r[e.a].cut || s.r[e.b].cut || REGIONS[e.a].fw >= 1 || REGIONS[e.b].fw >= 1);
      ctx.lineWidth = e.sea ? lw : lw * .8;
      ctx.strokeStyle = cut ? 'rgba(239,71,111,.55)' : C.cable;
      ctx.setLineDash(e.sea ? (cut ? [4, 4] : []) : [1.5, 4]);
      for (const sh of route.shifts) {
        ctx.beginPath();
        route.pts.forEach(([x, y], n) => n ? ctx.lineTo(sx(x + sh), sy(y)) : ctx.moveTo(sx(x + sh), sy(y)));
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // packets
    for (const p of s.packets) {
      const route = ROUTES[p.e];
      const at = p.fwd ? p.p : 1 - p.p;
      const back = p.fwd ? at - .05 : at + .05;
      const [x, y] = along(route, at), [bx, by] = along(route, back);
      const col = p.blocked ? '239,71,111' : dusk > .5 ? '190,180,255' : '108,92,255';
      const size = p.seed ? 3.2 : 2.1;
      for (const sh of route.shifts) {
        const X = sx(x + sh), Y = sy(y), BX = sx(bx + sh), BY = sy(by);
        if (X < -20 || X > cw + 20) continue;
        const g = ctx.createLinearGradient(BX, BY, X, Y);
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},.75)`);
        ctx.strokeStyle = g; ctx.lineWidth = size * .9;
        ctx.beginPath(); ctx.moveTo(BX, BY); ctx.lineTo(X, Y); ctx.stroke();
        ctx.fillStyle = `rgba(${col},1)`;
        ctx.beginPath(); ctx.arc(X, Y, size, 0, Math.PI * 2); ctx.fill();
        if (p.seed) { ctx.fillStyle = `rgba(${col},.18)`; ctx.beginPath(); ctx.arc(X, Y, size * 2.6, 0, Math.PI * 2); ctx.fill(); }
      }
    }

    // policy badges: a small red ring for rules, a pill for cut cables and bans
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      const r = s.r[i];
      if (!(r.reg || r.cut || r.ban) || REGIONS[i].pop - r.D <= 0) continue;
      const X = sx(AT[i][0]), Y = sy(AT[i][1]);
      if (!r.cut && !r.ban) {
        ctx.strokeStyle = 'rgba(239,71,111,.75)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(239,71,111,.75)';
        ctx.beginPath(); ctx.arc(X, Y, 1.8, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      const text = r.ban ? 'BANNED' : 'CUT OFF';
      ctx.font = "700 9px 'DM Sans', system-ui, sans-serif";
      const w = ctx.measureText(text).width + 10;
      ctx.fillStyle = r.ban ? '#ef476f' : 'rgba(239,71,111,.85)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X - w / 2, Y - 7, w, 14, 7) : ctx.rect(X - w / 2, Y - 7, w, 14); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, X, Y + .5);
    }

    // labels: the chosen region, or all of them when zoomed in
    const showAll = z > view.fitZ * 2.3;
    ctx.font = `600 ${showAll ? 11 : 12.5}px 'DM Sans', system-ui, sans-serif`;
    for (let i = 0; i < N; i++) {
      if (!(showAll || i === selected || (picking && i === hover))) continue;
      const R = REGIONS[i];
      const X = sx(AT[i][0]), Y = sy(AT[i][1]) + (i === selected || (picking && i === hover) ? 2 : 0);
      const text = i === selected || (picking && i === hover) ? R.name : (R.short || R.name);
      ctx.lineWidth = 3.5; ctx.strokeStyle = dusk > .5 ? 'rgba(20,16,40,.85)' : 'rgba(255,255,255,.9)';
      ctx.strokeText(text, X, Y);
      ctx.fillStyle = i === selected ? (dusk > .5 ? '#fff' : '#1d1838') : C.label;
      ctx.fillText(text, X, Y);
    }

    // ripples
    for (let n = fx.length - 1; n >= 0; n--) {
      const f = fx[n], a = (t - f.t0) / f.dur;
      if (a >= 1) { fx.splice(n, 1); continue; }
      const X = sx(f.x), Y = sy(f.y);
      ctx.strokeStyle = `rgba(${f.col},${(1 - a) * .8})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X, Y, 6 + a * f.r, 0, Math.PI * 2); ctx.stroke();
    }

    // bubbles
    bubbleHits.length = 0;
    const p = pad();
    const live = new Set();
    for (const b of s.bubbles) {
      live.add(b.id);
      if (!pos.has(b.id)) pos.set(b.id, bubbleSpot(b, th));
      const [x, y] = pos.get(b.id);
      const age = s.t - b.born, left = b.life - age;
      const pop = Math.min(1, age / .35);
      const k = (1 - Math.pow(1 - pop, 3)) * (left < 1.5 ? .85 + .15 * Math.abs(Math.sin(t * 9)) : 1);
      let X = sx(x), Y = sy(y) - 4 * Math.sin(t * 2.2 + b.id);
      const R = 15 * k;
      const top = p.top + 34, bottom = ch - p.bottom - 8;
      let edge = false;
      if (X < 18 || X > cw - 18 || Y < top || Y > bottom) {
        edge = true;
        X = Math.max(22, Math.min(cw - 22, X)); Y = Math.max(top + 4, Math.min(bottom - 4, Y));
      }
      drawBubble(b, X, Y, edge ? R * .8 : R, left / b.life, edge, sx(x), sy(y));
      bubbleHits.push({ id: b.id, x: X, y: Y, r: R });
    }
    for (const id of pos.keys()) if (!live.has(id)) pos.delete(id);
  }

  function bubbleSpot(b, th) {
    const list = SORTED[b.i];
    if (!list.length) return AT[b.i];
    const T = th[b.i];
    const frac = Math.max(.15, Math.min(1, T.reached * 1.05));
    const k = list[Math.min(list.length - 1, Math.floor(b.u * frac * list.length))];
    return [DX[k], DY[k]];
  }

  function drawBubble(b, X, Y, R, life, edge, tx, ty) {
    const hype = b.k === 'hype';
    if (edge) {
      const a = Math.atan2(ty - Y, tx - X);
      ctx.fillStyle = hype ? 'rgba(255,146,51,.9)' : 'rgba(239,71,111,.9)';
      ctx.beginPath();
      ctx.moveTo(X + Math.cos(a) * (R + 9), Y + Math.sin(a) * (R + 9));
      ctx.lineTo(X + Math.cos(a + .5) * (R + 1), Y + Math.sin(a + .5) * (R + 1));
      ctx.lineTo(X + Math.cos(a - .5) * (R + 1), Y + Math.sin(a - .5) * (R + 1));
      ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = hype ? 'rgba(255,146,51,.55)' : 'rgba(239,71,111,.55)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    const g = ctx.createRadialGradient(X - R * .35, Y - R * .4, R * .1, X, Y, R);
    if (hype) { g.addColorStop(0, '#ffd27a'); g.addColorStop(1, '#ff8a2a'); } else { g.addColorStop(0, '#ff8aa3'); g.addColorStop(1, '#e8335d'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X, Y, R + 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(R * (hype ? 1.05 : 1.15))}px 'DM Sans', system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(hype ? '✦' : '!', X, Y + 1);
  }

  return {
    render, size, fit,
    select(i) { selected = i; },
    picking(on) { picking = on; },
    ripple(i, kind) {
      const at = i >= 0 && entryOf[i] && kind === 'seed' ? project(...entryOf[i]) : AT[i];
      const col = kind === 'seed' ? '108,92,255' : kind === 'gone' ? '29,24,56' : kind === 'lifted' ? '108,92,255' : '239,71,111';
      fx.push({ x: at[0], y: at[1], t0: t, dur: kind === 'seed' ? 1.4 : 1.1, r: kind === 'seed' ? 46 : 32, col });
    },
    popAt(id) {
      const h = bubbleHits.find(h => h.id === id);
      return h ? { x: h.x, y: h.y } : null;
    },
    focus(i) { view.cx = AT[i][0]; view.cy = AT[i][1]; clampView(); },
    hitBubble(X, Y) { return bubbleHits.find(h => Math.hypot(h.x - X, h.y - Y) < h.r + 14); },
    regionAtScreen(X, Y) { const r = canvas.getBoundingClientRect(); return regionAt(X - r.left, Y - r.top); },
    view,
  };
}
