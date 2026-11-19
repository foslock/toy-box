// Jolly Cooperator — a shadow-puppet theatre. Everything is a cut-leather puppet on rods, pressed against a lit screen:
// foes are black leather, the host is dyed translucent leather, and you are a puppet cut out of the lamp's own light.
import { D, FOES } from './game.js';

const K = 0.55;           // how much screen height one unit of depth takes
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

export const INK = '#1c0f07';
const LIGHT = '#fff3d2';
const THEMES = [
  { hi: '#f7d58e', mid: '#e3a14c', lo: '#6e3a15', edge: '#25110a', far: 'rgba(88,44,16,.42)', mid2: 'rgba(52,25,9,.62)', floor: 'rgba(70,34,10,.16)' }, // chapel: amber
  { hi: '#efd88c', mid: '#c99a45', lo: '#4f4316', edge: '#1b1608', far: 'rgba(62,58,20,.42)', mid2: 'rgba(36,32,10,.66)', floor: 'rgba(48,40,10,.17)' },  // thornwood: olive amber
  { hi: '#f8c47e', mid: '#dd7f3e', lo: '#6a2410', edge: '#230b05', far: 'rgba(96,32,12,.42)', mid2: 'rgba(58,18,8,.64)', floor: 'rgba(80,26,8,.17)' },  // ash keep: ember
  { hi: '#f1c77a', mid: '#cf8d3e', lo: '#6a3a16', edge: '#24110a', far: 'rgba(90,48,18,.34)', mid2: 'rgba(56,30,10,.55)', floor: 'rgba(70,36,12,.15)' },  // rehearsal: a bare stage
];

function rand(seed) { let s = seed >>> 0 || 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ------------------------------------------------------------------ puppet parts
function limb(path, ax, ay, ang, len, w1, w2) {
  const bx = ax + Math.sin(ang) * len, by = ay + Math.cos(ang) * len;
  const nx = Math.cos(ang), ny = -Math.sin(ang);
  path.moveTo(ax + nx * w1, ay + ny * w1);
  path.lineTo(bx + nx * w2, by + ny * w2);
  path.arc(bx, by, w2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, false);
  path.lineTo(ax - nx * w1, ay - ny * w1);
  path.arc(ax, ay, w1, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, false);
  path.closePath();
  return [bx, by];
}
function hole(path, x, y, r) { path.moveTo(x + r, y); path.arc(x, y, r, 0, TAU, true); path.closePath(); }
function diamond(path, x, y, r) { path.moveTo(x, y - r); path.lineTo(x - r * 0.7, y); path.lineTo(x, y + r); path.lineTo(x + r * 0.7, y); path.closePath(); }

const BUILDS = {
  man:    { hip: 30, torso: 22, tw: 10, bw: 8, head: 6.6, ua: 12, fa: 11, th: 15, sh: 15, limbW: 2.6 },
  brute:  { hip: 29, torso: 25, tw: 14, bw: 10, head: 6.2, ua: 13, fa: 12, th: 14, sh: 15, limbW: 3.6 },
  lady:   { hip: 30, torso: 20, tw: 8.5, bw: 6.5, head: 6.2, ua: 11.5, fa: 10.5, th: 15, sh: 15, limbW: 2.2, skirt: true },
  shade:  { hip: 31, torso: 22, tw: 9, bw: 7, head: 6.4, ua: 12, fa: 11.5, th: 15.5, sh: 15.5, limbW: 2.3, cloak: true },
  husk:   { hip: 28, torso: 21, tw: 10, bw: 9, head: 6.4, ua: 12, fa: 11, th: 14, sh: 14, limbW: 2.6, robe: true },
  soldier:{ hip: 30, torso: 22, tw: 11, bw: 8.5, head: 6.4, ua: 12, fa: 11, th: 15, sh: 15, limbW: 2.8 },
  slim:   { hip: 30, torso: 21, tw: 9, bw: 7.5, head: 6, ua: 12, fa: 11, th: 15, sh: 15, limbW: 2.3 },
};

// pose: angles in radians, 0 = hanging straight down, + = rotated toward the facing direction
function basePose() { return { lean: 0, head: 0, fs: 0.35, fe: 0.6, bs: -0.15, be: 0.35, fh: 0.05, fk: -0.05, bh: -0.05, bk: -0.05, crouch: 0, rot: 0, lift: 0, w: 2.2, flipT: 0, open: 0 }; }

export function poseFor(e, kind, t) {
  const P = basePose();
  const st = e.state;
  const ph = e.walk * 0.13;
  const walking = (st === 'walk' || (e.mv > 0.15 && st !== 'atk' && st !== 'roll')) && st !== 'guard';
  P.lean = Math.sin(t * 1.8 + e.id) * 0.025;
  if (walking) {
    const sw = Math.sin(ph);
    P.fh = sw * 0.55; P.bh = -sw * 0.55;
    P.fk = -Math.max(0, Math.sin(ph + 1.3)) * 0.9; P.bk = -Math.max(0, Math.sin(ph + 1.3 + Math.PI)) * 0.9;
    P.bs = -sw * 0.35 - 0.1; P.lift = Math.abs(Math.cos(ph)) * 1.3; P.lean += 0.06;
    P.fs = 0.35 + sw * 0.15;
  }
  const atk = (wind, k, strike = 0.12) => {
    // wind 0..1 then strike, then recover
    if (k < wind) { const q = ease(k / wind); P.lean = -0.16 * q; P.fs = lerp(0.35, -2.5, q); P.fe = lerp(0.6, 0.5, q); P.w = lerp(2.2, 3.9, q); P.bs = lerp(-0.15, 0.6, q); P.fh = 0.25; P.bh = -0.3; }
    else if (k < wind + strike) { const q = ease((k - wind) / strike); P.lean = lerp(-0.16, 0.28, q); P.fs = lerp(-2.5, 1.45, q); P.fe = 0.1; P.w = lerp(3.9, 1.55, q); P.bs = -0.7; P.fh = 0.5; P.bh = -0.45; P.bk = -0.3; }
    else { const q = ease(clamp((k - wind - strike) / 0.25, 0, 1)); P.lean = lerp(0.28, 0.05, q); P.fs = lerp(1.45, 0.6, q); P.fe = lerp(0.1, 0.5, q); P.w = lerp(1.55, 2.1, q); P.bs = lerp(-0.7, -0.2, q); P.fh = lerp(0.5, 0.15, q); P.bh = lerp(-0.45, -0.1, q); }
  };
  switch (st) {
    case 'atk': {
      if (kind === 'player') { const n = e.combo, wind = [0.09, 0.09, 0.15][n]; atk(wind / 0.5, e.t / 0.5, 0.12 / 0.5); if (n === 1) { P.w -= 0.3; } }
      else { const w = (e.n === 0 ? e.wind : e.wind * 0.6); atk(w, e.t, 0.12); }
      break;
    }
    case 'wind': { const a = e.atk; const k = a ? 1 - a.tLeft / a.dur : 1; atk(1, k * 0.999); if (e.def?.ranged) { P.fs = 1.5; P.fe = 0; P.bs = 1.45; P.be = -0.1 * k; P.w = 0; P.draw = k; P.lean = -0.05; } break; }
    case 'rec': { const k = clamp(e.t / 0.5, 0, 1); atk(0, 0.12 + k * 0.25 + 0.0001, 0.12); if (e.def?.ranged) { P.fs = 1.5; P.fe = 0; P.w = 0; P.bs = 0.6; } break; }
    case 'roll': { const k = clamp(e.t / 0.42, 0, 1); P.rot = k * TAU; P.crouch = 12 * Math.sin(k * Math.PI); P.fh = 1.6; P.bh = 1.3; P.fk = -2.3; P.bk = -2.2; P.fs = 1.2; P.fe = 1.6; P.bs = 1.0; P.be = 1.6; P.w = 0.4; break; }
    case 'hurt': P.lean = -0.38; P.fs = -0.9; P.bs = -1.4; P.head = -0.35; P.w = 1.2; P.fh = 0.3; P.bh = -0.2; break;
    case 'downed': case 'dead': case 'fallen': {
      const k = st === 'downed' ? 1 : clamp(e.t * 3, 0, 1);
      P.rot = -Math.PI / 2 * ease(k); P.fs = 0.4; P.bs = -0.2; P.fh = 0.2; P.bh = -0.1; P.w = 1.4; P.lift = -2;
      if (st === 'downed') { P.fs = 0.4 + Math.sin(t * 2) * 0.15; P.head = 0.2; }
      break;
    }
    case 'hanging': P.fs = 2.9; P.fe = 0.1; P.bs = 2.75; P.be = 0.1; P.lift = -44; P.fh = Math.sin(t * 9) * 0.5; P.bh = -Math.sin(t * 9) * 0.5; P.w = 0.2; P.head = -0.25; break;
    case 'drink': { const k = clamp(e.t / 0.6, 0, 1); P.fs = lerp(0.35, 0.95, k); P.fe = lerp(0.6, 2.35, k); P.head = -0.3 * k; P.w = 0.3; P.flask = true; P.lean = -0.05; break; }
    case 'guard': P.fs = 1.05; P.fe = 1.25; P.bs = 1.3; P.be = 0.4; P.lean = -0.08; P.w = 2.9; P.fh = 0.35; P.bh = -0.35; P.crouch = 2; P.guard = true; break;
    case 'bow': { const k = Math.sin(clamp(e.t / 0.85, 0, 1) * Math.PI); P.lean = 0.95 * k; P.fs = 0.4 + 1.1 * k; P.fe = 1.6 * k; P.bs = -0.2 - 1.0 * k; P.head = 0.35 * k; P.bh = -0.3 * k; P.fh = 0.15; P.w = 1.4; break; }
    case 'cheer': P.lift = Math.abs(Math.sin(e.t * 9)) * 7; P.fs = 2.8; P.fe = 0.3; P.bs = 2.5; P.be = 0.3; P.w = 3.0; P.fh = 0.3; P.bh = -0.3; break;
    case 'pose': P.bs = -0.6; P.be = 2.3; P.fs = 2.6; P.fe = 0.4; P.head = -0.15; P.w = 3.1; P.lean = -0.06; P.fh = 0.25; P.bh = -0.12; break;
    case 'loot': P.crouch = 9; P.lean = 0.65; P.fs = 0.9; P.fe = 0.2; P.fh = 0.9; P.fk = -1.3; P.bh = -0.3; P.bk = -0.9; P.w = 2.6; break;
    case 'read': P.head = 0.28; P.fs = 0.6; P.fe = 1.6; P.w = 2.6; P.lean = 0.05 + Math.sin(t * 3) * 0.02; break;
    case 'raise': P.lean = 0.75; P.crouch = 6; P.fs = 1.2; P.fe = -0.2; P.bs = 1.0; P.be = -0.2; P.fh = 0.8; P.fk = -1.0; P.bh = -0.2; P.bk = -0.6; P.w = 2.6; break;
    case 'gesture': gesturePose(P, e.gest, e.t); break;
  }
  if (e.drop > 0) { P.lift = e.drop * 260; P.fh = 0.3; P.bh = -0.3; P.fk = -0.2; P.fs = 0.6; P.bs = 0.4; }
  return P;
}
export function gesturePose(P, g, t) {
  const k = clamp(t / 0.3, 0, 1);
  if (g === 'point') { P.fs = lerp(0.35, 1.62, ease(k)); P.fe = 0; P.lean = 0.12 * k; P.w = 1.6; P.head = 0.05; P.point = true; P.bs = -0.4; }
  if (g === 'beckon') { P.fs = 1.35; P.fe = 1.0 + Math.sin(t * 13) * 0.7; P.w = 2.4; P.head = -0.1; P.lean = -0.05; P.bs = 0.1; P.hand = true; }
  if (g === 'wait') { P.fs = 1.35; P.fe = 1.25; P.w = 2.9; P.lean = -0.06; P.head = -0.05; P.bs = -0.2; P.palm = true; P.fh = 0.25; P.bh = -0.2; }
  if (g === 'bow') { const q = Math.sin(clamp(t / 0.85, 0, 1) * Math.PI); P.lean = 0.95 * q; P.fs = 0.4 + 1.1 * q; P.fe = 1.6 * q; P.bs = -0.2 - 1.2 * q; P.head = 0.35 * q; P.bh = -0.35 * q; P.w = 1.2; }
  if (g === 'spin') { const q = clamp(t / 0.7, 0, 1); P.flipT = q; P.fs = 1.6; P.fe = 0.1; P.bs = 1.6; P.be = 0.1; P.lift = Math.sin(q * Math.PI) * 6; P.w = 1.8; P.fh = 0.35; P.bh = -0.35; }
}

// draw one humanoid puppet. o: { x, y, s, face, mode, dye, dark, build, weapon, P, alpha, flash, deco, rods(out) }
export function drawPuppet(ctx, o) {
  const B = BUILDS[o.build] || BUILDS.man, P = o.P;
  let face = o.face;
  if (P.flipT) face *= Math.cos(P.flipT * Math.PI * 4) < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.s * face, o.s);
  ctx.globalAlpha *= o.alpha ?? 1;
  const hipY = -B.hip + P.crouch - P.lift;
  // whole-body rotation about the hips (rolls, falls)
  if (P.rot) { ctx.translate(0, hipY + (P.rot < 0 ? -hipY - 4 : 0)); ctx.rotate(P.rot); ctx.translate(0, -(hipY + (P.rot < 0 ? -hipY - 4 : 0))); }
  const fill = o.mode === 'light' ? LIGHT : o.mode === 'dye' ? o.dye : INK;
  const flashC = o.flash > 0 ? (o.mode === 'ink' ? '#5c1a0e' : '#fff') : null;

  const back = new Path2D(), body = new Path2D(), front = new Path2D(), decoP = new Path2D();
  const lw = B.limbW;
  const sx = 0, sy = hipY - B.torso; // shoulder
  const lean = P.lean;
  const shX = sx + Math.sin(lean) * B.torso, shY = hipY - Math.cos(lean) * B.torso;
  // legs
  let legs = [];
  if (!B.skirt) {
    const [bkx, bky] = limb(back, -1.5, hipY, P.bh, B.th, lw * 1.1, lw * 0.9);
    const [bfx, bfy] = limb(back, bkx, bky, P.bh + P.bk, B.sh, lw * 0.9, lw * 0.7);
    foot(back, bfx, bfy, P.bh + P.bk, lw);
    const [fkx, fky] = limb(front, 1.5, hipY, P.fh, B.th, lw * 1.1, lw * 0.9);
    const [ffx, ffy] = limb(front, fkx, fky, P.fh + P.fk, B.sh, lw * 0.9, lw * 0.7);
    foot(front, ffx, ffy, P.fh + P.fk, lw);
    legs = [[bkx, bky], [fkx, fky]];
  }
  // arms
  const [bex, bey] = limb(back, shX - 2, shY + 2, P.bs + lean, B.ua, lw, lw * 0.85);
  const [bhx, bhy] = limb(back, bex, bey, P.bs + P.be + lean, B.fa, lw * 0.85, lw * 0.7);
  // torso
  const tl = hipY, cx = Math.sin(lean), cy = -Math.cos(lean);
  const px = Math.cos(lean), py = Math.sin(lean);
  const TW = B.tw, BW = B.bw;
  body.moveTo(-BW * px * 0.9 + 0, tl - BW * py * 0.9);
  body.lineTo(shX - TW * px * 0.9 - cx * 2, shY - TW * py * 0.9 - cy * 2);
  body.quadraticCurveTo(shX + cx * 3, shY + cy * 3, shX + TW * px * 0.9 - cx * 2, shY + TW * py * 0.9 - cy * 2);
  body.lineTo(BW * px * 0.9, tl + BW * py * 0.9);
  body.closePath();
  // skirt / robe / cloak
  if (B.skirt) {
    const sw = 13 + (P.lift > 1 ? 0 : Math.sin(o.t * 2) * 0.6);
    body.moveTo(-BW * 0.8, hipY - 2);
    body.quadraticCurveTo(-sw * 0.8, hipY + 12, -sw - 1, -P.lift + 0.5);
    body.lineTo(sw + 3, -P.lift + 0.5);
    body.quadraticCurveTo(sw * 0.9, hipY + 12, BW * 0.8, hipY - 2);
    body.closePath();
    // little feet
    const ft = Math.sin(o.walk * 0.13) * 3;
    body.moveTo(-3 + ft, -P.lift); body.lineTo(3 + ft, -P.lift); body.lineTo(4 + ft, -P.lift - 2); body.lineTo(-2 + ft, -P.lift - 2); body.closePath();
  }
  if (B.robe) {
    body.moveTo(-BW, hipY - 4);
    body.lineTo(-BW - 3, hipY + 15);
    body.lineTo(BW + 4, hipY + 15);
    body.lineTo(BW, hipY - 4);
    body.closePath();
  }
  if (B.cloak) {
    const flap = Math.sin(o.t * 3 + o.walk * 0.1) * 2 - (o.mv || 0) * 3;
    back.moveTo(shX - 3, shY);
    back.quadraticCurveTo(-14 + flap, hipY, -16 + flap * 1.5, hipY + 18);
    back.lineTo(-6, hipY + 10);
    back.lineTo(-2, hipY);
    back.closePath();
  }
  // head
  const hx = shX + cx * (B.head + 1.5), hy = shY + cy * (B.head + 1.5);
  headShape(body, o.head || o.build, hx, hy, B.head, lean + P.head, decoP, P);
  // front arm
  const [fex, fey] = limb(front, shX + 1, shY + 2, P.fs + lean, B.ua, lw, lw * 0.85);
  const fang = P.fs + P.fe + lean;
  const [fhx, fhy] = limb(front, fex, fey, fang, B.fa, lw * 0.85, lw * 0.7);
  // hands
  hole(front, fhx, fhy, 0); front.moveTo(fhx + lw, fhy); front.arc(fhx, fhy, lw * 1.05, 0, TAU);
  if (P.point) { const a = fang; front.moveTo(fhx, fhy); limb(front, fhx, fhy, a, 5, 1, 0.6); }
  if (P.palm) { front.moveTo(fhx + 3, fhy); front.ellipse(fhx + Math.sin(fang) * 2, fhy + Math.cos(fang) * 2, 2.6, 4, -fang, 0, TAU); }

  // punched decoration (holes let the lamp through)
  const decoHoles = new Path2D();
  if (o.deco !== false) {
    const mx = (shX + 0) / 2, my = (shY + hipY) / 2;
    if (o.deco === 'rows' || !o.deco) { for (let i = 0; i < 3; i++) diamond(decoHoles, lerp(shX, 0, 0.25 + i * 0.25), lerp(shY, hipY, 0.25 + i * 0.25), 1.6); }
    if (o.deco === 'ring') { hole(decoHoles, mx, my, 3.2); hole(decoHoles, mx, my, 1.6); }
    if (o.deco === 'flower') { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; hole(decoHoles, mx + Math.cos(a) * 3, my + Math.sin(a) * 3, 1.1); } hole(decoHoles, mx, my, 1); }
    if (o.deco === 'dots') { for (let i = 0; i < 4; i++) hole(decoHoles, mx + (i % 2 ? 2.4 : -2.4), my + (i < 2 ? -3 : 3), 0.9); }
  }

  // ---- paint
  const paintMode = (p, extraHoles) => {
    if (extraHoles) { const q = new Path2D(p); q.addPath(extraHoles); ctx.fill(q, 'evenodd'); } else ctx.fill(p, 'nonzero');
  };
  ctx.lineJoin = 'round';
  // back layer: slightly darker for ink (another layer of leather), lighter for dye
  if (o.mode === 'light') {
    ctx.shadowColor = 'rgba(255,236,190,.95)'; ctx.shadowBlur = 16 * o.s * (o.dpr || 1) * 0.5;
    ctx.fillStyle = 'rgba(255,240,205,.72)';
    ctx.fill(back);
    if (o.shield) shieldShape(ctx, bhx, bhy, P, 'light');
    ctx.fillStyle = flashC || LIGHT;
    const q = new Path2D(body); q.addPath(decoHoles); ctx.fill(q, 'evenodd');
    ctx.fill(front);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(110,58,20,.75)'; ctx.lineWidth = 0.7;
    ctx.stroke(body); ctx.stroke(front);
    ctx.fillStyle = 'rgba(200,140,60,.6)';
    ctx.fill(decoP);
  } else if (o.mode === 'dye') {
    ctx.fillStyle = flashC || o.dye;
    ctx.globalAlpha *= 0.86;
    ctx.fill(back);
    if (o.shield) shieldShape(ctx, bhx, bhy, P, 'dye', o);
    const q = new Path2D(body); q.addPath(decoHoles); ctx.fill(q, 'evenodd');
    ctx.fill(front);
    ctx.globalAlpha /= 0.86;
    ctx.strokeStyle = o.dark; ctx.lineWidth = 0.9;
    ctx.stroke(back); ctx.stroke(body); ctx.stroke(front);
    ctx.fillStyle = o.dark; ctx.fill(decoP);
    // carved detail lines
    ctx.strokeStyle = o.dark; ctx.lineWidth = 0.6; ctx.globalAlpha *= 0.7;
    ctx.beginPath(); ctx.moveTo(shX - 2, shY + 4); ctx.lineTo(1, hipY - 2); ctx.moveTo(shX + 3, shY + 3); ctx.lineTo(4, hipY - 3); ctx.stroke();
    ctx.globalAlpha /= 0.7;
  } else {
    ctx.fillStyle = flashC || INK;
    ctx.fill(back);
    if (o.shield) shieldShape(ctx, bhx, bhy, P, 'ink');
    const q = new Path2D(body); q.addPath(decoHoles); ctx.fill(q, 'evenodd');
    ctx.fill(front);
    ctx.fillStyle = 'rgba(255,215,140,.85)'; ctx.fill(decoP);
  }
  // joints: rivets
  ctx.fillStyle = o.mode === 'light' ? 'rgba(150,90,30,.55)' : o.mode === 'dye' ? o.dark : 'rgba(255,210,140,.35)';
  for (const [jx, jy] of [[shX + 1, shY + 2], [fex, fey], ...legs]) { ctx.beginPath(); ctx.arc(jx, jy, 0.75, 0, TAU); ctx.fill(); }

  // weapon in the front hand
  weapon(ctx, o, fhx, fhy, P, fill, flashC);
  if (P.flask) { ctx.fillStyle = o.mode === 'ink' ? INK : o.dark || INK; ctx.save(); ctx.translate(fhx, fhy); ctx.rotate(-fang + Math.PI); ctx.fillRect(-1.6, -1, 3.2, 6); ctx.fillStyle = '#f2b860'; ctx.fillRect(-1, 0.5, 2, 3.5); ctx.restore(); }
  // a little lantern in the shade's back hand
  if (o.build === 'shade') {
    ctx.save(); ctx.translate(bhx, bhy + 3);
    ctx.strokeStyle = 'rgba(110,58,20,.8)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 0); ctx.stroke();
    ctx.shadowColor = '#fff6d0'; ctx.shadowBlur = 10 * o.s * (o.dpr || 1) * 0.5;
    ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.moveTo(-2.4, 0); ctx.lineTo(2.4, 0); ctx.lineTo(1.8, 5); ctx.lineTo(-1.8, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // where the rods attach (in screen space)
  if (o.rods) {
    const m = ctx.getTransform();
    const pt = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
    o.rods.push(pt(fhx, fhy), pt(shX, shY + 3));
  }
  ctx.restore();
}
function foot(path, x, y, ang, lw) {
  // a little forward-pointing foot
  const fx = x + 3.5, fy = y + 0.2;
  path.moveTo(x - 1.6, y - 1.2); path.lineTo(fx + 1.4, fy - 0.4); path.lineTo(fx + 1.2, fy + 1); path.lineTo(x - 2, y + 1); path.closePath();
}
function headShape(path, kind, x, y, r, ang, deco, P) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const R = (dx, dy) => [x + dx * ca + dy * sa, y - dx * sa + dy * ca];
  const M = (dx, dy) => path.moveTo(...R(dx, dy)), L = (dx, dy) => path.lineTo(...R(dx, dy)), Q = (a, b, c, d) => path.quadraticCurveTo(...R(a, b), ...R(c, d));
  // profile head facing +x: skull, brow, nose, chin
  const profile = () => { M(-r * 0.9, -r * 0.2); Q(-r * 0.9, -r * 1.1, 0, -r * 1.05); Q(r * 0.85, -r * 1.0, r * 0.9, -r * 0.2); L(r * 1.35, r * 0.15); L(r * 0.9, r * 0.35); Q(r * 0.95, r * 0.9, r * 0.35, r * 1.0); L(-r * 0.3, r * 0.9); Q(-r * 0.95, r * 0.6, -r * 0.9, -r * 0.2); path.closePath(); };
  switch (kind) {
    case 'wendel': profile(); // helmet with a visor plume
      M(-r * 1.0, -r * 0.3); Q(-r * 0.6, -r * 1.6, r * 0.6, -r * 1.25); L(r * 1.05, -r * 0.35); L(-r * 1.0, -r * 0.2); path.closePath();
      M(-r * 0.2, -r * 1.25); Q(-r * 1.4, -r * 2.6, -r * 2.6, -r * 1.6); Q(-r * 1.2, -r * 1.7, -r * 0.4, -r * 1.05); path.closePath();
      hole(deco, ...R(r * 0.45, -r * 0.1), 0.0001); break;
    case 'gorm': profile(); // horned
      M(-r * 0.5, -r * 0.8); Q(-r * 1.6, -r * 1.4, -r * 1.3, -r * 2.4); Q(-r * 0.9, -r * 1.5, -r * 0.0, -r * 1.0); path.closePath();
      M(r * 0.1, -r * 0.95); Q(r * 0.9, -r * 2.2, r * 0.3, -r * 2.6); Q(r * 1.2, -r * 1.6, r * 0.6, -r * 0.7); path.closePath();
      M(r * 0.9, r * 0.4); L(r * 0.2, r * 1.9); L(-r * 0.6, r * 1.0); path.closePath(); // beard
      break;
    case 'plume': profile(); // wide hat with a long feather
      M(-r * 2.2, -r * 0.65); Q(0, -r * 1.2, r * 2.3, -r * 0.55); L(r * 2.0, -r * 0.9); Q(r * 0.6, -r * 1.2, r * 0.5, -r * 1.9); Q(-r * 0.4, -r * 2.1, -r * 0.8, -r * 1.2); L(-r * 2.0, -r * 1.0); path.closePath();
      M(-r * 0.3, -r * 1.8); Q(-r * 2.4, -r * 3.6 - (P?.hats || 0) * 2, -r * 4.2, -r * 2.2); Q(-r * 2.2, -r * 2.4, -r * 0.6, -r * 1.5); path.closePath();
      break;
    case 'shade': // hooded, with a lit face hole
      M(-r * 1.05, r * 0.9); Q(-r * 1.3, -r * 1.3, r * 0.2, -r * 1.3); Q(r * 1.4, -r * 1.0, r * 1.3, r * 0.6); L(r * 0.6, r * 0.2); L(r * 0.4, r * 1.1); path.closePath();
      M(...R(r * 0.25, -r * 0.4)); path.ellipse(...R(r * 0.55, -r * 0.05), r * 0.4, r * 0.55, -ang, 0, TAU);
      deco.moveTo(...R(r * 0.5, -r * 0.15)); deco.arc(...R(r * 0.5, -r * 0.15), r * 0.16, 0, TAU);
      break;
    case 'monk': // deep pointed hood, two eye holes
      M(-r * 1.0, r * 0.9); Q(-r * 1.5, -r * 1.0, -r * 0.4, -r * 2.0); Q(r * 1.3, -r * 1.1, r * 1.2, r * 0.4); L(r * 0.6, r * 0.9); path.closePath();
      deco.moveTo(...R(r * 0.65, -r * 0.2)); deco.arc(...R(r * 0.6, -r * 0.15), r * 0.17, 0, TAU);
      break;
    case 'thorn': profile();
      for (let i = 0; i < 5; i++) { const a = -1.5 + i * 0.55; M(Math.cos(a - 1.2) * r * 0.9, Math.sin(a - 1.2) * r * 0.9); L(Math.cos(a - 1.0) * r * 2.0, Math.sin(a - 1.0) * r * 2.0); L(Math.cos(a - 0.8) * r * 0.9, Math.sin(a - 0.8) * r * 0.9); path.closePath(); }
      deco.moveTo(...R(r * 0.55, -r * 0.2)); deco.arc(...R(r * 0.5, -r * 0.2), r * 0.17, 0, TAU);
      break;
    case 'ash': profile(); // pot helm with crest
      M(-r * 1.05, r * 0.3); L(-r * 1.0, -r * 1.05); Q(0, -r * 1.5, r * 1.05, -r * 1.05); L(r * 1.15, r * 0.25); L(r * 0.5, r * 0.25); L(r * 0.5, -r * 0.1); L(-r * 0.5, -r * 0.1); L(-r * 0.5, r * 0.3); path.closePath();
      M(-r * 0.9, -r * 1.15); Q(-r * 0.2, -r * 2.6, r * 0.9, -r * 1.2); Q(0, -r * 1.7, -r * 0.9, -r * 1.15); path.closePath();
      deco.moveTo(...R(r * 0.75, -r * 0.3)); deco.arc(...R(r * 0.7, -r * 0.3), r * 0.14, 0, TAU);
      break;
    case 'helm': profile(); // kettle hat
      M(-r * 1.6, -r * 0.45); L(r * 1.7, -r * 0.45); L(r * 0.9, -r * 0.8); Q(0, -r * 1.7, -r * 0.9, -r * 0.8); path.closePath();
      break;
    case 'cap': profile(); // archer's hood with a tail
      M(-r * 1.0, r * 0.4); Q(-r * 1.2, -r * 1.3, r * 0.4, -r * 1.25); Q(r * 1.1, -r * 1.0, r * 1.0, -r * 0.3); L(-r * 0.6, -r * 0.2); L(-r * 2.2, r * 0.6); path.closePath();
      break;
    case 'dummy': M(-r, -r); path.ellipse(...R(0, 0), r * 0.95, r * 1.1, 0, 0, TAU); hole(deco, ...R(r * 0.3, -r * 0.2), 0.001); break;
    default: profile();
  }
}
function shieldShape(ctx, x, y, P, mode, o) {
  ctx.save(); ctx.translate(x + 1.5, y - 1);
  const p = new Path2D();
  p.moveTo(-6, -7); p.lineTo(6, -7); p.quadraticCurveTo(6.5, 4, 0, 9); p.quadraticCurveTo(-6.5, 4, -6, -7); p.closePath();
  const h = new Path2D(); hole(h, 0, -1.5, 1.6); diamond(h, -3, -4.5, 1.1); diamond(h, 3, -4.5, 1.1);
  p.addPath(h);
  ctx.fill(p, 'evenodd');
  if (mode === 'dye') { ctx.strokeStyle = o.dark; ctx.lineWidth = 0.8; ctx.stroke(p); }
  ctx.restore();
}
function weapon(ctx, o, hx, hy, P, fill, flashC) {
  const w = o.weapon; if (!w) return;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-P.w + Math.PI); // weapon points along angle P.w (0 = down)
  // now +y points along the blade
  const pal = o.mode === 'light' ? LIGHT : o.mode === 'dye' ? o.dye : INK;
  ctx.fillStyle = flashC || pal;
  if (o.mode === 'light') { ctx.shadowColor = 'rgba(255,240,200,1)'; ctx.shadowBlur = 12 * o.s * (o.dpr || 1) * 0.5; }
  const P2 = new Path2D();
  switch (w) {
    case 'sword': P2.rect(-3.5, -1.5, 7, 1.6); P2.moveTo(-1.1, 0); P2.lineTo(1.1, 0); P2.lineTo(0.9, 20); P2.lineTo(0, 23); P2.lineTo(-0.9, 20); P2.closePath(); P2.rect(-0.7, -4.5, 1.4, 3.5); break;
    case 'light': P2.moveTo(-1.4, 0); P2.lineTo(1.4, 0); P2.lineTo(1.0, 22); P2.lineTo(0, 26); P2.lineTo(-1.0, 22); P2.closePath(); P2.rect(-3, -1.4, 6, 1.4); break;
    case 'axe': P2.rect(-0.9, -6, 1.8, 34); P2.moveTo(0.5, 18); P2.quadraticCurveTo(10, 16, 11, 22); P2.quadraticCurveTo(11.5, 28, 9, 33); P2.quadraticCurveTo(6, 27, 0.5, 27); P2.closePath(); P2.moveTo(-0.5, 20); P2.lineTo(-5, 22); P2.lineTo(-0.5, 25); P2.closePath(); break;
    case 'rapier': P2.arc(0, 0.5, 2.6, 0, Math.PI); P2.rect(-0.45, 0, 0.9, 26); P2.moveTo(-0.45, 26); P2.lineTo(0, 28); P2.lineTo(0.45, 26); break;
    case 'pike': P2.rect(-0.7, -22, 1.4, 70); P2.moveTo(-2.2, 48); P2.quadraticCurveTo(0, 46, 2.2, 48); P2.lineTo(0, 58); P2.closePath(); break;
    case 'club': P2.moveTo(-1, -2); P2.lineTo(1, -2); P2.lineTo(2.8, 18); P2.quadraticCurveTo(0, 22, -2.8, 18); P2.closePath(); break;
    case 'wood': P2.rect(-1.4, -2, 2.8, 22); P2.rect(-3.5, 0, 7, 1.6); break;
    case 'bow': {
      ctx.rotate(-Math.PI / 2 + (P.w || 0));
      const pull = (P.draw || 0) * 6;
      P2.moveTo(-1, -16); P2.quadraticCurveTo(9, 0, -1, 16); P2.lineTo(0.2, 16); P2.quadraticCurveTo(10.5, 0, 0.2, -16); P2.closePath();
      ctx.fill(P2);
      ctx.strokeStyle = pal; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(-0.5, -16); ctx.lineTo(-pull, 0); ctx.lineTo(-0.5, 16); ctx.stroke();
      if (P.draw) { ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-pull, 0); ctx.lineTo(16, 0); ctx.stroke(); }
      ctx.restore(); return;
    }
  }
  ctx.fill(P2);
  ctx.restore();
}

// ------------------------------------------------------------------ bosses
function drawBoss(ctx, f, o, t) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.s * f.face, o.s);
  ctx.globalAlpha *= o.alpha ?? 1;
  const flash = f.flash > 0;
  ctx.fillStyle = flash ? '#5c1a0e' : INK;
  const a = f.atk, k = a && f.state === 'wind' ? 1 - a.tLeft / a.dur : 0;
  const lift = f.drop > 0 ? f.drop * 260 : 0;
  const dead = f.dead ? clamp(f.t * 1.5, 0, 1) : 0;
  if (dead) { ctx.rotate(-dead * 0.25); ctx.globalAlpha *= 1 - dead * 0.6; ctx.translate(0, dead * 6); }
  const p = new Path2D(), holes = new Path2D();
  const rodPts = [];
  const walk = f.walk * 0.06;
  if (f.key === 'bell') {
    const sway = Math.sin(t * 1.2) * 0.03;
    ctx.translate(0, -lift);
    // robe
    p.moveTo(-15, -46); p.quadraticCurveTo(-20, -18, -24, 0); p.lineTo(22, 0); p.quadraticCurveTo(18, -20, 13, -46); p.closePath();
    // shoulders + hood
    p.moveTo(-17, -44); p.quadraticCurveTo(-19, -60, -6, -64); p.quadraticCurveTo(4, -76, 12, -64); p.quadraticCurveTo(18, -58, 15, -44); p.closePath();
    p.moveTo(-4, -64); p.quadraticCurveTo(-10, -82, 2, -88); p.quadraticCurveTo(12, -80, 11, -64); p.closePath();
    hole(holes, 6, -71, 1.5); hole(holes, 9.5, -71, 1.2);
    for (let i = 0; i < 4; i++) diamond(holes, -2 + i * 0.5, -36 + i * 8, 2.2);
    // arm + chain + bell
    let ang = 0.9 + sway; // arm angle from down, forward +
    let bellAng = 0.3;
    if (f.state === 'wind' && a?.name === 'swing') { ang = lerp(0.9, -1.8, ease(k)); bellAng = lerp(0.3, -2.2, ease(k)); }
    else if (f.state === 'wind' && a?.kind === 'aoe') { ang = lerp(0.9, 3.0, ease(k)); bellAng = lerp(0.3, 3.1, ease(k)); }
    else if (f.state === 'rec') { const q = clamp(f.t / 0.5, 0, 1); ang = lerp(a?.kind === 'aoe' ? 0.2 : 1.9, 0.9, q); bellAng = lerp(a?.kind === 'aoe' ? -0.1 : 1.9, 0.3, q); }
    const sx = 8, sy = -56;
    const [ex, ey] = limb(p, sx, sy, ang, 20, 4.5, 3.5);
    const [hx, hy] = limb(p, ex, ey, ang + 0.5, 18, 3.5, 3);
    const bx = hx + Math.sin(bellAng) * 26, by = hy + Math.cos(bellAng) * 26;
    ctx.save(); ctx.strokeStyle = flash ? '#5c1a0e' : INK; ctx.lineWidth = 1.6; ctx.setLineDash([2.4, 1.2]); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
    // bell
    const bp = new Path2D();
    ctx.save(); ctx.translate(bx, by); ctx.rotate(-bellAng);
    bp.moveTo(-3, 0); bp.quadraticCurveTo(-7, 2, -8, 10); bp.quadraticCurveTo(-9, 17, -13, 20); bp.lineTo(13, 20); bp.quadraticCurveTo(9, 17, 8, 10); bp.quadraticCurveTo(7, 2, 3, 0); bp.closePath();
    hole(bp, 0, 12, 2.2); diamond(bp, -4, 8, 1.4); diamond(bp, 4, 8, 1.4);
    ctx.fill(bp, 'evenodd'); ctx.beginPath(); ctx.arc(0, 21.5, 2.5, 0, TAU); ctx.fill();
    ctx.restore();
    // legs hint
    const lg = Math.sin(walk) * 4;
    p.moveTo(-8 + lg, -2); p.rect(-9 + lg, -4, 9, 4); p.rect(3 - lg, -4, 9, 4);
    // back arm
    limb(p, -10, -54, -0.4 + sway, 18, 4, 3);
    rodPts.push([hx, hy], [-2, -60]);
  } else if (f.key === 'hound') {
    ctx.translate(0, -lift);
    let stretch = 0, head = 0, jaw = 0.1, crouch = 0;
    if (f.state === 'wind' && a?.kind === 'lunge') { crouch = 5 * ease(k); head = -0.15; jaw = 0.4 * k; }
    if (f.state === 'lunge') { stretch = 10; jaw = 0.5; head = 0.1; }
    if (f.state === 'wind' && a?.name === 'bite') { head = -0.3 * k; jaw = 0.6 * k; }
    if (f.state === 'rec' && a?.name === 'bite') { head = 0.3; jaw = 0; }
    if (f.state === 'wind' && a?.kind === 'howl') { head = -1.0 * ease(k); jaw = 0.6 * k; }
    const by = -28 + crouch;
    // body
    p.moveTo(-26, by); p.quadraticCurveTo(-24, by - 14, -4, by - 13); p.quadraticCurveTo(14 + stretch, by - 16, 22 + stretch, by - 6); p.quadraticCurveTo(22 + stretch, by + 6, 12 + stretch, by + 8); p.quadraticCurveTo(-6, by + 5, -22, by + 7); p.closePath();
    // spines
    for (let i = 0; i < 7; i++) { const x = -20 + i * 6.5 + stretch * i / 7; p.moveTo(x - 2.5, by - 11 - Math.sin(i) * 1.5); p.lineTo(x + 1, by - 22 - (i % 2) * 5); p.lineTo(x + 3, by - 11.5); p.closePath(); }
    // tail
    p.moveTo(-24, by - 4); p.quadraticCurveTo(-36, by - 16 + Math.sin(t * 6) * 4, -40, by - 26); p.quadraticCurveTo(-34, by - 12, -22, by + 2); p.closePath();
    // legs (four, jointed)
    const legs = [[14 + stretch, 0], [8 + stretch, Math.PI], [-16, Math.PI * 0.5], [-20, Math.PI * 1.5]];
    for (const [lx, phs] of legs) {
      const sw = f.state === 'lunge' ? (lx > 0 ? 0.9 : -0.9) : Math.sin(walk * 2 + phs) * (f.mv > 0.2 ? 0.55 : 0.05);
      const [kx, ky] = limb(p, lx, by + 4, sw, 13 - crouch * 0.3, 3, 2.4);
      const [fx, fy] = limb(p, kx, ky, sw - 0.6 * (lx > 0 ? -1 : 1), 13 - crouch * 0.5, 2.4, 1.8);
      p.moveTo(fx - 2, fy - 1); p.lineTo(fx + 4, fy); p.lineTo(fx - 2, fy + 1.5); p.closePath();
    }
    // head + jaw
    ctx.save();
    const hx = 22 + stretch, hy = by - 8;
    const hp = new Path2D();
    const ca = Math.cos(head), sa = Math.sin(head);
    const R = (x, y) => [hx + x * ca - y * sa, hy + x * sa + y * ca];
    hp.moveTo(...R(-4, -6)); hp.lineTo(...R(4, -12)); hp.lineTo(...R(7, -7)); hp.lineTo(...R(20, -3)); hp.lineTo(...R(21, 1)); hp.lineTo(...R(4, 3)); hp.closePath();
    const jc = Math.cos(head + jaw), js = Math.sin(head + jaw);
    const J = (x, y) => [hx + 4 * ca + x * jc - y * js, hy + 4 * sa + x * js + y * jc];
    hp.moveTo(...J(-4, 0)); hp.lineTo(...J(15, 1)); hp.lineTo(...J(14, 4)); hp.lineTo(...J(-2, 6)); hp.closePath();
    for (let i = 0; i < 3; i++) { hp.moveTo(...J(4 + i * 4, 1)); hp.lineTo(...J(5 + i * 4, -2)); hp.lineTo(...J(6 + i * 4, 1)); hp.closePath(); }
    hole(holes, ...R(8, -5), 1.4);
    p.addPath(hp);
    ctx.restore();
    rodPts.push([hx, hy - 4], [-10, by - 8]);
  } else if (f.key === 'king') {
    ctx.translate(0, -lift);
    const lg = Math.sin(walk) * 3;
    // cape
    p.moveTo(-6, -50); p.quadraticCurveTo(-20 - (f.mv || 0) * 4, -24, -28 - (f.mv || 0) * 6 + Math.sin(t * 2) * 2, 0); p.lineTo(-2, 0); p.closePath();
    // robe & body
    p.moveTo(-9, -52); p.lineTo(-12, 0); p.lineTo(13, 0); p.lineTo(9, -52); p.closePath();
    p.moveTo(-11, -52); p.quadraticCurveTo(0, -58, 11, -52); p.lineTo(9, -44); p.lineTo(-9, -44); p.closePath();
    // head + crown
    p.moveTo(-5, -56); p.quadraticCurveTo(-6, -66, 0, -67); p.quadraticCurveTo(6, -67, 6, -61); p.lineTo(8.5, -58); p.lineTo(5, -57); p.quadraticCurveTo(4, -53, 0, -53); p.closePath();
    p.moveTo(-6, -65); p.lineTo(-7, -76); p.lineTo(-3.5, -70); p.lineTo(-1, -79); p.lineTo(1.5, -70); p.lineTo(4.5, -77); p.lineTo(6, -65); p.closePath();
    hole(holes, -1, -72.5, 0.9); hole(holes, 3, -61, 0.9);
    for (let i = 0; i < 5; i++) diamond(holes, 0.5, -46 + i * 8, 1.8);
    p.rect(-6 + lg, -2, 6, 2); p.rect(2 - lg, -2, 6, 2);
    // sceptre arm
    let ang = 0.6, sc = 2.4;
    if (f.state === 'wind' && (a?.name === 'sweep')) { ang = lerp(0.6, -1.6, ease(k)); sc = lerp(2.4, 4.0, ease(k)); }
    if (f.state === 'wind' && (a?.name === 'flare')) { ang = lerp(0.6, 2.8, ease(k)); sc = lerp(2.4, 3.0, k); }
    if (f.state === 'wind' && (a?.kind === 'multi' || a?.kind === 'howl')) { ang = lerp(0.6, 3.0, ease(k)); sc = 3.1; }
    if (f.state === 'rec') { ang = 1.6; sc = 1.7; }
    const [ex, ey] = limb(p, 6, -50, ang, 15, 3, 2.5);
    const [hx, hy] = limb(p, ex, ey, ang + 0.4, 13, 2.5, 2.2);
    ctx.save();
    const sp = new Path2D();
    const dx = Math.sin(sc), dy = Math.cos(sc);
    sp.moveTo(hx - dx * 8 + dy * 0.9, hy - dy * 8 - dx * 0.9); sp.lineTo(hx + dx * 26 + dy * 0.9, hy + dy * 26 - dx * 0.9); sp.lineTo(hx + dx * 26 - dy * 0.9, hy + dy * 26 + dx * 0.9); sp.lineTo(hx - dx * 8 - dy * 0.9, hy - dy * 8 + dx * 0.9); sp.closePath();
    const ox = hx + dx * 30, oy = hy + dy * 30;
    sp.moveTo(ox + 4.5, oy); sp.arc(ox, oy, 4.5, 0, TAU);
    hole(sp, ox, oy, 2);
    p.addPath(sp);
    ctx.restore();
    limb(p, -6, -50, -0.3, 15, 3, 2.5);
    rodPts.push([hx, hy], [0, -56]);
    // glowing orb
    o.orb = [ox, oy];
  }
  p.addPath(holes);
  ctx.fill(p, 'evenodd');
  if (f.key === 'king' && o.orb) {
    const pulse = f.state === 'wind' ? 0.6 + k * 0.4 : 0.4;
    ctx.fillStyle = `rgba(255,190,90,${pulse})`;
    ctx.beginPath(); ctx.arc(o.orb[0], o.orb[1], 1.9, 0, TAU); ctx.fill();
  }
  if (o.rods) { const m = ctx.getTransform(); for (const [x, y] of rodPts) o.rods.push([m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]); }
  ctx.restore();
}

// ------------------------------------------------------------------ props for the scenery strips
function sceneryProp(ctx, kind, x, base, h, r) {
  ctx.beginPath();
  switch (kind) {
    case 'arch': { const w = h * 0.55; ctx.moveTo(x - w, base); ctx.lineTo(x - w, base - h * 0.6); ctx.quadraticCurveTo(x - w, base - h, x, base - h); ctx.quadraticCurveTo(x + w, base - h, x + w, base - h * 0.6); ctx.lineTo(x + w, base); ctx.lineTo(x + w * 0.62, base); ctx.lineTo(x + w * 0.62, base - h * 0.55); ctx.quadraticCurveTo(x + w * 0.62, base - h * 0.8, x, base - h * 0.8); ctx.quadraticCurveTo(x - w * 0.62, base - h * 0.8, x - w * 0.62, base - h * 0.55); ctx.lineTo(x - w * 0.62, base); ctx.closePath(); ctx.fill('evenodd'); return; }
    case 'spire': { const w = h * 0.16; ctx.moveTo(x - w, base); ctx.lineTo(x - w, base - h * 0.6); ctx.lineTo(x, base - h); ctx.lineTo(x + w, base - h * 0.6); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill(); ctx.fillRect(x - w * 0.15, base - h * 1.12, w * 0.3, h * 0.14); ctx.fillRect(x - w * 0.5, base - h * 1.07, w, w * 0.25); return; }
    case 'tower': { const w = h * 0.2; ctx.rect(x - w, base - h, w * 2, h); for (let i = 0; i < 3; i++) ctx.rect(x - w + i * w * 0.8, base - h - w * 0.35, w * 0.45, w * 0.36); ctx.fill(); return; }
    case 'grave': { const w = h * 0.3; ctx.moveTo(x - w, base); ctx.lineTo(x - w, base - h * 0.7); ctx.quadraticCurveTo(x, base - h * 1.1, x + w, base - h * 0.7); ctx.lineTo(x + w, base); ctx.fill(); return; }
    case 'cross': { const w = h * 0.08; ctx.rect(x - w, base - h, w * 2, h); ctx.rect(x - h * 0.3, base - h * 0.78, h * 0.6, w * 2); ctx.fill(); return; }
    case 'tree': case 'thorntree': {
      const w = h * 0.06;
      ctx.moveTo(x - w * 1.6, base); ctx.quadraticCurveTo(x - w, base - h * 0.5, x - w * 0.5, base - h); ctx.lineTo(x + w * 0.5, base - h); ctx.quadraticCurveTo(x + w, base - h * 0.5, x + w * 1.6, base); ctx.closePath(); ctx.fill();
      ctx.lineCap = 'round';
      const branch = (bx, by, ang, len, wd, depth) => {
        if (depth <= 0 || len < 3) return;
        const ex = bx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len;
        ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        if (kind === 'thorntree') for (let i = 1; i < 3; i++) { const tx = lerp(bx, ex, i / 3), ty = lerp(by, ey, i / 3); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(ang) * wd * 2.5, ty + Math.sin(ang) * wd * 2.5); ctx.lineWidth = wd * 0.4; ctx.stroke(); }
        branch(ex, ey, ang - 0.35 - r() * 0.3, len * 0.72, wd * 0.68, depth - 1);
        branch(ex, ey, ang + 0.35 + r() * 0.3, len * 0.7, wd * 0.68, depth - 1);
      };
      for (let i = 0; i < 3; i++) branch(x, base - h * (0.55 + i * 0.15), -0.9 + i * 0.9 + r() * 0.3, h * 0.33, w * 1.1, 4);
      return;
    }
    case 'bramble': { ctx.moveTo(x - h, base); for (let i = 0; i <= 10; i++) { const xx = x - h + i * h * 0.2, yy = base - h * (0.3 + 0.35 * Math.abs(Math.sin(i * 1.7 + x))); ctx.lineTo(xx, yy); ctx.lineTo(xx + h * 0.06, yy - h * 0.12); ctx.lineTo(xx + h * 0.1, yy); } ctx.lineTo(x + h, base); ctx.fill(); return; }
    case 'wall': { const w = h * 1.4; ctx.rect(x - w, base - h * 0.55, w * 2, h * 0.55); for (let i = 0; i < 8; i++) ctx.rect(x - w + i * w * 0.27, base - h * 0.66, w * 0.15, h * 0.12); ctx.fill(); return; }
    case 'keep': { const w = h * 0.35; ctx.rect(x - w, base - h * 0.75, w * 2, h * 0.75); ctx.rect(x - w * 1.25, base - h * 0.95, w * 0.55, h * 0.95); ctx.rect(x + w * 0.7, base - h * 0.95, w * 0.55, h * 0.95); ctx.moveTo(x - w * 1.35, base - h * 0.95); ctx.lineTo(x - w * 0.97, base - h * 1.2); ctx.lineTo(x - w * 0.6, base - h * 0.95); ctx.moveTo(x + w * 0.6, base - h * 0.95); ctx.lineTo(x + w * 0.97, base - h * 1.2); ctx.lineTo(x + w * 1.35, base - h * 0.95); ctx.fill(); ctx.fillStyle = 'rgba(255,200,120,.25)'; ctx.fillRect(x - w * 0.12, base - h * 0.55, w * 0.24, h * 0.18); return; }
    case 'banner': { ctx.rect(x - 1, base - h, 2, h); ctx.moveTo(x, base - h); ctx.lineTo(x + h * 0.32, base - h); ctx.lineTo(x + h * 0.32, base - h * 0.45); ctx.lineTo(x + h * 0.16, base - h * 0.55); ctx.lineTo(x, base - h * 0.45); ctx.fill(); return; }
    case 'hill': { ctx.moveTo(x - h * 2.2, base); ctx.quadraticCurveTo(x - h * 0.6, base - h * 0.9, x, base - h * 0.7); ctx.quadraticCurveTo(x + h, base - h * 0.4, x + h * 2.4, base); ctx.fill(); return; }
    case 'ladder': { ctx.rect(x - h * 0.15, base - h, h * 0.05, h); ctx.rect(x + h * 0.1, base - h, h * 0.05, h); for (let i = 1; i < 8; i++) ctx.rect(x - h * 0.15, base - h * i / 8, h * 0.3, h * 0.025); ctx.fill(); return; }
    case 'flat': { ctx.rect(x - h * 0.4, base - h, h * 0.8, h); ctx.fill(); ctx.fillStyle = 'rgba(255,220,160,.18)'; ctx.fillRect(x - h * 0.3, base - h * 0.9, h * 0.6, h * 0.7); return; }
  }
}
const SCENERY = [
  { far: ['hill', 'spire', 'arch', 'hill', 'tower'], mid: ['arch', 'grave', 'cross', 'grave', 'tree', 'spire'] },
  { far: ['hill', 'thorntree', 'hill', 'tree'], mid: ['thorntree', 'bramble', 'tree', 'bramble', 'thorntree'] },
  { far: ['keep', 'hill', 'tower', 'wall'], mid: ['wall', 'banner', 'tower', 'banner', 'wall'] },
  { far: ['flat', 'ladder', 'flat'], mid: ['flat', 'ladder'] },
];

// ------------------------------------------------------------------ renderer
export class Renderer {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.camX = 0; this.shake = 0; this.flash = 0; this.t = 0; this.curtain = 0;
    this.bubble = null; this.strips = null; this.stripKey = '';
    this.marks = [];
    this.noise = this.makeNoise();
  }
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    const portrait = h > w;
    this.tall = portrait;
    this.viewW = portrait ? 280 : 560;
    this.s = w / this.viewW;
    this.viewH = h / this.s;
    const pad = (this.padBottom || 0) / this.s;
    this.floorY = portrait ? Math.max(this.viewH * 0.53, 230) : this.viewH - Math.max(26, Math.min(44, this.viewH * 0.09), pad);
    this.stripKey = '';
    this.bg = null;
  }
  // world → css px
  sx(x) { return (x - this.camX) * this.s; }
  sy(y) { return (this.floorY - y * K) * this.s; }
  toScreen(x, y) { return [this.sx(x), this.sy(y)]; }
  depthK(y) { return 1 - (y / D) * 0.14; }

  makeNoise() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const r = rand(9);
    x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    const id = x.getImageData(0, 0, 256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 40; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; }
    x.putImageData(id, 0, 0);
    // fibres
    x.globalAlpha = 0.18; x.lineWidth = 0.6;
    for (let i = 0; i < 260; i++) { x.strokeStyle = r() < 0.5 ? '#fff' : '#000'; x.beginPath(); const a = r() * TAU, l = 6 + r() * 26, px = r() * 256, py = r() * 256; x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.4) * l * 0.5, py + Math.sin(a + 0.4) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    // a faint weave
    x.globalAlpha = 0.05; x.fillStyle = '#000';
    for (let i = 0; i < 256; i += 3) { x.fillRect(i, 0, 1, 256); x.fillRect(0, i, 256, 1); }
    return c;
  }
  buildStrips(g) {
    const theme = g.rehearsal ? 3 : g.L.theme;
    const key = `${theme}|${g.len}|${this.w}|${this.h}|${this.dpr}`;
    if (key === this.stripKey) return;
    this.stripKey = key;
    const T = THEMES[theme], S = SCENERY[theme];
    const mk = (par, q, kinds, color, seed, scaleH, base) => {
      const wUnits = g.len * par + this.viewW + 40;
      const sc = this.s * q;
      const c = document.createElement('canvas');
      c.width = Math.min(16000, Math.ceil(wUnits * sc)); c.height = Math.ceil(this.floorY * sc);
      const x = c.getContext('2d');
      x.scale(sc, sc);
      x.fillStyle = color; x.strokeStyle = color;
      const r = rand(seed);
      let px = -20;
      while (px < wUnits) {
        const kind = kinds[Math.floor(r() * kinds.length)];
        const h = scaleH * (0.6 + r() * 0.6);
        sceneryProp(x, kind, px, base, h, r);
        px += 40 + r() * 110;
      }
      // a continuous ground line for the layer
      x.beginPath(); x.moveTo(0, base);
      for (let i = 0; i <= wUnits; i += 20) x.lineTo(i, base - 3 - Math.sin(i * 0.013 + seed) * 3 - r() * 2);
      x.lineTo(wUnits, this.floorY); x.lineTo(0, this.floorY); x.fill();
      return { c, par, sc };
    };
    const backY = this.floorY - D * K;
    this.strips = [
      mk(0.3, 0.22, S.far, T.far, 11 + theme, Math.min(150, backY * 0.75), backY - 6),
      mk(0.62, 0.42, S.mid, T.mid2, 23 + theme, Math.min(110, backY * 0.55), backY + 2),
    ];
    // tufts along the front lip
    const r = rand(5 + theme);
    this.tufts = [];
    for (let x = 0; x < g.len; x += 6 + r() * 14) this.tufts.push([x, 2 + r() * 6, r()]);
    this.floorMarks = [];
    for (let x = 0; x < g.len; x += 14 + r() * 30) this.floorMarks.push([x, r() * D, 1 + r() * 3, r()]);
  }
  buildBg(theme) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.w * this.dpr / 2)); c.height = Math.max(1, Math.round(this.h * this.dpr / 2));
    const x = c.getContext('2d');
    const T = THEMES[theme];
    const cx = c.width / 2, cy = (this.floorY - 120) * this.s * this.dpr / 2;
    const R = Math.max(c.width, c.height) * 0.95;
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, T.hi); gr.addColorStop(0.42, T.mid); gr.addColorStop(0.85, T.lo); gr.addColorStop(1, T.edge);
    x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    // paper texture
    x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.5;
    const pat = x.createPattern(this.noise, 'repeat'); x.fillStyle = pat; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    // seams of the screen cloth
    x.fillStyle = 'rgba(80,40,10,.07)';
    for (let i = 1; i < 4; i++) x.fillRect(c.width * i / 4 - 1, 0, 2, c.height);
    this.bg = { c, theme };
  }

  // ---------------------------------------------------------------- frame
  frame(g, dt, ui = {}) {
    const ctx = this.ctx, s = this.s, dpr = this.dpr;
    this.t += dt;
    const theme = g.rehearsal ? 3 : g.L.theme;
    if (!this.bg || this.bg.theme !== theme) this.buildBg(theme);
    this.buildStrips(g);
    // camera
    const p = g.p, h = g.h;
    let target = p.x;
    if (h.present && !h.dead && h.state !== 'fallen') target = p.x * 0.62 + h.x * 0.38;
    let cam = target - this.viewW / 2;
    if (g.lock) { const w = g.lock.x1 - g.lock.x0; cam = w <= this.viewW ? g.lock.x0 + w / 2 - this.viewW / 2 : clamp(cam, g.lock.x0, g.lock.x1 - this.viewW); }
    cam = clamp(cam, 0, Math.max(0, g.len - this.viewW));
    if (ui.snapOnce) { ui.snapOnce = false; ui.holdCam = true; }
    if (ui.holdCam) { /* a staged shot: keep the camera where it was put */ }
    else if (ui.snap) this.camX = cam;
    else this.camX += (cam - this.camX) * (1 - Math.exp(-dt * 4.5));
    let shx = 0, shy = 0;
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 18); shx = (Math.random() - 0.5) * this.shake; shy = (Math.random() - 0.5) * this.shake; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // lamp flicker
    const flick = 1 + Math.sin(this.t * 7.3) * 0.012 + Math.sin(this.t * 13.1) * 0.008 + (Math.random() - 0.5) * 0.01;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bg.c, 0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr);
    // scenery strips
    for (const st of this.strips) {
      const ox = -this.camX * st.par * s;
      ctx.drawImage(st.c, ox, 0, st.c.width / st.sc * s, st.c.height / st.sc * s);
    }
    const T = THEMES[theme];
    // floor band (a gauze of lighter leather) and back edge
    const yb = this.sy(D), yf = this.sy(0);
    const fg = ctx.createLinearGradient(0, yb - 6 * s, 0, yf);
    fg.addColorStop(0, 'rgba(40,20,6,0)'); fg.addColorStop(0.12, T.floor); fg.addColorStop(1, 'rgba(60,30,8,.10)');
    ctx.fillStyle = fg; ctx.fillRect(0, yb - 6 * s, this.w, yf - yb + 6 * s);
    ctx.fillStyle = 'rgba(40,20,6,.10)';
    for (const [x, y, r, k] of this.floorMarks) { const X = this.sx(x); if (X < -20 || X > this.w + 20) continue; ctx.beginPath(); ctx.ellipse(X, this.sy(y), r * s, r * s * 0.4, 0, 0, TAU); ctx.fill(); }
    // chalk mark (rehearsal)
    if (ui.mark) { const X = this.sx(ui.mark.x), Y = this.sy(ui.mark.y); ctx.strokeStyle = 'rgba(255,248,225,.85)'; ctx.lineWidth = 2 * s * 0.6; ctx.setLineDash([4 * s, 3 * s]); ctx.beginPath(); ctx.ellipse(X, Y, 18 * s, 18 * s * K, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(X - 6 * s, Y - 3 * s); ctx.lineTo(X + 6 * s, Y + 3 * s); ctx.moveTo(X + 6 * s, Y - 3 * s); ctx.lineTo(X - 6 * s, Y + 3 * s); ctx.stroke(); }
    // boss/wave lock: curtain flats at the arena edges
    if (g.lock) for (const ex of [g.lock.x0, g.lock.x1]) {
      const X = this.sx(ex); if (X < -40 || X > this.w + 40) continue;
      const gr = ctx.createLinearGradient(X - 26 * s, 0, X + 26 * s, 0);
      gr.addColorStop(0, 'rgba(28,15,7,0)'); gr.addColorStop(0.5, 'rgba(28,15,7,.35)'); gr.addColorStop(1, 'rgba(28,15,7,0)');
      ctx.fillStyle = gr; ctx.fillRect(X - 26 * s, yb - 80 * s, 52 * s, yf - yb + 80 * s);
    }
    // pits
    for (const pt of g.pits) {
      if (!pt.on) continue;
      const x0 = this.sx(pt.x0), x1 = this.sx(pt.x1);
      if (x1 < -10 || x0 > this.w + 10) continue;
      const y0 = this.sy(pt.y0), y1 = this.sy(pt.y1);
      const pg = ctx.createLinearGradient(0, y1, 0, Math.min(this.h, y0 + 30 * s));
      pg.addColorStop(0, '#3b1d0b'); pg.addColorStop(0.18, '#1d0d05'); pg.addColorStop(1, '#0b0502');
      ctx.fillStyle = pg;
      ctx.beginPath();
      const r = rand(pt.x0);
      ctx.moveTo(x0, y1);
      for (let x = x0; x <= x1; x += 6 * s) ctx.lineTo(x, y1 + (r() - 0.3) * 3 * s);
      ctx.lineTo(x1, y1);
      for (let y = y1; y <= y0; y += 5 * s) ctx.lineTo(x1 + (r() - 0.5) * 3 * s, y);
      if (pt.y0 <= 0) { ctx.lineTo(x1, this.h); ctx.lineTo(x0, this.h); }
      else { ctx.lineTo(x1, y0); for (let x = x1; x >= x0; x -= 6 * s) ctx.lineTo(x, y0 + (r() - 0.7) * 3 * s); }
      ctx.closePath(); ctx.fill();
      // glow from below — the gap in the stage shows the dark under it
      // the far lip of the hole and a few broken boards
      ctx.strokeStyle = 'rgba(255,205,130,.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,70,30,.5)'; ctx.lineWidth = 2.5 * s * 0.6;
      for (let i = 0; i < 3; i++) { const bx = lerp(x0, x1, 0.2 + i * 0.3) + (r() - 0.5) * 8 * s, by = y1 + (r() * 0.4 + 0.1) * (y0 - y1); ctx.beginPath(); ctx.moveTo(bx - 8 * s, by - 4 * s); ctx.lineTo(bx + 6 * s, by + 3 * s); ctx.stroke(); }
      ctx.fillStyle = 'rgba(28,15,7,.85)';
      for (let x = x0; x < x1; x += 5 * s) { ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x + 1.5 * s, y1 + (4 + r() * 10) * s); ctx.lineTo(x + 3 * s, y1); ctx.fill(); }
    }
    // front lip of the stage: a long leather strip with tufts
    const lipY = yf + 4 * s;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(0, this.h + 10); ctx.lineTo(0, lipY);
    for (const [x, hh, k] of this.tufts) { const X = this.sx(x); if (X < -10 || X > this.w + 10) continue; if (g.pits.some((p) => p.on && p.y0 <= 0 && x > p.x0 - 2 && x < p.x1 + 2)) { ctx.lineTo(X, this.h + 10); continue; } ctx.lineTo(X - 1.5 * s, lipY); ctx.lineTo(X + (k - 0.5) * 3 * s, lipY - hh * s * (theme === 1 ? 1.4 : 0.8)); ctx.lineTo(X + 1.5 * s, lipY); }
    ctx.lineTo(this.w, lipY); ctx.lineTo(this.w, this.h + 10); ctx.closePath(); ctx.fill();
    // re-cut the pit gaps through the lip
    for (const pt of g.pits) if (pt.on && pt.y0 <= 0) { const x0 = this.sx(pt.x0), x1 = this.sx(pt.x1); ctx.fillStyle = '#0e0703'; ctx.fillRect(x0, lipY - 2, x1 - x0, this.h); }

    // messages (placards at the back)
    for (const m of g.msgs) {
      const X = this.sx(m.x); if (X < -60 || X > this.w + 60) continue;
      const Y = this.sy(m.y);
      ctx.fillStyle = INK;
      ctx.fillRect(X - 0.6 * s, Y - 22 * s, 1.2 * s, 22 * s);
      ctx.beginPath(); ctx.moveTo(X - 10 * s, Y - 30 * s); ctx.lineTo(X + 10 * s, Y - 30 * s); ctx.lineTo(X + 9 * s, Y - 20 * s); ctx.lineTo(X - 9 * s, Y - 20 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,215,140,.8)';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X + (i - 1) * 5 * s, Y - 25 * s, 0.9 * s, 0, TAU); ctx.fill(); }
      const near = Math.abs(m.x - p.x) < 90 || (h.present && Math.abs(m.x - h.x) < 70);
      m.show = (m.show || 0) + ((near ? 1 : 0) - (m.show || 0)) * Math.min(1, dt * 6);
      if (m.show > 0.03) this.paperNote(ctx, X, Y - 34 * s, `“${m.text}”`, m.show, true);
    }
    // loot
    for (const l of g.loot) {
      if (l.taken) continue;
      const X = this.sx(l.x); if (X < -40 || X > this.w + 40) continue;
      const Y = this.sy(l.y), k = this.depthK(l.y) * s;
      ctx.fillStyle = 'rgba(30,15,5,.22)'; ctx.beginPath(); ctx.ellipse(X, Y, 7 * k, 2.5 * k, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = INK;
      ctx.save(); ctx.translate(X, Y); ctx.scale(k, k);
      if (l.kind === 'flask') { ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.quadraticCurveTo(5, -5, 1.4, -8); ctx.lineTo(1.4, -11); ctx.lineTo(-1.4, -11); ctx.lineTo(-1.4, -8); ctx.quadraticCurveTo(-5, -5, -3, 0); ctx.fill(); }
      else if (l.kind === 'hat') { ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(0, -2, 8, 0); ctx.lineTo(4, -2); ctx.lineTo(3, -7); ctx.quadraticCurveTo(0, -9, -3, -7); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-2, -7); ctx.quadraticCurveTo(-8, -16, -13, -10); ctx.quadraticCurveTo(-7, -11, -1, -6); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -5); ctx.lineTo(3, -9); ctx.lineTo(-3, -9); ctx.lineTo(-5, -5); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      // twinkle: a little hole of light
      const tw = (Math.sin(this.t * 3 + l.glint) + 1) / 2;
      this.star(ctx, X + 4 * k, Y - 12 * k, (2 + tw * 4) * k, 0.5 + tw * 0.5);
    }

    // shadows + telegraphs on the floor
    const bodies = [];
    if (h.present) bodies.push(h);
    bodies.push(p);
    for (const f of g.foes) bodies.push(f);
    for (const b of bodies) {
      if (b.state === 'hanging' || (b.state === 'fallen')) continue;
      const X = this.sx(b.x), Y = this.sy(b.y), k = this.depthK(b.y) * s * (b.scale || 1);
      if (X < -100 || X > this.w + 100) continue;
      const a = b.dead ? Math.max(0, 1 - b.t) : 1;
      ctx.fillStyle = `rgba(30,14,4,${0.26 * a * (b.drop > 0 ? 0.4 : 1)})`;
      ctx.beginPath(); ctx.ellipse(X, Y + 1, (b.kind === 'boss' ? b.r * 0.9 : 11) * k / (b.scale || 1) * (b.kind === 'boss' ? 1 : 1), 3.2 * k, 0, 0, TAU); ctx.fill();
    }
    for (const f of g.foes) if (!f.dead && f.atk && f.state === 'wind') this.telegraph(ctx, f, f.atk);

    // bodies, back to front
    bodies.sort((a, b) => b.y - a.y);
    const rods = [];
    for (const b of bodies) this.drawBody(ctx, g, b, rods);
    // the rods, held from below the screen
    ctx.lineCap = 'round';
    const lipRod = this.sy(0) + 30 * s;
    for (const r of rods) {
      const [x, y, light] = r;
      ctx.strokeStyle = light ? 'rgba(255,240,200,.35)' : 'rgba(28,15,7,.5)';
      ctx.lineWidth = Math.max(1, 1.3 * s * 0.6);
      const endY = Math.min(this.h + 4, lipRod), dx = (x - this.w / 2) * 0.05 + 6 * s;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * (endY - y) / Math.max(1, this.h - y), endY); ctx.stroke();
    }
    // shots
    for (const sh of g.shots) {
      const X = this.sx(sh.x), Y = this.sy(sh.y) - 34 * s * this.depthK(sh.y), dir = Math.sign(sh.vx);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * s * 0.7;
      ctx.beginPath(); ctx.moveTo(X - dir * 14 * s, Y); ctx.lineTo(X, Y); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(X + dir * 3.5 * s, Y); ctx.lineTo(X, Y - 1.8 * s); ctx.lineTo(X, Y + 1.8 * s); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X - dir * 14 * s, Y); ctx.lineTo(X - dir * 17 * s, Y - 2.4 * s); ctx.lineTo(X - dir * 11 * s, Y); ctx.lineTo(X - dir * 17 * s, Y + 2.4 * s); ctx.fill();
    }
    this.drawFx(ctx, g);
    // order tag & speech bubble over the host
    if (h.present && !h.dead && h.state !== 'fallen') {
      const X = this.sx(h.x), Y = this.sy(h.y) - (h.state === 'hanging' ? 30 : 78) * s * this.depthK(h.y);
      if (h.order && ui.orderIcons) {
        const ic = ui.orderIcons[h.order.g];
        if (ic) {
          const sz = 22 * s * 0.6 + 10, cy = Y - sz / 2 - 2;
          ctx.fillStyle = 'rgba(28,15,7,.85)'; ctx.beginPath(); ctx.arc(X, cy, sz * 0.56, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(242,194,92,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, cy, sz * 0.56, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(h.order.t / (h.order.g === 'point' ? 7 : 5), 0, 1)); ctx.stroke();
          ctx.drawImage(ic, X - sz / 2, cy - sz / 2, sz, sz);
        }
      }
      if (h.state === 'downed' || h.state === 'hanging') this.bleedRing(ctx, X, Y + (h.state === 'hanging' ? -2 : 40 * s), h, g);
      if (this.bubble && this.bubble.t > 0) {
        const bub = this.bubble;
        bub.t -= dt;
        const a = Math.min(1, bub.t * 3, (bub.life - bub.t) * 8);
        this.speech(ctx, X, Y - (h.order ? 20 * s * 0.6 + 12 : 4), bub.text, a);
      }
    }
    // off-screen markers: where the host is, and who is about to swing from out of view
    this.edgeMarks(ctx, g);
    // a dashed reach ring under the player while raising
    if (p.state === 'raise') { const X = this.sx(h.x), Y = this.sy(h.y); ctx.strokeStyle = 'rgba(255,245,215,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y - 12 * s, 14 * s, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(h.raise, 0, 1)); ctx.stroke(); }
    // valance at the top of the screen (scalloped)
    this.valance(ctx);
    // vignette & hurt flash
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 2.5); ctx.fillStyle = `rgba(120,20,10,${this.flash * 0.35})`; ctx.fillRect(0, 0, this.w, this.h); }
    if (this.curtain > 0.004) this.curtains(ctx, this.curtain);
  }
  drawBody(ctx, g, b, rods) {
    const s = this.s;
    const X = this.sx(b.x), Y = this.sy(b.y), k = this.depthK(b.y);
    if (X < -150 || X > this.w + 150) return;
    let alpha = 1;
    if (b.dead) { alpha = Math.max(0, 1 - Math.max(0, b.t - 0.4) * 1.2); if (alpha <= 0) return; }
    if (b.fell) return;
    const r = [];
    if (b.kind === 'boss') {
      drawBoss(ctx, b, { x: X, y: Y, s: s * k * b.scale, alpha, rods: r }, this.t);
      for (const q of r) rods.push(q);
      return;
    }
    const P = poseFor(b, b.kind, this.t);
    let o = { x: X, y: Y, s: s * k, face: b.face, P, alpha, flash: b.flash, t: this.t, walk: b.walk, mv: b.mv, dpr: this.dpr, rods: r };
    if (b.kind === 'player') {
      Object.assign(o, { mode: 'light', build: 'shade', head: 'shade', weapon: 'light', deco: 'dots' });
      if (b.iframe > 0 && b.state !== 'roll') o.alpha = 0.5 + Math.sin(this.t * 40) * 0.3;
    } else if (b.kind === 'host') {
      const d = g.def;
      Object.assign(o, { mode: 'dye', dye: d.dye, dark: d.dyeDark, build: d.build, head: d.key, weapon: P.flask ? null : d.weapon, shield: d.shield, deco: d.key === 'plume' ? 'flower' : d.key === 'gorm' ? 'ring' : 'rows' });
      P.hats = b.hats;
      if (b.state === 'hanging') {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.w, Y); ctx.clip();
        drawPuppet(ctx, o); ctx.restore();
        for (const q of r) rods.push(q);
        return;
      }
      if (b.state === 'fallen') return;
    } else {
      const look = b.look, ty = b.type;
      const heads = { monk: 'monk', thorn: 'thorn', ash: 'ash', prop: 'helm' };
      const builds = { husk: look === 'monk' ? 'husk' : 'soldier', pike: 'soldier', archer: 'slim', prop: 'man', dummy: 'man' };
      Object.assign(o, { mode: 'ink', build: builds[ty] || 'man', head: ty === 'pike' ? (look === 'monk' ? 'monk' : 'helm') : ty === 'archer' ? 'cap' : heads[look] || 'monk', weapon: ty === 'husk' ? (look === 'monk' ? 'club' : look === 'thorn' ? 'club' : 'sword') : ty === 'pike' ? 'pike' : ty === 'archer' ? 'bow' : ty === 'prop' ? 'wood' : null, deco: look === 'thorn' ? 'dots' : 'rows' });
      if (ty === 'dummy') { this.dummy(ctx, X, Y, s * k, b); return; }
      if (b.pointed > 0) this.star(ctx, X, Y - 74 * s * k, 7 * s * 0.6 * (0.6 + b.pointed * 0.4), 0.9);
    }
    drawPuppet(ctx, o);
    const light = b.kind === 'player';
    for (const q of r) rods.push([q[0], q[1], light]);
  }
  dummy(ctx, X, Y, s, b) {
    ctx.save(); ctx.translate(X, Y); ctx.scale(s, s);
    const wob = b.flash > 0 ? Math.sin(this.t * 60) * 0.12 : 0;
    ctx.rotate(wob);
    ctx.fillStyle = b.flash > 0 ? '#5c1a0e' : INK;
    const p = new Path2D();
    p.rect(-1.2, -40, 2.4, 40);
    p.moveTo(-8, -48); p.quadraticCurveTo(-10, -30, -7, -24); p.lineTo(7, -24); p.quadraticCurveTo(10, -30, 8, -48); p.closePath();
    p.rect(-14, -46, 28, 3);
    p.moveTo(6, -54); p.arc(0, -54, 6, 0, TAU);
    for (let i = 0; i < 4; i++) { p.moveTo(-6 + i * 4, -24); p.lineTo(-5 + i * 4, -18); p.lineTo(-4 + i * 4, -24); }
    hole(p, 0, -36, 2.2); hole(p, 0, -36, 1);
    ctx.fill(p, 'evenodd');
    ctx.restore();
  }
  telegraph(ctx, f, a) {
    const s = this.s;
    const k = 1 - a.tLeft / a.dur;
    const big = f.kind === 'boss';
    const al = big ? 0.18 + 0.4 * k : 0.08 + 0.2 * k;
    ctx.save();
    const red = `rgba(150,24,12,${al})`, rim = `rgba(120,16,8,${big ? 0.75 : 0.45})`;
    if (a.kind === 'melee' || a.kind === 'lunge' || a.kind === 'shot') {
      const x0 = a.kind === 'lunge' ? a.x : f.x, y0 = a.kind === 'lunge' ? a.y : f.y;
      const x1 = x0 + a.face * a.reach * (a.kind === 'shot' ? 1 : k > 0.95 ? 1 : 0.4 + 0.6 * ease(k));
      if (a.kind === 'shot') {
        ctx.strokeStyle = `rgba(120,16,8,${0.15 + k * 0.35})`; ctx.setLineDash([3 * s, 4 * s]); ctx.lineWidth = 1.2;
        const Y = this.sy(y0) - 34 * s * this.depthK(y0);
        ctx.beginPath(); ctx.moveTo(this.sx(x0), Y); ctx.lineTo(this.sx(x0 + a.face * 260), Y); ctx.stroke();
      } else {
        ctx.fillStyle = red; ctx.strokeStyle = rim; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(this.sx(x0), this.sy(y0 + a.depth)); ctx.lineTo(this.sx(x1), this.sy(y0 + a.depth));
        ctx.lineTo(this.sx(x1), this.sy(y0 - a.depth)); ctx.lineTo(this.sx(x0), this.sy(y0 - a.depth)); ctx.closePath();
        ctx.fill(); if (big) ctx.stroke();
      }
    } else if (a.kind === 'aoe') {
      ctx.fillStyle = red; ctx.strokeStyle = rim; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(this.sx(a.x), this.sy(a.y), a.r * s, a.r * s * K, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(this.sx(a.x), this.sy(a.y), a.r * s * ease(k), a.r * s * K * ease(k), 0, 0, TAU); ctx.fill();
    } else if (a.kind === 'multi') {
      for (const sp of a.spots) {
        ctx.fillStyle = red; ctx.strokeStyle = rim; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.ellipse(this.sx(sp.x), this.sy(sp.y), sp.r * s, sp.r * s * K, 0, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(this.sx(sp.x), this.sy(sp.y), sp.r * s * k, sp.r * s * K * k, 0, 0, TAU); ctx.fill();
        // embers falling
        const fy = lerp(-20, this.sy(sp.y), k);
        ctx.fillStyle = 'rgba(40,12,4,.8)';
        ctx.beginPath(); ctx.arc(this.sx(sp.x), fy, 2.5 * s * 0.7, 0, TAU); ctx.fill();
      }
    }
    // a glint over the attacker's head — it's about to strike
    if (k > 0.45 && a.kind !== 'howl') {
      const hy = f.kind === 'boss' ? 90 * f.scale : 72;
      this.star(ctx, this.sx(f.x) + f.face * 6 * s, this.sy(f.y) - hy * s * this.depthK(f.y), (big ? 9 : 6) * s * 0.6 * (0.6 + 0.4 * Math.sin(k * Math.PI)), 1, true);
    }
    ctx.restore();
  }
  star(ctx, x, y, r, a, red) {
    ctx.save(); ctx.globalAlpha *= a;
    ctx.fillStyle = red ? '#fff0c8' : '#fffbe8';
    ctx.shadowColor = red ? 'rgba(200,40,20,.9)' : 'rgba(255,240,200,.9)'; ctx.shadowBlur = r * this.dpr * 1.2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r; const ang = i / 8 * TAU - Math.PI / 2; ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  bleedRing(ctx, x, y, h, g) {
    const s = this.s;
    const left = h.state === 'downed' ? 1 - h.t / h.bleed : 1 - h.t / h.hangFor;
    const R = 13 * s * 0.6 + 6;
    ctx.save();
    ctx.fillStyle = 'rgba(28,15,7,.75)'; ctx.beginPath(); ctx.arc(x, y - R - 4, R + 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = left < 0.35 ? '#e0442c' : '#f2c25c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y - R - 4, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(left, 0, 1)); ctx.stroke();
    if (h.raise > 0) { ctx.strokeStyle = '#fff3d2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - R - 4, R - 4, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(h.raise, 0, 1)); ctx.stroke(); }
    ctx.fillStyle = '#f5e6c4'; ctx.font = `600 ${Math.round(R * 0.95)}px 'Grenze Gotisch', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(h.state === 'hanging' ? '!' : '✝', x, y - R - 3);
    ctx.restore();
  }
  speech(ctx, x, y, text, a) {
    const s = this.s;
    const fs = Math.round(clamp(8.5 * s, 13, 19));
    ctx.save();
    ctx.globalAlpha *= clamp(a, 0, 1);
    ctx.font = `italic ${fs}px 'Sorts Mill Goudy', Georgia, serif`;
    const maxW = Math.min(this.w * 0.62, 260);
    const lines = wrap(ctx, text, maxW);
    const lh = fs * 1.15;
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.1;
    const hh = lines.length * lh + fs * 0.7;
    let bx = clamp(x - w / 2, 8, this.w - w - 8), by = y - hh - 10;
    if (by < 70) by = 70;
    // a strip of cut paper: ragged ends
    ctx.fillStyle = '#f6e8c6'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx, by + 2); ctx.lineTo(bx + w, by);
    ctx.lineTo(bx + w - 3, by + hh * 0.35); ctx.lineTo(bx + w + 2, by + hh * 0.6); ctx.lineTo(bx + w, by + hh);
    const tx = clamp(x, bx + 14, bx + w - 14);
    ctx.lineTo(tx + 6, by + hh); ctx.lineTo(tx - 2, by + hh + 9); ctx.lineTo(tx - 6, by + hh);
    ctx.lineTo(bx, by + hh + 1); ctx.lineTo(bx + 3, by + hh * 0.55); ctx.lineTo(bx - 2, by + hh * 0.3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + fs * 0.35 + i * lh));
    ctx.restore();
  }
  paperNote(ctx, x, y, text, a, small) {
    const s = this.s;
    const fs = Math.round(clamp(7 * s, 12, 16));
    ctx.save(); ctx.globalAlpha *= a;
    ctx.font = `${fs}px 'Sorts Mill Goudy', Georgia, serif`;
    const w = ctx.measureText(text).width + fs;
    const bx = clamp(x - w / 2, 6, this.w - w - 6), by = y - fs * 1.6;
    ctx.fillStyle = INK; ctx.fillRect(bx - 2, by - 2, w + 4, fs * 1.6 + 4);
    ctx.fillStyle = '#f2d79c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + w / 2, by + fs * 0.82);
    ctx.restore();
  }
  drawFx(ctx, g) {
    const s = this.s;
    for (const f of g.fx) {
      const X = this.sx(f.x), Y = this.sy(f.y), k = this.depthK(f.y);
      const life = f.life || 0.6, q = f.t / life;
      if (f.k === 'slash') {
        const big = f.big || f.who === 'boss';
        const reach = big ? (f.reach || 110) : f.who === 'foe' ? (f.long ? 80 : 40) : 46;
        const col = f.who === 'player' ? 'rgba(255,246,220,' : f.who === 'host' ? g.def.dye : 'rgba(28,15,7,';
        ctx.save();
        ctx.translate(X, Y - 32 * s * k * (big ? 1.4 : 1)); ctx.scale(f.face, 1);
        const a = 1 - q;
        ctx.fillStyle = f.who === 'host' ? hexA(col, a * 0.7) : col + (a * (f.who === 'player' ? 0.95 : 0.55)) + ')';
        if (f.who === 'player') { ctx.shadowColor = 'rgba(255,240,200,.9)'; ctx.shadowBlur = 10 * this.dpr; }
        const R = reach * s * k * 0.85, sweep = f.n === 2 ? 1.7 : 1.25, st = -sweep / 2 + (f.n === 1 ? 0.4 : -0.1);
        ctx.beginPath();
        ctx.arc(0, 0, R, st, st + sweep * Math.min(1, q * 3));
        ctx.arc(R * 0.18, 0, R * 0.8, st + sweep * Math.min(1, q * 3), st, true);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (f.k === 'spark') {
        const r = rand(Math.floor(f.seed * 1e6));
        ctx.fillStyle = INK;
        for (let i = 0; i < f.n; i++) {
          const ang = r() * TAU, sp = 40 + r() * 70;
          const px = X + Math.cos(ang) * sp * f.t * s, py = Y - f.z * s * k + (Math.sin(ang) * sp * f.t + 160 * f.t * f.t) * s;
          const sz = (2 + r() * 2.5) * s * 0.7 * (1 - q);
          ctx.save(); ctx.translate(px, py); ctx.rotate(r() * 6 + f.t * 10);
          ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.4); ctx.lineTo(sz, 0); ctx.lineTo(-sz * 0.3, sz); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      } else if (f.k === 'ring') {
        ctx.strokeStyle = `rgba(255,246,220,${1 - q})`; ctx.lineWidth = 3 * (1 - q) + 1;
        ctx.beginPath(); ctx.ellipse(X, Y, 240 * s * ease(q), 240 * s * K * ease(q), 0, 0, TAU); ctx.stroke();
      } else if (f.k === 'boom') {
        ctx.fillStyle = `rgba(28,15,7,${0.5 * (1 - q)})`;
        if (f.spots) for (const sp of f.spots) { ctx.beginPath(); ctx.ellipse(this.sx(sp.x), this.sy(sp.y), sp.r * s * (1 + q * 0.3), sp.r * s * K * (1 + q * 0.3), 0, 0, TAU); ctx.fill(); }
        else { ctx.beginPath(); ctx.ellipse(X, Y, (f.r || 100) * s * (0.9 + q * 0.2), (f.r || 100) * s * K * (0.9 + q * 0.2), 0, 0, TAU); ctx.fill(); }
      } else if (f.k === 'drop') {
        // a puppet falls through the gap
        ctx.save(); ctx.globalAlpha = 1 - q;
        ctx.fillStyle = f.who === 'player' ? LIGHT : INK;
        ctx.translate(X, Y + q * q * 160 * s); ctx.rotate(q * 2);
        ctx.fillRect(-6 * s, -40 * s * k, 12 * s, 40 * s * k);
        ctx.restore();
      } else if (f.k === 'poof') {
        ctx.fillStyle = `rgba(28,15,7,${0.4 * (1 - q)})`;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(X + (i - 2) * 6 * s, Y - 6 * s - q * 14 * s, 4 * s * (1 - q * 0.5), 0, TAU); ctx.fill(); }
      }
    }
  }
  edgeMarks(ctx, g) {
    const s = this.s, h = g.h, pad = 14;
    const mark = (x, y, col, ring, lbl) => {
      const X = this.sx(x); if (X > -4 && X < this.w + 4) return;
      const side = X < 0 ? -1 : 1, ex = side < 0 ? pad : this.w - pad, ey = clamp(this.sy(y) - 30 * s, 90, this.h - 60);
      ctx.save();
      ctx.fillStyle = col; ctx.strokeStyle = ring; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex + side * 8, ey); ctx.lineTo(ex - side * 6, ey - 10); ctx.lineTo(ex - side * 6, ey + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (lbl) { ctx.font = `600 ${Math.round(clamp(6 * s, 11, 14))}px 'Grenze Gotisch', serif`; ctx.textAlign = side < 0 ? 'left' : 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(lbl, ex - side * 10, ey - 18); }
      ctx.restore();
    };
    if (h.present && h.state !== 'fallen') mark(h.x, h.y, g.def.dye, h.state === 'downed' || h.state === 'hanging' ? '#e0442c' : 'rgba(28,15,7,.8)', h.state === 'downed' || h.state === 'hanging' ? 'help!' : '');
    for (const f of g.foes) if (!f.dead && f.state === 'wind' && f.atk) mark(f.x, f.y, '#a8281b', 'rgba(28,15,7,.8)', '');
  }
  valance(ctx) {
    const s = this.s, w = this.w;
    const hgt = Math.max(10, 8 * s);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, hgt);
    const n = Math.ceil(w / (28 * s * 0.8));
    const step = w / n;
    for (let i = n; i > 0; i--) { const x = i * step; ctx.quadraticCurveTo(x - step / 2, hgt + step * 0.45, x - step, hgt); }
    ctx.closePath(); ctx.fill();
    // tassels
    for (let i = 1; i < n; i++) { const x = i * step; ctx.fillRect(x - 0.8, hgt, 1.6, step * 0.32); ctx.beginPath(); ctx.moveTo(x - 2.5, hgt + step * 0.32); ctx.lineTo(x + 2.5, hgt + step * 0.32); ctx.lineTo(x, hgt + step * 0.5); ctx.fill(); }
    // punched band
    ctx.fillStyle = 'rgba(242,194,92,.45)';
    for (let i = 0; i < n * 2; i++) { ctx.beginPath(); ctx.arc((i + 0.5) * step / 2, hgt * 0.55, 1.1, 0, TAU); ctx.fill(); }
  }
  curtains(ctx, c) {
    // velvet curtains drawn in from both sides: c 0 = open, 1 = shut
    const w = this.w, h = this.h;
    const half = w / 2 * ease(clamp(c, 0, 1));
    for (const side of [0, 1]) {
      const x0 = side ? w - half : 0;
      const g = ctx.createLinearGradient(x0, 0, x0 + half, 0);
      const folds = 7;
      for (let i = 0; i <= folds; i++) { g.addColorStop(i / folds, i % 2 ? '#3a0e0a' : '#5e1912'); }
      ctx.fillStyle = g;
      ctx.beginPath();
      if (!side) { ctx.moveTo(0, 0); ctx.lineTo(half, 0); ctx.quadraticCurveTo(half - 20 * (1 - c), h * 0.6, half + 8 * (1 - c), h); ctx.lineTo(0, h); }
      else { ctx.moveTo(w, 0); ctx.lineTo(w - half, 0); ctx.quadraticCurveTo(w - half + 20 * (1 - c), h * 0.6, w - half - 8 * (1 - c), h); ctx.lineTo(w, h); }
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = `rgba(20,6,3,${0.35 * c})`;
    ctx.fillRect(0, 0, w, h);
  }

  // a single puppet drawn into a small canvas (title cards, gesture icons)
  portrait(kind, opts = {}) {
    const W = opts.w || 120, H = opts.h || 120, sc = opts.scale || 1.4, dpr = Math.min(2, this.dpr || 2);
    const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const P = basePose();
    if (opts.pose) opts.pose(P);
    const o = { x: W / 2 + (opts.dx || 0), y: H - (opts.base ?? 10), s: sc, face: opts.face || 1, P, t: 0, walk: 0, mv: 0, dpr };
    if (kind === 'player') Object.assign(o, { mode: 'light', build: 'shade', head: 'shade', weapon: opts.weapon === false ? null : 'light', deco: 'dots' });
    else if (opts.def) Object.assign(o, { mode: 'dye', dye: opts.def.dye, dark: opts.def.dyeDark, build: opts.def.build, head: opts.def.key, weapon: opts.def.weapon, shield: opts.def.shield, deco: opts.def.key === 'plume' ? 'flower' : opts.def.key === 'gorm' ? 'ring' : 'rows' });
    else Object.assign(o, { mode: 'ink', build: 'husk', head: 'monk', weapon: 'club' });
    if (opts.ink) { o.mode = 'ink'; }
    drawPuppet(x, o);
    return c;
  }
}

function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
