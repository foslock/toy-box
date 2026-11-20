// Sun-bleached isometric dioramas, drawn as SVG strings.
// x runs down-right, y runs down-left, z is up. One tile = S px.

const S = 34, OX = 360, OY = 196;
export const VIEW = { x: 40, y: 14, w: 640, h: 530 };

export const C = {
  paper: '#f2e8d5', sand: '#e9d7b3', sandL: '#d8c094', sandR: '#c5a97c', soilL: '#bf7653', soilR: '#a15c3f',
  plaster: '#f6eee0', plasterL: '#e9dcc5', plasterR: '#d4bf9e', terra: '#c2603e', terraD: '#9a4630', terraL: '#d98a63',
  teal: '#2e7a74', tealD: '#215c57', tealL: '#86bcb1', sea: '#5aa39a', seaL: '#7fbcb2', seaD: '#3f8279', ochre: '#d8a13f', ochreD: '#b07f26',
  ink: '#3b2a21', olive: '#7d7f45', oliveL: '#a3a463', wood: '#a7764a', woodL: '#bd8c5c', woodD: '#7e5636', stone: '#cdb894', stoneD: '#b29d77',
};

export const P = (x, y, z = 0) => [(x - y) * S + OX, (x + y) * S / 2 - z * S + OY];
const f1 = (n) => Math.round(n * 10) / 10;
const pts = (a) => a.map(([x, y]) => f1(x) + ',' + f1(y)).join(' ');
const poly = (a, fill, extra = '') => `<polygon points="${pts(a)}" fill="${fill}" ${extra}/>`;

// a box with its three visible faces
function box(x, y, z, w, d, h, c = {}) {
  const t = c.top || C.plaster, l = c.left || C.plasterL, r = c.right || C.plasterR;
  return poly([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)], l)
    + poly([P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)], r)
    + poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], t);
}
// draw in a face's own coordinates: u across in tiles, t down from the top edge in tiles
const mL = (x, y, z, w, d, h) => { const [e, f] = P(x, y + d, z + h); return `matrix(${S} ${S / 2} 0 ${S} ${f1(e)} ${f1(f)})`; };
const mR = (x, y, z, w, d, h) => { const [e, f] = P(x + w, y + d, z + h); return `matrix(${S} ${-S / 2} 0 ${S} ${f1(e)} ${f1(f)})`; };
const mT = (x, y, z) => { const [e, f] = P(x, y, z); return `matrix(${S} ${S / 2} ${-S} ${S / 2} ${f1(e)} ${f1(f)})`; };
const onL = (b, inner) => `<g transform="${mL(...b)}">${inner}</g>`;
const onR = (b, inner) => `<g transform="${mR(...b)}">${inner}</g>`;
const onT = (x, y, z, inner) => `<g transform="${mT(x, y, z)}">${inner}</g>`;

// face decals, in tile units
const arch = (u, t, w, h, fill, extra = '') => { const r = w / 2; return `<path d="M${u} ${t + h}V${t + r}A${r} ${r} 0 0 1 ${u + w} ${t + r}V${t + h}Z" fill="${fill}" ${extra}/>`; };
const rect = (u, t, w, h, fill, extra = '') => `<rect x="${u}" y="${t}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const lineU = (u1, t1, u2, t2, col, sw = 0.04) => `<path d="M${u1} ${t1}L${u2} ${t2}" stroke="${col}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
// a sign painted on a wall: glyphs inside a pale plaque, still in face coordinates
function plaqueFace(u, t, words, id, col = C.terraD, size = 0.62) {
  const n = words.length, pad = 0.1, w = n * size + pad * 2;
  let s = `<g class="hit sign" data-hit="${id}">${rect(u - pad, t - pad, w, size + pad * 2, C.plaster, `stroke="${C.ink}" stroke-width=".04" rx=".06"`)}`;
  words.forEach((g, i) => { s += `<use href="#g-${g}" x="${u + i * size}" y="${t}" width="${size}" height="${size}" style="color:${col}"/>`; });
  return s + '</g>';
}

// a round thing seen from above at 2:1: a cylinder
function cyl(x, y, z, r, h, top, side, sideR) {
  const [cx, cy] = P(x, y, z + h), [, by] = P(x, y, z);
  const rx = r * S * Math.SQRT2, ry = rx / 2;
  return `<path d="M${f1(cx - rx)} ${f1(cy)}V${f1(by)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(cx + rx)} ${f1(by)}V${f1(cy)}Z" fill="${side}"/>`
    + (sideR ? `<path d="M${f1(cx)} ${f1(cy + ry)}V${f1(by + ry)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(cx + rx)} ${f1(by)}V${f1(cy)}A${f1(rx)} ${f1(ry)} 0 0 1 ${f1(cx)} ${f1(cy + ry)}Z" fill="${sideR}"/>` : '')
    + `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${top}"/>`;
}

// ---------- people ----------
const ROLES = {
  fisher: { robe: '#3c8580', skin: '#8c5a3c' },
  child: { robe: C.ochre, skin: '#b07a52', scale: 0.68 },
  baker: { robe: C.terra, skin: '#a8714e' },
  customer: { robe: C.olive, skin: '#6e4630' },
  neighbor: { robe: '#5e8f7e', skin: '#c48e64' },
  priest: { robe: '#efe4cf', skin: '#7a4b30' },
  guard: { robe: C.terraD, skin: '#9a6440' },
  traveller: { robe: '#6d7f91', skin: '#c08a62' },
};

export function figureBody(role) {
  const r = ROLES[role] || ROLES.traveller;
  const dark = 'rgba(59,42,33,.18)';
  let back = '', front = '';
  if (role === 'guard') back += `<path d="M17 -86V5" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><path d="M13.6 -84L17 -94L20.4 -84Z" fill="#9aa0a0" stroke="${C.ink}" stroke-width=".8"/>`;
  const robe = `<path d="M-13 0Q-11 -20 -8 -37H8Q11 -20 13 0Z" fill="${r.robe}"/><path d="M0 -37H8Q11 -20 13 0H0Z" fill="${dark}"/>`;
  let mid = '';
  if (role === 'baker') mid += `<path d="M-6.5 -30H6.5L9 -2H-9Z" fill="${C.plaster}"/><path d="M0 -30H6.5L9 -2H0Z" fill="rgba(59,42,33,.08)"/>`;
  if (role === 'priest') mid += `<path d="M-1.6 -37H1.6L2.4 0H-2.4Z" fill="${C.ochre}"/><circle cx="0" cy="-33" r="5" fill="${C.ochre}" stroke="${C.ochreD}" stroke-width="1"/>`;
  if (role === 'fisher') mid += `<path d="M-10 -20H10.4L10.8 -16H-10.6Z" fill="${C.ochre}"/>`;
  if (role === 'guard') mid += `<path d="M-9.5 -26H9.5L12 -2H-12Z" fill="${C.terra}"/><path d="M-9.5 -26H9.5" stroke="${C.ochre}" stroke-width="2"/><path d="M-12 -1H12" stroke="${C.ochreD}" stroke-width="2"/>`;
  if (role === 'child') mid += `<path d="M-9 -18H9" stroke="${C.terra}" stroke-width="2.2"/>`;
  const headY = -46;
  let headS = `<circle cx="0" cy="${headY}" r="8.2" fill="${r.skin}"/><path d="M0 ${headY - 8.2}A8.2 8.2 0 0 1 0 ${headY + 8.2}A5 8.2 0 0 0 0 ${headY - 8.2}Z" fill="${dark}"/>`;
  let hat = '';
  if (role === 'fisher') hat = `<ellipse cx="0" cy="${headY - 5}" rx="15" ry="4.4" fill="#dcb46b"/><path d="M-7 ${headY - 5}Q0 ${headY - 17} 7 ${headY - 5}Z" fill="#e6c27e"/>`;
  if (role === 'child') hat = `<path d="M-8.3 ${headY - 1}A8.3 8.3 0 0 1 8.3 ${headY - 1}Q4 ${headY - 5} -8.3 ${headY - 1}Z" fill="${C.ink}"/><path d="M-1 ${headY - 8}q2 -5 5 -4" stroke="${C.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if (role === 'baker') hat = `<ellipse cx="0" cy="${headY - 9}" rx="8.6" ry="5.2" fill="${C.plaster}" stroke="${C.plasterR}" stroke-width="1"/>`;
  if (role === 'customer') hat = `<path d="M-9.6 ${headY + 9}Q-11 ${headY - 11} 0 ${headY - 11}Q11 ${headY - 11} 9.6 ${headY + 9}L6.4 ${headY + 4}Q7 ${headY - 6} 0 ${headY - 6}Q-7 ${headY - 6} -6.4 ${headY + 4}Z" fill="${C.terra}"/>`;
  if (role === 'neighbor') hat = `<path d="M-9.6 ${headY + 10}Q-11 ${headY - 11} 0 ${headY - 11}Q11 ${headY - 11} 9.6 ${headY + 10}L6.4 ${headY + 4}Q7 ${headY - 5} 0 ${headY - 5}Q-7 ${headY - 5} -6.4 ${headY + 4}Z" fill="${C.plaster}"/>`;
  if (role === 'priest') hat = `<path d="M-7.4 ${headY - 5}L0 ${headY - 27}L7.4 ${headY - 5}Z" fill="${C.ochre}"/><path d="M0 ${headY - 27}L7.4 ${headY - 5}H0Z" fill="${dark}"/><circle cx="0" cy="${headY - 14}" r="2.4" fill="${C.plaster}"/>`;
  if (role === 'guard') hat = `<path d="M-8.8 ${headY - 1}A8.8 8.8 0 0 1 8.8 ${headY - 1}Z" fill="#b98a3e"/><path d="M-8.8 ${headY - 1}H8.8" stroke="${C.ochreD}" stroke-width="2"/><path d="M-7 ${headY - 10}Q0 ${headY - 20} 7 ${headY - 10}Q0 ${headY - 14} -7 ${headY - 10}Z" fill="${C.terra}"/>`;
  if (role === 'traveller') hat = `<path d="M-8.3 ${headY - 1}A8.3 8.3 0 0 1 8.3 ${headY - 1}Z" fill="#5a3f30"/>`;
  const armCol = role === 'priest' ? '#e2d4b8' : 'rgba(0,0,0,0)';
  const arm = (side) => `<g transform="translate(${side * 7.4},-33)"><g class="arm ${side > 0 ? 'arm-r' : 'arm-l'}"><path d="M0 0L${side * 3.6} 15" stroke="${r.robe}" stroke-width="5.4" stroke-linecap="round"/><path d="M0 0L${side * 3.6} 15" stroke="${role === 'priest' ? armCol : 'rgba(59,42,33,.18)'}" stroke-width="5.4" stroke-linecap="round"/><circle cx="${side * 3.9}" cy="17" r="2.7" fill="${r.skin}"/></g></g>`;
  if (role === 'neighbor') front += `<g transform="translate(-13,-14)"><path d="M-4 -6Q-6 4 0 7Q6 4 4 -6Q2 -9 2 -11H-2Q-2 -9 -4 -6Z" fill="${C.terra}"/><path d="M0 -6Q4 -4 4 -6Q6 4 0 7Z" fill="${C.terraD}" opacity=".5"/></g>`;
  if (role === 'guard') front += `<g transform="translate(-12,-22)"><ellipse cx="0" cy="0" rx="7.5" ry="11" fill="${C.teal}" stroke="${C.ochre}" stroke-width="2"/><circle cx="0" cy="0" r="2.4" fill="${C.ochre}"/></g>`;
  return back + robe + mid + arm(-1) + arm(1) + headS + hat + front;
}

function figure(role, id, x, y, extra = '') {
  const [sx, sy] = P(x, y);
  const sc = (ROLES[role] && ROLES[role].scale) || 1;
  const delay = (Math.abs(Math.sin(x * 7 + y * 3)) * 2).toFixed(2);
  return `<g class="npc hit" data-hit="${id}" transform="translate(${f1(sx)},${f1(sy)})">`
    + `<ellipse cx="0" cy="0" rx="${15 * sc}" ry="${6 * sc}" fill="rgba(59,42,33,.18)"/>`
    + `<g transform="scale(${sc})"><g class="bob" style="animation-delay:-${delay}s">${figureBody(role)}</g></g>${extra}`
    + `<rect x="${-24 * sc}" y="${-92 * sc}" width="${48 * sc}" height="${98 * sc}" fill="transparent"/></g>`;
}

// ---------- props ----------
function fishShape(sx, sy, s = 1, col = '#8fa7a4', flip = 1) {
  return `<g transform="translate(${f1(sx)},${f1(sy)}) scale(${s * flip},${s})"><path d="M-7 0Q-1 -5 5 0Q-1 5 -7 0Z" fill="${col}" stroke="${C.ink}" stroke-width=".7"/><path d="M5 0L9 -3V3Z" fill="${col}" stroke="${C.ink}" stroke-width=".7"/><circle cx="-4" cy="-.6" r=".9" fill="${C.ink}"/></g>`;
}
function basket(x, y, n, id, cloth) {
  const [cx, cy] = P(x, y, 0.42);
  let s = `<g class="pt" data-pt="${id}">`;
  if (cloth) s += onT(x - 0.62, y - 0.62, 0, `<rect width="1.24" height="1.24" fill="${C.terra}" opacity=".85"/><path d="M.1 .1H1.14V1.14H.1Z" fill="none" stroke="${C.plaster}" stroke-width=".05" stroke-dasharray=".12 .08"/>`);
  s += cyl(x, y, 0, 0.42, 0.42, '#c79a5c', C.woodL, C.wood);
  s += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(0.42 * S * 1.414 - 3)}" ry="${f1((0.42 * S * 1.414 - 3) / 2)}" fill="#7a5532"/>`;
  const spots = [[0, -1], [-6, 1.5], [6, 1.5]];
  for (let i = 0; i < n; i++) s += fishShape(cx + spots[i][0], cy + spots[i][1] - 2, 0.9, i % 2 ? '#9cb5b0' : '#b7c6bf', i % 2 ? -1 : 1);
  return s + `<path class="ring" d="M${f1(cx - 26)} ${f1(cy + 8)}a26 13 0 1 0 52 0a26 13 0 1 0 -52 0" fill="none" stroke="${C.ochre}" stroke-width="2.4"/></g>`;
}
function pot(x, y, plant = true, col = C.terra) {
  const [cx, cy] = P(x, y, 0.5);
  return cyl(x, y, 0, 0.26, 0.5, C.terraD, col, C.terraD) + (plant ? `<g transform="translate(${f1(cx)},${f1(cy)})"><ellipse cx="-4" cy="-6" rx="7" ry="9" fill="${C.olive}"/><ellipse cx="4" cy="-9" rx="7" ry="10" fill="${C.oliveL}"/><ellipse cx="1" cy="-15" rx="5" ry="6" fill="${C.olive}"/></g>` : '');
}
function tree(x, y, kind = 'olive') {
  const [sx, sy] = P(x, y);
  if (kind === 'cypress') return `<g transform="translate(${f1(sx)},${f1(sy)})"><ellipse cx="0" cy="0" rx="13" ry="5" fill="rgba(59,42,33,.18)"/><path d="M0 -112Q15 -70 11 -18Q0 -6 -11 -18Q-15 -70 0 -112Z" fill="#4f6b45"/><path d="M0 -112Q15 -70 11 -18Q4 -10 0 -12Z" fill="#3e5737"/></g>`;
  const leaf = kind === 'lemon' ? '#7d9a4a' : '#9aa37a', leaf2 = kind === 'lemon' ? '#6a8640' : '#858e66';
  let fruit = '';
  if (kind === 'lemon') for (const [a, b] of [[-14, -62], [10, -70], [-2, -50], [18, -54], [-20, -78], [4, -86]]) fruit += `<circle cx="${a}" cy="${b}" r="3.4" fill="#e9c443"/>`;
  return `<g transform="translate(${f1(sx)},${f1(sy)})"><ellipse cx="0" cy="0" rx="22" ry="9" fill="rgba(59,42,33,.18)"/><path d="M-3 0Q-2 -24 -9 -44M1 0Q3 -30 12 -46" stroke="${C.woodD}" stroke-width="5" fill="none" stroke-linecap="round"/>`
    + `<ellipse cx="-14" cy="-60" rx="22" ry="17" fill="${leaf2}"/><ellipse cx="12" cy="-66" rx="24" ry="18" fill="${leaf}"/><ellipse cx="-2" cy="-82" rx="20" ry="15" fill="${leaf}"/><ellipse cx="16" cy="-54" rx="14" ry="10" fill="${leaf2}"/>${fruit}</g>`;
}
// a signpost: a pole and a plank with an arrow end; the glyphs are upright so they read
function signpost(x, y, words, id, dir = 1) {
  const [sx, sy] = P(x, y);
  const n = words.length, gs = 22, w = n * gs + 18, h = 30;
  const px = dir > 0 ? -10 : -w + 10;
  const plank = dir > 0 ? `M${px} -84H${px + w}L${px + w + 12} -${84 - h / 2}L${px + w} -${84 - h}H${px}Z` : `M${px + w} -84H${px}L${px - 12} -${84 - h / 2}L${px} -${84 - h}H${px + w}Z`;
  let s = `<g class="hit exit" data-hit="${id}" transform="translate(${f1(sx)},${f1(sy)})"><ellipse cx="0" cy="0" rx="8" ry="3.5" fill="rgba(59,42,33,.2)"/><path d="M0 2V-90" stroke="${C.woodD}" stroke-width="5" stroke-linecap="round"/>`;
  s += `<path d="${plank}" fill="${C.woodL}" stroke="${C.woodD}" stroke-width="1.6" stroke-linejoin="round"/>`;
  words.forEach((g, i) => { s += `<use href="#g-${g}" x="${px + 9 + i * gs}" y="-${84 - 4}" width="${gs}" height="${gs}" style="color:${C.ink}"/>`; });
  return s + `<rect x="${Math.min(px - 14, -16)}" y="-96" width="${w + 30}" height="102" fill="transparent"/></g>`;
}
function platform(c = {}) {
  return box(0, 0, -0.8, 9, 9, 0.8, { top: c.top || C.sand, left: c.left || C.soilL, right: c.right || C.soilR });
}
function paving(x, y, w, d, z = 0, col = 'rgba(59,42,33,.07)') {
  let s = '';
  for (let i = 1; i < w; i++) s += lineU(i, 0, i, d, col, 0.035);
  for (let j = 1; j < d; j++) s += lineU(0, j, w, j, col, 0.035);
  return onT(x, y, z, s);
}
function pebbles(list) { return list.map(([x, y, r]) => { const [a, b] = P(x, y); return `<ellipse cx="${f1(a)}" cy="${f1(b)}" rx="${r}" ry="${r / 2}" fill="${C.sandR}" opacity=".7"/>`; }).join(''); }
function awning(x, y, z, w, depth, cols = [C.teal, C.plaster]) {
  // a striped cloth sloping out from a wall face at y
  let s = '';
  const n = Math.round(w / 0.4);
  for (let i = 0; i < n; i++) {
    const a = x + (i * w) / n, b = x + ((i + 1) * w) / n;
    s += poly([P(a, y, z), P(b, y, z), P(b, y + depth, z - 0.35), P(a, y + depth, z - 0.35)], cols[i % 2]);
  }
  for (let i = 0; i < n; i++) {
    const a = x + (i * w) / n, b = x + ((i + 1) * w) / n, [p1x, p1y] = P(a, y + depth, z - 0.35), [p2x, p2y] = P(b, y + depth, z - 0.35);
    s += `<path d="M${f1(p1x)} ${f1(p1y)}L${f1(p2x)} ${f1(p2y)}Q${f1((p1x + p2x) / 2)} ${f1((p1y + p2y) / 2 + 9)} ${f1(p1x)} ${f1(p1y)}Z" fill="${cols[i % 2]}"/>`;
  }
  return s;
}
function windowDecal(u, t, w = 0.5, h = 0.7, sh = C.tealD) {
  return arch(u, t, w, h, '#5c4a3c') + rect(u - 0.06, t + h, w + 0.12, 0.08, C.plaster) + `<path d="M${u} ${t + 0.12}h${w}" stroke="${sh}" stroke-width=".05" opacity=".0"/>`;
}
function door(u, t, w, h, col = C.teal) {
  return arch(u, t, w, h, col, `stroke="${C.ink}" stroke-width=".035"`) + lineU(u + w / 2, t + w / 2 - 0.1, u + w / 2, t + h, 'rgba(0,0,0,.25)', 0.03) + `<circle cx="${u + w * 0.66}" cy="${t + h * 0.62}" r=".04" fill="${C.ochre}"/>`;
}
function crates(x, y) {
  return box(x, y, 0, 0.6, 0.6, 0.5, { top: C.woodL, left: C.wood, right: C.woodD }) + box(x + 0.1, y + 0.05, 0.5, 0.5, 0.5, 0.42, { top: C.woodL, left: C.wood, right: C.woodD });
}
function amphora(x, y) {
  const [sx, sy] = P(x, y);
  return `<g transform="translate(${f1(sx)},${f1(sy)})"><ellipse cx="0" cy="0" rx="8" ry="3.5" fill="rgba(59,42,33,.18)"/><path d="M-3 -1Q-10 -12 -6 -22Q-3 -26 -3 -30H3Q3 -26 6 -22Q10 -12 3 -1Z" fill="${C.terra}"/><path d="M0 -30H3Q3 -26 6 -22Q10 -12 3 -1H0Z" fill="${C.terraD}" opacity=".55"/><path d="M-4 -31H4" stroke="${C.terraD}" stroke-width="2"/></g>`;
}

// ---------- the five places ----------
export function drawPlace(place, s) {
  const f = s.f;
  let o = '';
  const anchors = {};
  const mark = (id, x, y, z = 0, h = 0) => { const p = P(x, y, z); anchors[id] = [p[0], p[1] - h]; };
  const who = (role, id, x, y) => { o += figure(role, id, x, y); mark(id, x, y, 0, (ROLES[role].scale || 1) * 96); };

  if (place === 'harbour') {
    o += box(0, 0, -0.8, 9, 5.6, 0.8, { top: C.sand, left: C.stone, right: C.soilR });
    o += onL([0, 0, -0.8, 9, 5.6, 0.8], [0.6, 1.9, 3.1, 4.4, 5.7, 7.0, 8.2].map((u) => lineU(u, 0, u, 0.8, 'rgba(59,42,33,.18)', 0.03)).join('') + lineU(0, 0.4, 9, 0.4, 'rgba(59,42,33,.18)', 0.03));
    o += paving(0, 0, 9, 5.6, 0, 'rgba(59,42,33,.05)');
    o += box(0, 5.6, -0.8, 9, 3.4, 0.24, { top: C.sea, left: C.seaD, right: C.seaD });
    let waves = '';
    for (const [u, v] of [[1, .6], [3.2, 1.4], [6.8, 0.8], [8, 2.2], [4.4, 2.6], [1.8, 2.8], [7.6, 3]]) waves += `<path d="M${u} ${v}q.2 -.16 .4 0t.4 0" stroke="${C.seaL}" stroke-width=".07" fill="none" stroke-linecap="round" class="wave"/>`;
    o += `<g class="pt" data-pt="sea">${onT(0, 5.6, -0.56, waves)}</g>`;
    mark('sea', 3.5, 7.4, -0.5, 10);
    // wreck and rocks
    o += `<g transform="translate(${P(1.7, 7.8, -0.56).map(f1).join(',')})"><path d="M-30 4L-6 -6L22 0L14 10L-22 10Z" fill="${C.woodD}"/><path d="M-30 4L-6 -6L22 0" stroke="${C.ink}" stroke-width="1.2" fill="none"/><path d="M-4 -4L18 -50" stroke="${C.wood}" stroke-width="4" stroke-linecap="round"/><path d="M18 -50L32 -36" stroke="${C.wood}" stroke-width="2"/><path d="M6 -26Q24 -24 22 -6L8 -8Z" fill="${C.plaster}" opacity=".8"/></g>`;
    for (const [x, y, r] of [[0.7, 8.4, 13], [3.0, 8.7, 10], [8.2, 6.4, 11]]) { const [a, b] = P(x, y, -0.56); o += `<path d="M${f1(a - r)} ${f1(b + 3)}Q${f1(a - r * .6)} ${f1(b - r)} ${f1(a)} ${f1(b - r * .9)}Q${f1(a + r)} ${f1(b - r * .4)} ${f1(a + r)} ${f1(b + 3)}Z" fill="#9b8f80"/><path d="M${f1(a)} ${f1(b - r * .9)}Q${f1(a + r)} ${f1(b - r * .4)} ${f1(a + r)} ${f1(b + 3)}H${f1(a)}Z" fill="#857a6d"/>`; }
    // pier
    o += box(5.3, 5.6, -0.66, 1.3, 3.0, 0.5, { top: C.woodL, left: C.wood, right: C.woodD });
    o += onT(5.3, 5.6, -0.16, [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8].map((v) => lineU(0, v, 1.3, v, C.woodD, 0.03)).join(''));
    // fish hut, back left
    const hut = [0.3, 0.3, 0, 3.4, 1.8, 2.8];
    o += box(...hut);
    o += onL(hut, door(0.5, 1.45, 0.8, 1.35, C.teal) + windowDecal(2.3, 1.3) + plaqueFace(1.4, 0.2, ['fish'], 's-fish'));
    o += onR(hut, windowDecal(0.6, 1.2));
    o += box(0.25, 0.25, 2.8, 3.5, 1.9, 0.12, { top: C.plaster, left: C.plasterL, right: C.plasterR });
    o += awning(0.3, 2.1, 1.75, 3.4, 0.7);
    // warehouse, back right, and steps up into town
    const wh = [4.0, 0.2, 0, 3.1, 1.4, 2.9];
    o += box(...wh);
    o += onL(wh, arch(0.5, 0.8, 0.9, 2.1, '#6b5240') + arch(1.8, 0.8, 0.9, 2.1, '#6b5240') + rect(0, 0, 3.1, 0.18, C.terra));
    o += onR(wh, windowDecal(0.45, 0.9));
    for (let i = 0; i < 4; i++) o += box(7.4, 0.2 + i * 0.35, 0, 1.4, 1.6 - i * 0.35, 0.18 * (4 - i), { top: C.stone, left: C.stoneD, right: '#a28d68' });
    o += crates(3.7, 2.0);
    o += amphora(0.9, 2.6) + amphora(1.25, 2.9);
    // fishing net on a frame
    // stall with the fish pile
    who('fisher', 'fisher', 5.5, 2.1);
    o += box(4.4, 2.6, 0, 2.2, 0.8, 0.6, { top: C.woodL, left: C.wood, right: C.woodD });
    {
      const [a, b] = P(5.5, 3.0, 0.6);
      let pile = `<g class="pt" data-pt="pile">`;
      const spots = [[-22, 0], [-10, -3], [2, -1], [14, -3], [24, 1], [-16, -8], [-4, -10], [8, -9], [18, -8], [-8, -16], [5, -16], [0, -4]];
      spots.forEach(([dx, dy], i) => { pile += fishShape(a + dx, b + dy - 2, 1, i % 3 ? '#a3b9b4' : '#c3cfc6', i % 2 ? -1 : 1); });
      pile += `<path class="ring" d="M${f1(a - 40)} ${f1(b - 6)}a40 18 0 1 0 80 0a40 18 0 1 0 -80 0" fill="none" stroke="${C.ochre}" stroke-width="2.4"/></g>`;
      o += pile; anchors.pile = [a, b - 26];
    }
    // the child and the counting baskets
    o += signpost(8.1, 2.5, ['bread', 'house'], 'x-market', 1); mark('x-market', 8.1, 2.5, 0, 96);
    who('child', 'child', 2.1, 3.9);
    o += basket(1.1, 4.9, 1, 'b1') + basket(2.1, 4.9, 2, 'b2') + basket(3.1, 4.9, 3, 'b3');
    for (const [id, x] of [['b1', 1.1], ['b2', 2.1], ['b3', 3.1]]) mark(id, x, 4.9, 0.4, 14);
    o += basket(4.3, 4.3, f.counted ? 0 : f.childN, 'game', true); mark('game', 4.3, 4.3, 0.4, 14);
    // the pier's sign post
    {
      const [a, b] = P(6.2, 8.2, -0.16);
      o += `<g class="hit sign" data-hit="s-sea" transform="translate(${f1(a)},${f1(b)})"><path d="M0 2V-50" stroke="${C.woodD}" stroke-width="4" stroke-linecap="round"/><rect x="-16" y="-62" width="32" height="30" rx="2" fill="${C.plaster}" stroke="${C.woodD}" stroke-width="1.6"/><use href="#g-sea" x="-12" y="-59" width="24" height="24" style="color:${C.teal}"/><rect x="-22" y="-68" width="44" height="74" fill="transparent"/></g>`;
    }
    o += pebbles([[1.2, 1.9, 2], [6.8, 4.4, 2.5], [7.9, 5.0, 2], [0.6, 5.2, 2]]);
  }

  if (place === 'market') {
    o += platform();
    o += paving(0, 0, 9, 9);
    const bk = [1.4, 0.2, 0, 4.8, 2.0, 2.9];
    o += box(5.0, 0.6, 2.9, 0.6, 0.6, 0.9, { top: C.terraD, left: C.terra, right: C.terraD });
    o += box(...bk);
    o += onL(bk, door(1.2, 1.05, 0.95, 1.55, C.terraD) + `<g class="pt" data-pt="shelf">${arch(2.75, 1.05, 1.3, 1.0, '#5c4a3c')}${[0, 1, 2].map((i) => `<ellipse cx="${2.98 + i * 0.42}" cy="1.86" rx=".17" ry=".11" fill="${C.ochre}"/><ellipse cx="${3.18 + i * 0.42}" cy="1.62" rx=".15" ry=".1" fill="${C.ochreD}"/>`).join('')}${rect(2.69, 2.04, 1.42, 0.09, C.plaster)}</g>`
      + plaqueFace(1.0, 0.16, ['bread', 'house'], 's-bakery') + plaqueFace(3.05, 2.2, ['bread', 'many'], 's-window', C.terraD, 0.32));
    mark('shelf', 4.5, 2.2, 1.4, 0);
    o += onR(bk, windowDecal(0.7, 0.8));
    o += box(1.35, 0.15, 2.9, 4.9, 2.1, 0.12, { top: C.plaster });
    o += awning(1.4, 2.2, 1.95, 4.8, 0.6, [C.terra, C.plaster]);
    o += pot(1.2, 2.6) + pot(6.5, 2.4);
    who('baker', 'baker', 4.0, 2.55);
    o += box(2.9, 2.9, 0, 2.4, 0.8, 0.68, { top: C.woodL, left: C.wood, right: C.woodD });
    {
      const [a, b] = P(4.1, 3.3, 0.68);
      for (const [dx, dy] of [[-26, 2], [-12, -2], [2, 1], [16, -3], [28, 1], [-4, -8], [10, -9]]) o += `<g transform="translate(${f1(a + dx)},${f1(b + dy)})"><ellipse rx="8" ry="5" fill="${C.ochre}" stroke="${C.ochreD}" stroke-width="1"/><path d="M-3 -3l2 3M2 -3l2 3" stroke="${C.ochreD}" stroke-width="1"/></g>`;
    }
    const side = [0, 3.0, 0, 1.3, 3.8, 2.3];
    o += box(...side);
    o += onR(side, door(1.4, 0.85, 0.75, 1.45, C.teal) + windowDecal(0.4, 0.7, 0.45, 0.6) + windowDecal(2.7, 0.7, 0.45, 0.6));
    o += tree(7.3, 1.8, 'olive');
    o += signpost(7.9, 5.6, ['water'], 'x-court', 1); mark('x-court', 7.9, 5.6, 0, 96);
    who('customer', 'customer', 5.6, 4.5);
    o += amphora(6.4, 3.4) + crates(2.0, 7.2);
    o += signpost(2.2, 8.0, ['sea'], 'x-harbour', -1); mark('x-harbour', 2.2, 8.0, 0, 96);
    o += pebbles([[4.5, 6.4, 2], [6.2, 7.6, 2.5], [3.2, 5.6, 2]]);
  }

  if (place === 'court') {
    o += platform();
    o += onT(0, 0, 0, `<circle cx="4.6" cy="4.6" r="2.6" fill="none" stroke="rgba(59,42,33,.08)" stroke-width=".05"/><circle cx="4.6" cy="4.6" r="1.7" fill="rgba(59,42,33,.04)"/>`);
    const ch = [0.2, 0.2, 0, 3.1, 2.2, 2.4];
    o += box(...ch);
    o += onL(ch, door(1.1, 0.9, 0.85, 1.5, C.teal) + windowDecal(2.35, 0.75, 0.45, 0.6) + plaqueFace(0.95, 0.24, ['child', 'house'], 's-childhouse'));
    o += onR(ch, windowDecal(0.8, 0.8));
    o += box(0.15, 0.15, 2.4, 3.2, 2.3, 0.12);
    const ar = [4.0, 0.1, 0, 4.8, 1.3, 3.1];
    o += box(...ar);
    o += onL(ar, [0.35, 1.45, 2.55, 3.65].map((u) => arch(u, 1.1, 0.8, 2.0, '#7a604c')).join('') + rect(0, 0.3, 4.8, 0.12, C.terra) + [0.55, 1.65, 2.75, 3.85].map((u) => windowDecal(u, 0.45, 0.4, 0.0)).join(''));
    o += onR(ar, windowDecal(0.45, 0.9));
    // a washing line between the houses
    { const [a, b] = P(3.2, 2.5, 2.0), [c, d] = P(4.0, 1.5, 2.3); o += `<path d="M${f1(a)} ${f1(b)}Q${f1((a + c) / 2)} ${f1((b + d) / 2 + 16)} ${f1(c)} ${f1(d)}" stroke="${C.ink}" stroke-width="1" fill="none"/><rect x="${f1(a + 6)}" y="${f1(b + 5)}" width="9" height="13" fill="${C.terraL}"/><rect x="${f1(a + 18)}" y="${f1(b + 2)}" width="11" height="10" fill="${C.tealL}"/>`; }
    o += signpost(0.6, 3.6, ['temple'], 'x-temple', -1); mark('x-temple', 0.6, 3.6, 0, 96);
    o += signpost(8.4, 2.6, ['gate'], 'x-gate', 1); mark('x-gate', 8.4, 2.6, 0, 96);
    // the well
    o += `<g class="hit" data-hit="well">`;
    o += cyl(4.6, 4.6, 0, 0.85, 0.72, '#4b3a2e', C.stone, C.stoneD);
    { const [a, b] = P(4.6, 4.6, 0.72); o += `<ellipse cx="${f1(a)}" cy="${f1(b)}" rx="34" ry="17" fill="none" stroke="${C.stoneD}" stroke-width="4"/><ellipse cx="${f1(a)}" cy="${f1(b + 2)}" rx="22" ry="10" fill="${f.waterGiven || s.inv.water ? '#2f5d58' : '#2f5d58'}"/>`; }
    { const [a, b] = P(4.6, 4.6, 0.72); o += `<path d="M${f1(a - 36)} ${f1(b + 4)}V${f1(b - 62)}M${f1(a + 36)} ${f1(b + 4)}V${f1(b - 62)}" stroke="${C.woodD}" stroke-width="5" stroke-linecap="round"/><path d="M${f1(a - 42)} ${f1(b - 62)}H${f1(a + 42)}" stroke="${C.wood}" stroke-width="6" stroke-linecap="round"/><path d="M${f1(a + 4)} ${f1(b - 60)}V${f1(b - 30)}" stroke="${C.ink}" stroke-width="1"/><path d="M${f1(a - 3)} ${f1(b - 30)}h14l-2 11h-10z" fill="${C.wood}" stroke="${C.woodD}" stroke-width="1"/>`
      + `<g class="hit sign" data-hit="s-well"><rect x="${f1(a - 15)}" y="${f1(b - 84)}" width="30" height="20" rx="2" fill="${C.plaster}" stroke="${C.woodD}" stroke-width="1.4"/><use href="#g-water" x="${f1(a - 8)}" y="${f1(b - 82)}" width="16" height="16" style="color:${C.teal}"/></g>`
      + `<rect x="${f1(a - 44)}" y="${f1(b - 66)}" width="88" height="94" fill="transparent"/>`; }
    o += '</g>';
    mark('well', 4.6, 4.6, 0.72, 70);
    anchors.wellTop = anchors.well;
    who('neighbor', 'neighbor', 6.1, 4.1);
    o += tree(8.0, 5.9, 'lemon');
    o += box(1.2, 5.6, 0, 1.8, 0.5, 0.36, { top: C.woodL, left: C.wood, right: C.woodD });
    o += pot(3.4, 2.7) + pot(6.7, 1.9, true, C.terraL);
    o += signpost(1.8, 8.0, ['bread', 'house'], 'x-market', -1); mark('x-market', 1.8, 8.0, 0, 96);
    o += pebbles([[5.6, 7.2, 2], [2.5, 4.4, 2], [7.0, 3.8, 2]]);
  }

  if (place === 'temple') {
    o += platform({ top: '#ead9b6' });
    o += paving(0, 0, 9, 9, 0, 'rgba(59,42,33,.05)');
    o += tree(0.9, 0.9, 'cypress');
    o += box(1.0, 0.4, 0, 6.6, 4.0, 0.3, { top: C.stone, left: C.stoneD, right: '#a28d68' });
    o += box(1.4, 0.6, 0.3, 5.8, 3.4, 0.3, { top: '#d9c7a3', left: C.stone, right: C.stoneD });
    const tb = [1.9, 0.8, 0.6, 4.8, 2.4, 2.5];
    o += box(...tb);
    o += onL(tb, rect(0, 0, 4.8, 0.32, C.ochre) + [0.35, 1.25, 3.15, 4.05].map((u) => rect(u, 0.55, 0.32, 1.95, C.plaster) + rect(u + 0.22, 0.55, 0.1, 1.95, 'rgba(59,42,33,.1)')).join('')
      + arch(1.85, 0.75, 1.1, 1.75, '#5c4536') + `<circle cx="2.4" cy="1.35" r=".28" fill="${C.ochre}"/>` + plaqueFace(2.09, 0.05, ['temple'], 's-temple', C.terraD, 0.56));
    o += onR(tb, rect(0, 0, 2.4, 0.32, C.ochreD) + [0.4, 1.4].map((u) => windowDecal(u, 0.9, 0.42, 0.8)).join(''));
    o += box(1.8, 0.7, 3.1, 5.0, 2.6, 0.14, { top: C.plaster });
    o += cyl(4.3, 2.0, 3.24, 1.0, 0.35, C.plaster, C.plasterL, C.plasterR);
    { const [a, b] = P(4.3, 2.0, 3.59); o += `<path d="M${f1(a - 48)} ${f1(b)}A48 44 0 0 1 ${f1(a + 48)} ${f1(b)}Z" fill="${C.teal}"/><path d="M${f1(a)} ${f1(b - 44)}A48 44 0 0 1 ${f1(a + 48)} ${f1(b)}H${f1(a)}Z" fill="${C.tealD}"/><path d="M${f1(a)} ${f1(b - 44)}V${f1(b - 58)}" stroke="${C.ochre}" stroke-width="3"/><circle cx="${f1(a)}" cy="${f1(b - 62)}" r="5" fill="${C.ochre}"/>`; }
    o += tree(7.8, 1.6, 'cypress');
    // the basin
    const bs = [3.4, 5.4, 0, 1.9, 1.5, 0.5];
    o += `<g class="pt" data-pt="basin">` + box(...bs, { top: C.stone, left: C.stoneD, right: '#a28d68' });
    o += onT(3.55, 5.55, 0.5, `<rect width="1.6" height="1.2" fill="${f.waterGiven ? C.sea : '#c9ae80'}"/>` + (f.waterGiven ? `<path d="M.3 .5q.15 -.1 .3 0t.3 0M.7 .9q.15 -.1 .3 0" stroke="${C.seaL}" stroke-width=".06" fill="none" class="wave"/>` : `<path d="M.2 .3l.4 .3l-.1 .4M.9 .2l.2 .5l.4 .1" stroke="#a88c5e" stroke-width=".04" fill="none"/>`));
    { const [a, b] = P(4.35, 6.15, 0.5); o += `<path class="ring" d="M${f1(a - 52)} ${f1(b)}a52 26 0 1 0 104 0a52 26 0 1 0 -104 0" fill="none" stroke="${C.ochre}" stroke-width="2.4"/>`; }
    o += '</g>';
    mark('basin', 4.35, 6.15, 0.5, 6);
    who('priest', 'priest', 6.2, 5.0);
    o += pot(1.6, 4.9, true) + pot(7.2, 4.6, true);
    o += signpost(1.6, 8.0, ['water'], 'x-court', -1); mark('x-court', 1.6, 8.0, 0, 96);
  }

  if (place === 'gate') {
    o += platform();
    o += paving(0, 0, 9, 9);
    const wall = [0, 0, 0, 9, 1.0, 3.0];
    o += box(...wall, { top: '#e5d6bb', left: C.plasterL, right: C.plasterR });
    o += onL(wall, [0.4, 1.4, 6.6, 7.6, 8.4].map((u) => rect(u, 0.6, 0.06, 0.4, 'rgba(59,42,33,.25)')).join(''));
    for (const i of [0, 1, 3.1, 4.1, 5.1, 7.5, 8.4]) o += box(i + 0.1, 0, 3.0, 0.5, 0.35, 0.3, { top: '#e5d6bb', left: C.plasterL, right: C.plasterR });
    // the arch and what's beyond it
    const open = f.gateOpen;
    const beyond = open
      ? `<clipPath id="archclip"><path d="M3.7 3.0V1.35A0.8 0.8 0 0 1 5.3 1.35V3.0Z"/></clipPath><g clip-path="url(#archclip)"><rect x="3.6" y=".4" width="1.8" height="2.7" fill="#f3c98b"/><path d="M3.6 2.1Q4.2 1.7 4.6 2Q5 1.8 5.4 2.1V3.1H3.6Z" fill="${C.olive}"/><path d="M4.35 3.0L4.5 2.05L4.65 3.0Z" fill="${C.sand}"/><circle cx="4.9" cy="1.65" r=".18" fill="${C.ochre}"/></g>`
      : `${arch(3.7, 0.55, 1.6, 2.45, C.woodD)}${[3.95, 4.25, 4.55, 4.85, 5.1].map((u) => lineU(u, 1.2, u, 3.0, 'rgba(0,0,0,.25)', 0.03)).join('')}${lineU(4.5, 0.55, 4.5, 3.0, C.ink, 0.05)}${[1.6, 2.4].map((t) => lineU(3.7, t, 5.3, t, C.ochreD, 0.07)).join('')}`;
    o += `<g class="pt" data-pt="gatedoor">${onL(wall, beyond + `<path d="M3.7 3.0V1.35A0.8 0.8 0 0 1 5.3 1.35V3.0" fill="none" stroke="${C.ink}" stroke-width=".05"/>` + `<path class="ring" d="M3.55 3.05V1.35A0.95 0.95 0 0 1 5.45 1.35V3.05" fill="none" stroke="${C.ochre}" stroke-width=".07"/>`)}</g>`;
    o += onL(wall, plaqueFace(4.21, 0.05, ['gate'], 's-gate', C.terraD, 0.56));
    mark('gatedoor', 4.5, 1.0, 1.6, 0);
    // towers
    for (const tx of [1.7, 6.1]) {
      const tw = [tx, 0, 0, 1.3, 1.25, 4.0];
      o += box(...tw);
      o += onL(tw, windowDecal(0.45, 0.8, 0.36, 0.6) + rect(0, 0, 1.3, 0.16, C.terra));
      o += onR(tw, windowDecal(0.6, 1.0, 0.36, 0.6));
      o += box(tx - 0.05, -0.05, 4.0, 0.4, 0.4, 0.3) + box(tx + 0.95, -0.05, 4.0, 0.4, 0.4, 0.3) + box(tx - 0.05, 0.9, 4.0, 0.4, 0.4, 0.3) + box(tx + 0.95, 0.9, 4.0, 0.4, 0.4, 0.3);
    }
    // a banner
    { const [a, b] = P(8.2, 1.0, 2.7); o += `<path d="M${f1(a)} ${f1(b)}l18 9v40l-9 -8l-9 3z" fill="${C.teal}"/><circle cx="${f1(a + 9)}" cy="${f1(b + 22)}" r="6" fill="${C.ochre}"/>`; }
    if (open) who('guard', 'guard', 6.6, 2.3); else who('guard', 'guard', 5.6, 2.1);
    if (open) { const [a, b] = P(4.5, 1.6); o += `<path d="M${f1(a - 20)} ${f1(b)}L${f1(a)} ${f1(b - 12)}L${f1(a + 30)} ${f1(b + 4)}L${f1(a + 10)} ${f1(b + 16)}Z" fill="#f3c98b" opacity=".45"/>`; }
    o += amphora(1.2, 1.7) + crates(7.6, 3.4);
    o += box(1.0, 4.2, 0, 0.5, 0.5, 0.7, { top: C.ink, left: C.stoneD, right: '#8e7a59' });
    { const [a, b] = P(1.25, 4.45, 0.7); o += `<path d="M${f1(a - 7)} ${f1(b)}Q${f1(a - 4)} ${f1(b - 18)} ${f1(a)} ${f1(b - 26)}Q${f1(a + 6)} ${f1(b - 14)} ${f1(a + 7)} ${f1(b)}Z" fill="${C.ochre}" class="flame"/><path d="M${f1(a - 3)} ${f1(b)}Q${f1(a)} ${f1(b - 10)} ${f1(a + 1)} ${f1(b - 14)}Q${f1(a + 4)} ${f1(b - 6)} ${f1(a + 3)} ${f1(b)}Z" fill="${C.terra}" class="flame"/>`; }
    o += signpost(1.6, 8.0, ['water'], 'x-court', -1); mark('x-court', 1.6, 8.0, 0, 96);
    o += pebbles([[4.8, 6.4, 2], [6.6, 7.4, 2.5], [3.2, 4.6, 2]]);
  }
  return { svg: o, anchors };
}

// the backdrop: hazy hills and a big pale sun, the same everywhere
export function backdrop(place, dusk = 0) {
  const sky = dusk ? '#f1d9b4' : C.paper;
  return `<rect x="-400" y="-400" width="1520" height="1400" fill="${sky}"/>`
    + `<circle cx="590" cy="96" r="58" fill="${dusk ? '#eba660' : '#f3d79c'}" opacity=".75"/>`
    + `<path d="M-400 250Q-120 190 120 230T560 210T1120 240V1000H-400Z" fill="${dusk ? '#e6c49a' : '#eadcc2'}"/>`
    + `<path d="M-400 300Q0 260 260 290T760 270T1120 300V1000H-400Z" fill="${dusk ? '#dfba8e' : '#e4d3b5'}" opacity=".8"/>`;
}

// ---------- small pictures ----------
export function itemIcon(item) {
  const sw = `stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"`;
  if (item === 'coin') return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="${C.ochre}" ${sw}/><circle cx="16" cy="16" r="7.4" fill="none" stroke="${C.ochreD}" stroke-width="1.2"/><rect x="13.4" y="13.4" width="5.2" height="5.2" fill="${C.paper}" ${sw}/></svg>`;
  if (item === 'bread') return `<svg viewBox="0 0 32 32"><path d="M4 21Q4 9 16 9Q28 9 28 21Z" fill="${C.ochre}" ${sw}/><path d="M11 13l2 4M16 12l2 4M21 13l2 4" stroke="${C.ochreD}" stroke-width="1.6" stroke-linecap="round"/><path d="M3 23H29" ${sw} stroke-linecap="round"/></svg>`;
  if (item === 'water') return `<svg viewBox="0 0 32 32"><path d="M11 6H21L20 9Q26 13 25 21Q24 27 16 28Q8 27 7 21Q6 13 12 9Z" fill="${C.terra}" ${sw}/><path d="M9 17Q16 20 23 17" stroke="${C.seaL}" stroke-width="2.4" fill="none"/><path d="M12 5.5H20" stroke="${C.ink}" stroke-width="2"/></svg>`;
  if (item === 'sun') return `<svg viewBox="0 0 32 32"><path d="M8 3Q16 10 24 3" stroke="${C.ink}" stroke-width="1.4" fill="none"/><circle cx="16" cy="18" r="7" fill="${C.ochre}" ${sw}/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * Math.PI / 4; return `<path d="M${f1(16 + Math.cos(a) * 9)} ${f1(18 + Math.sin(a) * 9)}L${f1(16 + Math.cos(a) * 12)} ${f1(18 + Math.sin(a) * 12)}" stroke="${C.ochreD}" stroke-width="2" stroke-linecap="round"/>`; }).join('')}</svg>`;
  return '';
}

export function portrait(who) {
  if (who === 'you') return `<svg viewBox="-30 -70 60 60"><circle cx="0" cy="-40" r="29" fill="${C.plasterL}"/><path d="M-14 -24L-18 -50L4 -56L8 -30Z" fill="${C.plaster}" stroke="${C.ink}" stroke-width="1.6"/><path d="M-13 -44L1 -48M-12 -38L2 -42" stroke="${C.ink}" stroke-width="1.2"/><path d="M10 -22L18 -50" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  if (who === 'well') return `<svg viewBox="-30 -70 60 60"><circle cx="0" cy="-40" r="29" fill="${C.tealL}"/><path d="M-16 -40V-22H16V-40Z" fill="${C.stone}" stroke="${C.ink}" stroke-width="1.4"/><ellipse cx="0" cy="-40" rx="16" ry="5" fill="#2f5d58" stroke="${C.ink}" stroke-width="1.4"/><path d="M-14 -40V-58M14 -40V-58M-18 -58H18" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/></svg>`;
  if (who === 'sign') return `<svg viewBox="-30 -70 60 60"><circle cx="0" cy="-40" r="29" fill="${C.sandL}"/><path d="M0 -14V-50" stroke="${C.woodD}" stroke-width="4"/><path d="M-16 -60H12L18 -52L12 -44H-16Z" fill="${C.woodL}" stroke="${C.woodD}" stroke-width="1.6"/></svg>`;
  const role = who;
  const bg = { fisher: C.tealL, child: '#f0cf8e', baker: '#eab79c', customer: '#c9caa0', neighbor: '#b5d3c7', priest: '#f3d79c', guard: '#e2a88e' }[role] || C.sandL;
  return `<svg viewBox="-30 -70 60 60"><defs><clipPath id="pc-${role}"><circle cx="0" cy="-40" r="29"/></clipPath></defs><circle cx="0" cy="-40" r="29" fill="${bg}"/><g clip-path="url(#pc-${role})"><g transform="translate(0,18)">${figureBody(role)}</g></g></svg>`;
}

// drawings in the sketchbook: one per glyph, in the traveller's ink-and-wash hand
export function picture(g) {
  const ink = `stroke="${C.ink}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const fig = (x, y, s = 1, extra = '', col = '#d9c7a3') => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-9 0Q-8 -14 -6 -26H6Q8 -14 9 0Z" fill="${col}" ${ink}/><circle cx="0" cy="-33" r="6.5" fill="${C.paper}" ${ink}/>${extra}</g>`;
  const pebble = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="5" fill="${C.stone}" ${ink}/>`;
  const loaf = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-14 6Q-14 -8 0 -8Q14 -8 14 6Z" fill="${C.ochre}" ${ink}/><path d="M-5 -4l2 4M3 -4l2 4" ${ink}/></g>`;
  const P2 = (inner) => `<svg viewBox="0 0 100 80">${inner}</svg>`;
  switch (g) {
    case 'one': return P2(pebble(50, 50));
    case 'two': return P2(pebble(40, 50) + pebble(60, 50));
    case 'three': return P2(pebble(32, 52) + pebble(50, 48) + pebble(68, 52));
    case 'many': return P2([[24, 58], [38, 56], [52, 58], [66, 56], [78, 58], [31, 47], [45, 46], [59, 46], [72, 47], [38, 37], [52, 36], [64, 38], [46, 27], [58, 27]].map(([x, y]) => pebble(x, y)).join(''));
    case 'person': return P2(fig(50, 70, 1.2));
    case 'child': return P2(fig(36, 70, 1.15) + fig(64, 70, 0.7, '', C.ochre));
    case 'guard': return P2(fig(46, 70, 1.15, `<path d="M14 -46V2M10 -40L14 -50L18 -40" ${ink}/><path d="M-7 -36A7 7 0 0 1 7 -36Z" fill="#b98a3e" ${ink}/>`, C.terraL));
    case 'baker': return P2(fig(42, 70, 1.15, `<ellipse cx="0" cy="-41" rx="7" ry="4" fill="${C.paper}" ${ink}/>`, C.paper) + loaf(72, 52));
    case 'priest': return P2(fig(50, 72, 1.15, `<path d="M-6 -38L0 -56L6 -38Z" fill="${C.ochre}" ${ink}/><circle cx="0" cy="-22" r="4" fill="${C.ochre}" ${ink}/>`, '#efe4cf'));
    case 'bread': return P2(loaf(50, 46, 1.6));
    case 'fish': return P2(`<g transform="translate(50,42) scale(3.4)"><path d="M-7 0Q-1 -5 5 0Q-1 5 -7 0Z" fill="#b7c6bf" stroke="${C.ink}" stroke-width=".6"/><path d="M5 0L9 -3V3Z" fill="#b7c6bf" stroke="${C.ink}" stroke-width=".6"/><circle cx="-4" cy="-.6" r=".8" fill="${C.ink}"/></g>`);
    case 'water': return P2(`<path d="M30 52Q50 44 70 52" stroke="${C.teal}" stroke-width="3" fill="none"/><path d="M50 14C44 26 38 34 38 42A12 12 0 0 0 62 42C62 34 56 26 50 14Z" fill="${C.tealL}" ${ink}/><path d="M26 64Q38 58 50 64T74 64" stroke="${C.teal}" stroke-width="3" fill="none"/>`);
    case 'coin': return P2(`<circle cx="50" cy="42" r="20" fill="${C.ochre}" ${ink}/><rect x="45" y="37" width="10" height="10" fill="${C.paper}" ${ink}/>`);
    case 'house': return P2(`<path d="M28 66V38H72V66Z" fill="${C.paper}" ${ink}/><path d="M24 40L50 20L76 40Z" fill="${C.terraL}" ${ink}/><path d="M44 66V52A6 6 0 0 1 56 52V66" fill="${C.teal}" ${ink}/>`);
    case 'temple': return P2(`<path d="M34 40A16 16 0 0 1 66 40Z" fill="${C.teal}" ${ink}/><path d="M24 70V40H76V70Z" fill="${C.paper}" ${ink}/><path d="M33 44V66M45 44V66M55 44V66M67 44V66" ${ink}/><path d="M20 70H80" ${ink}/><circle cx="50" cy="20" r="4" fill="${C.ochre}" ${ink}/>`);
    case 'gate': return P2(`<path d="M18 70V22H82V70Z" fill="${C.plasterL}" ${ink}/><path d="M38 70V44A12 12 0 0 1 62 44V70Z" fill="${C.woodD}" ${ink}/><path d="M50 32V70M38 54H62" ${ink}/><path d="M18 22V16H26V22M34 22V16H42V22M58 22V16H66V22M74 22V16H82V22" ${ink}/>`);
    case 'sea': return P2(`<path d="M10 30H90" ${ink}/><path d="M12 44Q20 38 28 44T44 44T60 44T76 44T92 44" stroke="${C.teal}" stroke-width="3" fill="none"/><path d="M12 58Q20 52 28 58T44 58T60 58T76 58T92 58" stroke="${C.teal}" stroke-width="3" fill="none"/><path d="M60 30L64 20L70 30Z" fill="${C.paper}" ${ink}/>`);
    case 'give': return P2(fig(26, 72, 0.95) + fig(76, 72, 0.95) + loaf(50, 36, 0.7) + `<path d="M36 46Q50 24 64 46" ${ink} stroke-dasharray="3 4"/><path d="M58 44L64 46L65 40" ${ink}/>`);
    case 'eat': return P2(fig(46, 72, 1.15, `<path d="M8 -24L10 -32" ${ink}/>`) + loaf(64, 28, 0.6) + `<path d="M59 18q3 -3 6 0M66 16q3 -3 6 0" ${ink}/>`);
    case 'go': return P2(fig(56, 70, 1.1, `<path d="M-14 -20H-26M-16 -12H-30M-14 -4H-24" ${ink}/>`) + `<path d="M14 72l4 -3M24 74l4 -3" ${ink}/>`);
    case 'open': return P2(`<path d="M28 70V18H72V70" ${ink}/><path d="M30 70V20H50V70Z" fill="${C.paper}" ${ink}/><path d="M50 20L66 14V76L50 70Z" fill="${C.woodL}" ${ink}/><path d="M34 44Q42 40 46 44" ${ink}/><path d="M74 40Q84 44 80 54M80 54L76 50M80 54L84 49" ${ink}/>`);
    case 'I': return P2(fig(50, 72, 1.2, `<path d="M6 -22Q14 -16 4 -14" ${ink}/>`) + `<path d="M50 72m-22 2a22 6 0 1 0 44 0a22 6 0 1 0 -44 0" stroke="${C.terra}" stroke-width="2.4" fill="none"/>`);
    case 'you': return P2(fig(26, 72, 0.95, `<path d="M6 -22L30 -26" ${ink}/>`) + fig(70, 72, 0.95) + `<path d="M70 72m-16 2a16 5 0 1 0 32 0a16 5 0 1 0 -32 0" stroke="${C.terra}" stroke-width="2.4" fill="none"/>`);
    case 'want': return P2(fig(34, 72, 1.1, `<path d="M6 -22L22 -40" ${ink}/>`) + `<path d="M56 30H86" ${ink}/>` + loaf(72, 22, 0.7) + `<path d="M58 34Q60 44 54 50" ${ink} stroke-dasharray="2 4"/>`);
    case 'no': return P2(fig(50, 72, 1.15, `<path d="M-10 -18L10 -10M10 -18L-10 -10" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/><path d="M-14 -40q-4 6 0 10M14 -40q4 6 0 10" ${ink}/>`));
    case 'sun': return P2(`<circle cx="50" cy="36" r="13" fill="${C.ochre}" ${ink}/>` + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * Math.PI / 4; return `<path d="M${f1(50 + Math.cos(a) * 18)} ${f1(36 + Math.sin(a) * 18)}L${f1(50 + Math.cos(a) * 25)} ${f1(36 + Math.sin(a) * 25)}" ${ink}/>`; }).join('') + `<path d="M8 72Q30 58 50 66T92 66" ${ink}/>`);
    case 'good': return P2(loaf(50, 50, 1.3) + `<path d="M24 26l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3z" fill="${C.ochre}" ${ink}/><path d="M74 18l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="${C.ochre}" ${ink}/><path d="M78 50l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="${C.ochre}" ${ink}/>`);
    case 'q': return P2(fig(50, 72, 1.15, `<path d="M-8 -22L-18 -28M8 -22L18 -28" ${ink}/><path d="M-20 -30h6M14 -30h6" ${ink}/>`) + `<path d="M40 8Q50 0 58 8Q62 16 52 20" ${ink}/><circle cx="51" cy="26" r="1.8" fill="${C.ink}"/>`);
  }
  return P2('');
}
