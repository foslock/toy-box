// Sail: the sea chart of the voyage home, drawn in SVG like an old map. The route winds up the chart from the Far
// Isles at the bottom to home at the top, one stop for each level, through the five stretches of sea; each stop is
// its harbour's island. The boat sits at the last harbour reached, and sails on to the next when a level's been won.
const NS = 'http://www.w3.org/2000/svg';
const VW = 600, TOP = 150, STEP = 58;

function rnd(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

// where each stop is: a lazy zigzag up the chart, with a little extra room between stretches of sea
export function stops(levels) {
  const pts = [];
  let y = TOP + levels.length * STEP + (levels.at(-1).chapter) * 40 + 40;
  levels.forEach((d, n) => {
    if (n && d.chapter !== levels[n - 1].chapter) y -= 40;
    const x = VW / 2 + Math.sin(n * .95 + .6) * 170 + Math.sin(n * 2.3) * 30;
    pts.push({ x, y });
    y -= STEP;
  });
  return pts;
}

export function drawChart(host, { levels, chapters, done, open, at, sailTo, pick }) {
  const pts = stops(levels), H = pts[0].y + 150;
  const w = Math.min(host.parentElement.clientWidth - 16, 620);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${VW} ${H}`);
  svg.setAttribute('width', w); svg.setAttribute('height', w * H / VW);
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'The sea chart of the voyage home');
  const R = rnd(7);
  let s = `<defs>
    <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .4  0 0 0 0 .2  0 0 0 .16 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <radialGradient id="burn" cx="50%" cy="50%" r="75%"><stop offset="70%" stop-color="#f6e7bf" stop-opacity="0"/><stop offset="100%" stop-color="#b8843e" stop-opacity=".55"/></radialGradient>
    <pattern id="waves" width="60" height="34" patternUnits="userSpaceOnUse"><path d="M6 20q6-6 12 0t12 0" fill="none" stroke="#8fb3b8" stroke-width="2" stroke-linecap="round" opacity=".55"/></pattern>
  </defs>
  <rect x="8" y="8" width="${VW - 16}" height="${H - 16}" rx="26" fill="#f3e2b6" stroke="#3b2412" stroke-width="5"/>
  <rect x="8" y="8" width="${VW - 16}" height="${H - 16}" rx="26" fill="url(#waves)"/>
  <rect x="8" y="8" width="${VW - 16}" height="${H - 16}" rx="26" fill="#000" filter="url(#paper)" opacity=".9"/>
  <rect x="8" y="8" width="${VW - 16}" height="${H - 16}" rx="26" fill="url(#burn)"/>
  <rect x="22" y="22" width="${VW - 44}" height="${H - 44}" rx="16" fill="none" stroke="#6b4a2c" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"/>`;
  // each stretch of sea gets its name across the chart, in the clearest spot beside its stops (drawn last, over the
  // islands, with a halo of parchment)
  let labels = '', lastCh = -1;
  levels.forEach((d, n) => {
    if (d.chapter === lastCh) return;
    lastCh = d.chapter;
    const lastN = levels.findLastIndex(l => l.chapter === d.chapter), top = pts[lastN].y - STEP / 2, bottom = pts[n].y + STEP / 2;
    let best = null;
    for (const left of [true, false]) for (let y = top + 20; y <= bottom - 10; y += 8) {
      const x0 = left ? 44 : VW - 44, x1 = left ? 44 + 230 : VW - 44 - 230;   // roughly where the words run
      let clear = 1e9;
      for (const p of pts) for (let k = 0; k <= 4; k++) { const x = x0 + (x1 - x0) * k / 4; clear = Math.min(clear, Math.hypot(p.x - x, (p.y - y) * 1.6)); }
      if (!best || clear > best.clear) best = { left, y, clear };
    }
    const bx = best.left ? 44 : VW - 44;
    labels += `<text x="${bx}" y="${best.y}" text-anchor="${best.left ? 'start' : 'end'}" font-family="Pirata One, serif" font-size="30" fill="#6b4a2c" stroke="#f3e2b6" stroke-width="7" stroke-linejoin="round" paint-order="stroke" transform="rotate(${best.left ? -6 : 6} ${bx} ${best.y})">${chapters[d.chapter].name}</text>`;
    // a dashed line across the chart between stretches
    if (n) s += `<path d="M40 ${pts[n].y + STEP / 2 + 20} Q ${VW / 2} ${pts[n].y + STEP / 2 + 5} ${VW - 40} ${pts[n].y + STEP / 2 + 20}" fill="none" stroke="#9a7a55" stroke-width="2" stroke-dasharray="10 8" opacity=".6"/>`;
  });
  // an island for each harbour, and a few just for the look
  const island = (x, y, r, seed, tone = '#b8d98a') => {
    const q = rnd(seed), k = 11, p = [];
    for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2, rr = r * (.75 + q() * .45); p.push([x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr * .85]); }
    const d = p.map((v, i) => { const n = p[(i + 1) % k], m = [(v[0] + n[0]) / 2, (v[1] + n[1]) / 2]; return `${i ? '' : `M${((p[k - 1][0] + v[0]) / 2).toFixed(1)} ${((p[k - 1][1] + v[1]) / 2).toFixed(1)}`} Q${v[0].toFixed(1)} ${v[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; }).join(' ') + 'Z';
    return `<path d="${d}" fill="#8fc9c8" opacity=".5" transform="translate(0 3) scale(1)" /><path d="${d}" fill="#ecd59c" stroke="#3b2412" stroke-width="3"/><path d="${d}" fill="${tone}" transform="translate(${x} ${y}) scale(.62) translate(${-x} ${-y})"/>`;
  };
  for (let i = 0; i < 14; i++) {
    const y = 120 + R() * (H - 240), x = R() < .5 ? 50 + R() * 60 : VW - 50 - R() * 60;
    if (pts.some(p => Math.hypot(p.x - x, p.y - y) < 70)) continue;
    s += island(x, y, 14 + R() * 14, i + 50, '#c7dc9a');
  }
  pts.forEach((p, n) => { const q = rnd(n + 3); s += island(p.x + (q() - .5) * 20, p.y + 14, 22 + q() * 6, n + 1, n === levels.length - 1 ? '#a8d47a' : '#b8d98a'); });
  // the route: dotted all the way, inked in red as far as the crew have sailed
  const path = pts.map((p, i) => i ? `S ${((pts[i - 1].x + p.x) / 2 + (i % 2 ? 40 : -40)).toFixed(1)} ${((pts[i - 1].y + p.y) / 2).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  s += `<path id="route" d="${path}" fill="none" stroke="#6b4a2c" stroke-width="4" stroke-dasharray="1 12" stroke-linecap="round"/>`;
  const reached = Math.max(0, Math.min(open, levels.length - 1));
  const donePath = pts.slice(0, reached + 1).map((p, i) => i ? `S ${((pts[i - 1].x + p.x) / 2 + (i % 2 ? 40 : -40)).toFixed(1)} ${((pts[i - 1].y + p.y) / 2).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  if (reached) s += `<path id="sailed" d="${donePath}" fill="none" stroke="#c8322c" stroke-width="5" stroke-dasharray="14 9" stroke-linecap="round"/>`;
  // home, at the top: a lighthouse and a flag
  const home = pts[pts.length - 1];
  s += `<g transform="translate(${home.x + 46} ${home.y - 18})"><path d="M-8 30 L-5 -8 L5 -8 L8 30Z" fill="#fbf7ea" stroke="#3b2412" stroke-width="3"/><path d="M-6.5 18 L6.5 18 L7.3 26 L-7.3 26Z M-5.5 4 L5.5 4 L6 11 L-6 11Z" fill="#e0524a"/><rect x="-7" y="-16" width="14" height="9" rx="2" fill="#ffe27a" stroke="#3b2412" stroke-width="3"/><path d="M-9 -16 L0 -26 L9 -16Z" fill="#e0524a" stroke="#3b2412" stroke-width="3"/></g>
    <text x="${home.x}" y="${home.y - 46}" text-anchor="middle" font-family="Pirata One, serif" font-size="34" fill="#3b2412">Home</text>`;
  s += labels;
  // the stops
  pts.forEach((p, n) => {
    const isDone = done[n], isOpen = n <= open, cur = n === open && !isDone;
    s += `<g class="stop${isOpen ? '' : ' locked'}" data-n="${n}" tabindex="${isOpen ? 0 : -1}" role="button" aria-label="${n + 1}: ${levels[n].name}${isDone ? ', sailed' : isOpen ? '' : ', not yet'}">
      <circle cx="${p.x}" cy="${p.y}" r="24" fill="transparent"/>
      ${cur ? `<circle cx="${p.x}" cy="${p.y}" r="21" fill="none" stroke="#f5c542" stroke-width="5"><animate attributeName="r" values="17;25;17" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.2;1" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}
      <circle cx="${p.x}" cy="${p.y}" r="15" fill="${isDone ? '#3fae5a' : isOpen ? '#f5c542' : '#e8d8b0'}" stroke="#3b2412" stroke-width="3.5" opacity="${isOpen ? 1 : .75}"/>
      <text x="${p.x}" y="${p.y + 6}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="16" fill="${isDone ? '#fff' : '#3b2412'}" opacity="${isOpen ? 1 : .6}">${n + 1}</text>
    </g>`;
  });
  // a compass rose, bottom right
  const cx = VW - 90, cy = H - 110;
  s += `<g transform="translate(${cx} ${cy})" opacity=".85"><circle r="34" fill="#f6e7bf" stroke="#6b4a2c" stroke-width="3"/><path d="M0 -44 L7 0 L0 44 L-7 0Z" fill="#c8322c" stroke="#3b2412" stroke-width="2.5"/><path d="M-44 0 L0 -7 L44 0 L0 7Z" fill="#fbf7ea" stroke="#3b2412" stroke-width="2.5"/><text y="-50" text-anchor="middle" font-family="Pirata One, serif" font-size="22" fill="#3b2412">N</text></g>`;
  // and a sea monster, because every old chart has one
  s += `<g transform="translate(92 ${H - 150})" opacity=".7" fill="none" stroke="#3b6e7a" stroke-width="4" stroke-linecap="round"><path d="M-40 10 q10 -26 22 0 q10 -26 22 0 q10 -26 22 0"/><path d="M26 10 q8 -34 22 -30 q10 4 2 10" /><circle cx="44" cy="-24" r="1.5" fill="#3b6e7a"/></g>`;
  // the boat
  s += `<g id="chartBoat"><path d="M-16 4 L16 4 L11 13 L-11 13Z" fill="#d9463c" stroke="#3b2412" stroke-width="3" stroke-linejoin="round"/><path d="M-1 3 L-1 -24" stroke="#3b2412" stroke-width="3"/><path d="M1 -22 Q15 -12 13 1 L1 1Z" fill="#fbf7ea" stroke="#3b2412" stroke-width="3" stroke-linejoin="round"/></g>`;
  svg.innerHTML = s;
  host.textContent = '';
  host.append(svg);
  svg.querySelectorAll('.stop').forEach(g => {
    const n = +g.dataset.n;
    g.addEventListener('click', () => pick(n));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(n); } });
  });
  // put the boat at the last harbour, and sail it on if a level's just been won
  const boat = svg.querySelector('#chartBoat');
  const put = p => boat.setAttribute('transform', `translate(${p.x - 26} ${p.y - 6})`);
  const from = sailTo != null ? pts[Math.max(0, sailTo - 1)] : pts[Math.min(at, pts.length - 1)];
  put(from);
  const scroller = host.closest('.chart');
  const scale = w / VW;
  scroller.scrollTop = Math.max(0, from.y * scale - scroller.clientHeight * .55);
  if (sailTo != null && sailTo > 0) {
    const route = svg.querySelector('#route'), total = route.getTotalLength();
    // how far along the route each stop is
    const lens = [];
    for (let i = 0, L = 0; L <= total && i < pts.length; L += 2) { const q = route.getPointAtLength(L); if (Math.hypot(q.x - pts[i].x, q.y - pts[i].y) < 3) { lens[i] = L; i++; } }
    const a = lens[sailTo - 1] ?? 0, b = lens[sailTo] ?? total, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0 - 400) / 1500);
      if (k > 0) { const e = k * k * (3 - 2 * k), q = route.getPointAtLength(a + (b - a) * e); put(q); scroller.scrollTop = Math.max(0, q.y * scale - scroller.clientHeight * .55); }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
