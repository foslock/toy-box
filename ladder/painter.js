// Ladder: the painter. A small person in white overalls, drawn in profile in flat, faded paint with one soft outline
// per layer (far limbs, body, near arm), so the joins don't show. pose() works out the joints for whatever they're
// doing: standing about, walking and running with a proper gait, climbing rung by rung, stepping off, hauling,
// falling, lying there, sitting up and getting up. Metres, y up.
import { LADDER } from './physics.js';
import { fade, shade, rgba, rng } from './paint.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = k => k * k * (3 - 2 * k);
const ease = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = a => Math.hypot(a[0], a[1]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const rotv = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
const mixv = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// about 1.67 m tall: hips at 0.88, shoulders at 1.36, the top of the head at 1.67
const THIGH = 0.43, SHIN = 0.42, ANKLE = 0.07, TORSO = 0.48, UPPER = 0.29, FORE = 0.27, HIP_H = 0.905;

export const ME = { suit: [236, 230, 214], shirt: fade('#5f86a6', 0.35), skin: [220, 176, 140], cap: fade('#c0503c', 0.2), boot: [102, 74, 58], hair: [96, 66, 50], ink: [66, 44, 40] };
export const OLD = { suit: fade('#6f8fb0', 0.3), shirt: [214, 206, 190], skin: [212, 168, 134], cap: null, hair: [228, 224, 216], beard: true, boot: [86, 70, 60], ink: [66, 44, 40] };

// the middle joint (knee, elbow) of a two-bone limb from a toward b, bending toward pref
function bend(a, b, l1, l2, pref) {
  const d = sub(b, a), D = len(d), u = norm(d);
  if (D >= l1 + l2 - 1e-4) return { j: add(a, u, l1), e: add(a, u, l1 + l2) };
  const Dc = Math.max(D, Math.abs(l1 - l2) + 1e-3), x = (l1 * l1 - l2 * l2 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const m = add(a, u, x), n = [-u[1], u[0]], s = n[0] * pref[0] + n[1] * pref[1] >= 0 ? 1 : -1;
  return { j: add(m, n, h * s), e: b };
}
// a torso from the hip, tipped forward by lean (and down by droop), with its front toward face
function trunk(hip, lean, face, extra = 0) {
  const up = [Math.sin(lean) * face, Math.cos(lean)];
  const sh = add(hip, up, TORSO + extra);
  return { hip, sh, up, front: [up[1] * face, -up[0] * face] };
}
function leg(B, ankle, pref, toe, near) { const k = bend(B.hip, ankle, THIGH, SHIN, pref); return { a: B.hip, j: k.j, e: k.e, toe, near }; }
function arm(B, hand, pref, near, from) { const s = from || B.sh; const k = bend(s, hand, UPPER, FORE, pref); return { a: s, j: k.j, e: k.e, near }; }
const along = (lad, s, out = 0, side = 1) => { const c = Math.cos(lad.a), n = Math.sin(lad.a); return [lad.fx + c * s - n * out * side, lad.fy + n * s + c * out * side]; };
function nearestOnLadder(lad, p, s0 = 0, s1 = LADDER.L) {
  const c = Math.cos(lad.a), s = Math.sin(lad.a), u = clamp((p[0] - lad.fx) * c + (p[1] - lad.fy) * s, s0, s1);
  return [lad.fx + c * u, lad.fy + s * u];
}
function finish(P) {
  if (P.back) return P;
  // the head sits on the neck, a little forward of the spine, turned up or down by look
  const hu = rotv(P.up, (P.look || 0) * P.face * 0.7), hf = [hu[1] * P.face, -hu[0] * P.face];
  P.head = add(add(P.sh, P.up, 0.2), P.front, 0.015);
  P.hu = P.front[1] * P.face < -0.5 ? P.up : hu; P.hf = P.front[1] * P.face < -0.5 ? P.front : hf;
  if (P.lyingBack) { P.hu = P.up; P.hf = P.front; }
  return P;
}

/* ---------------------------------------------------------------------------------------------- standing up */
// Standing, walking or running at (x, y). o: { walk, run, dist (metres walked, drives the stride), lean, crouch,
// look, legsOnly } — hands come back relaxed or swinging; callers move them where they're needed.
export function upright(x, y, face, t, o = {}) {
  const f = face, w = o.walk || 0, run = o.run || 0;
  const cyc = lerp(1.3, 2.3, run), ph = (o.dist || 0) / cyc * TAU, stanceF = lerp(0.62, 0.36, run);
  const reach = lerp(0.24, 0.42, run), lift = lerp(0.09, 0.26, run);
  // the hips ride highest mid-stance and dip after each footfall; idling, a slow shift of weight and a breath
  const bob = w * lerp(0.016, 0.05, run) * Math.cos(2 * (ph - Math.PI * stanceF));
  const sway = (1 - w) * Math.sin(t * 0.45) * 0.018, breath = (1 - w) * Math.sin(t * 1.7) * 0.005;
  const hip = [x + f * 0.015 + sway, y + HIP_H - run * 0.07 - (o.crouch || 0) + bob];
  const B = trunk(hip, 0.04 + w * 0.05 + run * 0.2 + (o.lean || 0), f, breath);
  const foot = (phase, idle) => {
    let k = (((phase / TAU) % 1) + 1) % 1, dx, dy = 0, tip = 0;
    if (k < stanceF) dx = lerp(reach, -reach, k / stanceF);
    else { const s = (k - stanceF) / (1 - stanceF); dx = lerp(-reach, reach, smooth(s)); dy = lift * Math.sin(Math.PI * s); tip = -0.35 * Math.sin(Math.PI * s); }
    return { p: [x + f * lerp(idle, dx, w), y + dy * w + ANKLE], tip: tip * w };
  };
  const fN = foot(ph, 0.09 + sway * 0.5), fF = foot(ph + Math.PI, -0.1 + sway * 0.5);
  const kneePref = [f, 0.25];
  const P = { face: f, hip, sh: B.sh, up: B.up, front: B.front, look: o.look || 0, t };
  P.legs = [leg(B, fF.p, kneePref, rotv([f, 0], fF.tip * f), false), leg(B, fN.p, kneePref, rotv([f, 0], fN.tip * f), true)];
  // arms swing against the legs, more and with bent elbows when running
  const A = w * lerp(0.3, 0.85, run), bendA = lerp(0.2, 1.5, run);
  const hang = (al) => { const e = add(B.sh, rotv([0, -1], -al * f), UPPER); return add(e, rotv([0, -1], -(al + bendA) * f), FORE); };
  P.handN = hang(-A * Math.cos(ph) + 0.05); P.handF = hang(A * Math.cos(ph) + 0.05);
  P.elbowPref = [-f * 0.6, -1];
  return P;
}
function withArms(P, handN, handF, prefN, prefF) {
  const B = P; const pref = P.elbowPref || [-P.face * 0.6, -1];
  P.arms = [arm(B, handF || P.handF, prefF || pref, false), arm(B, handN || P.handN, prefN || pref, true)];
  return P;
}

/* ---------------------------------------------------------------------------------------------- on the ladder */
// Rung by rung: one foot stays on its rung while the other steps up two, then they swap; each hand moves up with
// the opposite foot. The body rides smoothly, held out from the ladder, facing it, knees forward, elbows down.
function climbing(v) {
  const L = v.lad, R = v.rider, c = Math.cos(L.a), s = Math.sin(L.a), r = LADDER.rung;
  const d = [c, s], e = [-s, c];                         // up the ladder, and across it (rail to rail)
  const at = (u, x) => [L.fx + c * u + e[0] * x, L.fy + s * u + e[1] * x];
  const rungS = k => k < 1 ? 0.02 : Math.min(LADDER.L - 0.08, k * r - 0.05);
  const u = (R.s + 0.05) / r, base = Math.floor(u / 2) * 2, ph = u - base;
  const step = (k0, k1, q) => ({ s: lerp(rungS(k0), rungS(k1), smooth(q)), lift: Math.sin(Math.PI * q) });
  const footA = ph < 1 ? { s: rungS(base), lift: 0 } : step(base, base + 2, ph - 1);
  const footB = ph < 1 ? step(base - 1, base + 1, ph) : { s: rungS(base + 1), lift: 0 };
  const handA = ph < 1 ? step(base + 4, base + 6, ph) : { s: rungS(base + 6), lift: 0 };
  const handB = ph < 1 ? { s: rungS(base + 5), lift: 0 } : step(base + 5, base + 7, ph - 1);
  // the body rides up smoothly, swaying a touch toward the foot that's taking the weight
  const sway = Math.sin(ph * Math.PI) * 0.025 * (ph < 1 ? 1 : -1);
  const hip = at(R.s + 0.52, sway), sh = at(R.s + 0.98, sway * 0.6);
  const P = { back: true, face: c >= 0 ? 1 : -1, hip, sh, up: d, d, e, front: e, t: v.t };
  const legTo = (q, x) => {
    const hp = at(R.s + 0.52, sway + x * 0.9), foot = at(q.s + 0.05, x * (1 + q.lift * 0.4));
    // a leg bent toward the ladder looks shorter from behind: the knee sits on the line, nudged outward
    const mid = mixv(hp, foot, 0.48), bentness = clamp(1 - len(sub(foot, hp)) / (THIGH + SHIN), 0, 1);
    return { a: hp, j: add(mid, e, x * (0.4 + bentness * 1.4)), e: foot, near: x > 0 };
  };
  const armTo = (q, x) => {
    const sp = at(R.s + 0.95, sway * 0.6 + x * 2.0), hand = at(Math.min(LADDER.L - 0.05, q.s), x * 0.95);
    const mid = mixv(sp, hand, 0.5), bentness = clamp(1 - len(sub(hand, sp)) / (UPPER + FORE), 0, 1);
    return { a: sp, j: add(mid, e, x * (0.35 + bentness * 1.3)), e: hand, near: x > 0 };
  };
  P.legs = [legTo(footB, -0.075), legTo(footA, 0.075)];
  P.arms = [armTo(handB, -0.085), armTo(handA, 0.085)];
  P.head = at(R.s + 1.24, sway * 0.4); P.hd = d; P.he = e;
  P.belt = at(R.s + 0.56, 0.13);
  return P;
}

/* ---------------------------------------------------------------------------------------------- everything */
export function pose(v) {
  const p = v.p, t = v.t, face = p.face || 1;
  let P;
  switch (v.mode) {
    case 'climb': P = climbing(v); break;
    case 'fall': {
      // tumbling, the near hand still clutching the ladder, everything else flailing
      const b = v.pb, sp = b.spin || 0, f = b.vx >= 0 ? 1 : -1, w1 = Math.sin(t * 13), w2 = Math.sin(t * 9 + 1);
      const at = q => add([b.x, b.y], rotv([q[0] * f, q[1]], sp));
      const hip = at([0, -0.18]), sh = at([0.03, 0.3]), up = norm(sub(sh, hip));
      P = { face: f, hip, sh, up, front: [up[1] * f, -up[0] * f], look: 0.4, t };
      const kp = rotv([f, 0.2], sp), ep = rotv([-f, -0.4], sp);
      P.legs = [leg(P, at([-0.28 + w2 * 0.12, -0.8 + w1 * 0.08]), kp, rotv([f, 0], sp), false), leg(P, at([0.22 + w1 * 0.14, -0.72 - w2 * 0.1]), kp, rotv([f, 0], sp), true)];
      const grip = v.rope ? along(v.lad, v.rope.s) : at([0.4, 0.7]);
      P.arms = [arm(P, at([-0.35 + w1 * 0.15, 0.72 + w2 * 0.12]), rotv([-f, 0.2], sp), false), arm(P, grip, ep, true)];
      P.can = { swing: w1 * 0.6 };
      break;
    }
    case 'down': P = getUp(v, p, face, t); break;
    case 'stepoff': {
      // the near foot onto the ledge first, the body following, a hand last off the top of the ladder
      const a = v.anim, k = clamp(a.t / a.T, 0, 1), kb = ease(k), f = Math.sign(a.x1 - a.x0) || face;
      const x = lerp(a.x0, a.x1, kb), y = lerp(a.y0, a.y1, kb);
      P = upright(x, y - (1 - kb) * 0.25, f, t, { lean: 0.25 * (1 - k) });
      const kf = clamp(k * 1.8, 0, 1), nf = [lerp(a.x0, a.x1 + f * 0.08, smooth(kf)), lerp(a.y0, a.y1, smooth(kf)) + Math.sin(Math.PI * kf) * 0.22 + ANKLE];
      P.legs[1] = leg(P, nf, [f, 0.3], [f, 0], true);
      const top = along(v.lad, LADDER.L - 0.12);
      withArms(P, k < 0.7 ? top : P.handN, add(P.sh, [f * 0.25, -0.25]));
      break;
    }
    case 'haul': {
      // turned back to the ladder, leaning away from it, hand over hand
      const k = v.anim.t / v.anim.T, f = k < 0.75 ? -face : face, pull = Math.sin(k * Math.PI * 6);
      P = upright(p.x, p.y, f, t, { lean: -0.12, crouch: 0.04 });
      const grab = nearestOnLadder(v.lad, add(P.sh, [f * 0.25, -0.2]));
      withArms(P, add(grab, [0, 0.08 * pull]), add(grab, [-f * 0.04, -0.14 - 0.08 * pull]));
      break;
    }
    case 'aim': {
      // both hands on the ladder, pushing it up and over, feet braced
      P = upright(p.x, p.y, face, t, { lean: 0.08 });
      P.legs[1] = leg(P, [p.x + face * 0.22, p.y + ANKLE], [face, 0.3], [face, 0], true);
      P.legs[0] = leg(P, [p.x - face * 0.16, p.y + ANKLE], [face, 0.3], [face, 0], false);
      withArms(P, nearestOnLadder(v.lad, add(P.sh, [face * 0.1, 0.1]), 0.9, 1.7), nearestOnLadder(v.lad, add(P.hip, [face * 0.2, 0.1]), 0.4, 1.0));
      P.look = 0.35;
      break;
    }
    case 'win': {
      const w = v.anim?.t || 0, up = clamp((w - 1.2) / 0.5, 0, 1), given = w > 2.0;
      P = upright(p.x, p.y, face, t, { walk: p.walk, dist: p.dist, look: w > 3.4 ? Math.min(1, (w - 3.4) / 0.8) : 0 });
      withArms(P, given ? null : mixv(P.handN, add(P.sh, [face * 0.42, -0.08]), up));
      P.can = given ? null : up > 0.3 ? { at: add(P.arms[1].e, [0, -0.12]) } : {};
      break;
    }
    default: {
      const S = p.shoulder || 0;
      P = upright(p.x, p.y, face, t, { walk: p.walk, run: p.run, dist: p.dist, lean: p.edge ? 0.12 : 0, look: p.edge ? -0.6 : 0.05 * Math.max(0, Math.sin(t * 0.21) * 3 - 2) });
      if (v.held === 'planted') {
        withArms(P, nearestOnLadder(v.lad, add(P.sh, [face * 0.15, 0]), 0.5, 1.7));
      } else if (S > 0.5) {
        // the ladder on the near shoulder, steadied by the near hand
        withArms(P, nearestOnLadder(v.lad, add(P.sh, [face * 0.3, 0.12])));
      } else {
        // stood upright beside them, steadied by a hand at chest height; the other arm hangs
        withArms(P, nearestOnLadder(v.lad, add(P.sh, [face * 0.25, -0.22]), 0.6, 1.6));
      }
    }
  }
  if (!P.arms) withArms(P);
  return finish(P);
}

// after a fall: on their back a while, then up onto an elbow, sitting and looking back up the heap, then up
function getUp(v, p, face, t) {
  const a = v.anim, lie = a.lie, k = a.t, x = p.x, y = p.y, f = face;
  const P = { face: f, t };
  if (k < lie) {
    const br = Math.sin(t * 1.4) * 0.008;
    P.hip = [x - f * 0.2, y + 0.12]; P.sh = [x + f * 0.28, y + 0.14 + br];
    P.up = norm(sub(P.sh, P.hip)); P.front = [0, 1]; P.lyingBack = true;
    P.face = f;
    P.legs = [leg(P, [x - f * 0.98, y + ANKLE], [0, 1], [0, 1], false), leg(P, [x - f * 0.55, y + ANKLE], [0, 1], [0, 1], true)];
    P.arms = [arm(P, [x + f * 0.6, y + 0.05], [0, 1], false), arm(P, [x + f * 0.05, y + 0.22], [0, 1], true)];
    P.look = 0; P.can = { at: [x - f * 0.05, y + 0.1] };
    return P;
  }
  const u = clamp((k - lie) / 1.0, 0, 1), w = clamp((k - lie - 1.0) / 0.7, 0, 1);
  if (w <= 0) {
    // sitting up, legs out in front, propped on a hand, looking back up at where they were
    const tor = lerp(1.45, 0.35, ease(u));
    P.hip = [x, y + 0.13];
    P.up = [Math.sin(tor) * -f, Math.cos(tor)]; P.sh = add(P.hip, P.up, TORSO);
    P.front = [P.up[1] * f, -P.up[0] * f];
    P.legs = [leg(P, [x + f * 0.82, y + ANKLE], [0, 1], [f * 0.3, 1], false), leg(P, [x + f * 0.62, y + ANKLE + 0.02], [0, 1], [f * 0.3, 1], true)];
    P.arms = [arm(P, [x - f * 0.3, y + 0.03], [-f, 0], false), arm(P, lerp(0, 1, u) > 0.5 ? [x + f * 0.42, y + 0.32] : [x - f * 0.1, y + 0.05], [-f, -0.5], true)];
    P.look = lerp(0, 0.7, ease(u));
    return P;
  }
  // onto a knee, then up, slowly
  const e = ease(w);
  const Q = upright(x, y, f, t, { crouch: (1 - e) * 0.5, lean: (1 - e) * 0.45 });
  Q.legs[1] = leg(Q, [x + f * lerp(0.3, 0.09, e), y + ANKLE], [f, 0.4], [f, 0], true);
  Q.legs[0] = leg(Q, [x - f * lerp(0.35, 0.1, e), y + lerp(0.05, ANKLE, e)], [f, -0.2], [f, 0], false);
  withArms(Q, add(Q.legs[1].j, [f * 0.05, 0.05]), null);
  Q.look = -0.2 * (1 - e);
  return Q;
}

// the old painter at the top: waits by the easel, takes the can, paints the sky
export function npcPose(x, y, t, w) {
  const P = upright(x, y, 1, t + 3, { look: 0.25 + 0.25 * Math.max(0, Math.sin(t * 0.37)) });
  let hand = add(P.sh, [0.2, -0.5]), handF = add(P.sh, [-0.16, -0.48]), brush = -1.2, wet = false;
  if (w >= 2.0) handF = add(P.hip, [-0.18, -0.1]);
  if (w >= 2.6 && w < 3.2) { hand = add(P.hip, [-0.12, 0.0]); brush = -1.9; wet = true; }
  if (w >= 3.2 && w < 6.5) {
    const k = clamp((w - 3.2) / 3.0, 0, 1), sweep = Math.sin(k * Math.PI) * 0.5;
    hand = add(P.sh, [0.3 + sweep * 0.3, 0.45 + Math.sin(k * 9) * 0.05]); brush = 0.9 - sweep; wet = true; P.look = 1;
  }
  withArms(P, hand, handF);
  P.brush = brush; P.wet = wet; P.can = w >= 2.0 ? { at: add(P.arms[0].e, [0, -0.12]) } : null;
  return finish(P);
}

/* ---------------------------------------------------------------------------------------------- drawing */
const R0 = rng(7);
function capsule(a, b, r1, r2) {
  // one closed outline: down one side, round the far end, back up the other side, round the near end
  const d = sub(b, a), th = Math.atan2(d[1], d[0]) || 0, n = [-Math.sin(th), Math.cos(th)], p = new Path2D();
  p.moveTo(a[0] + n[0] * r1, a[1] + n[1] * r1); p.lineTo(b[0] + n[0] * r2, b[1] + n[1] * r2);
  p.arc(b[0], b[1], r2, th + Math.PI / 2, th - Math.PI / 2, true);
  p.lineTo(a[0] - n[0] * r1, a[1] - n[1] * r1);
  p.arc(a[0], a[1], r1, th - Math.PI / 2, th + Math.PI / 2, true);
  p.closePath();
  return p;
}
// a closed smooth shape through points, in a frame (origin o, axes ax and ay)
function blobPath(o, ax, ay, pts) {
  const P = pts.map(([a, b]) => [o[0] + ax[0] * a + ay[0] * b, o[1] + ax[1] * a + ay[1] * b]);
  const p = new Path2D(), n = P.length, mid = i => [(P[i][0] + P[(i + 1) % n][0]) / 2, (P[i][1] + P[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1); p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(i); p.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]); }
  p.closePath();
  return p;
}
// paint a layer: every outline first, then every fill, so pieces of the same layer join without seams
function layer(ctx, items, ink) {
  ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(ink, 0.72); ctx.lineWidth = 0.03;
  for (const [p] of items) ctx.stroke(p);
  for (const [p, c] of items) { ctx.fillStyle = rgba(c); ctx.fill(p); }
}
function legShapes(L, pal, dark) {
  const suit = shade(pal.suit, dark), boot = shade(pal.boot, dark * 0.5);
  const toe = norm(L.toe), upv = [-toe[1], toe[0]][1] >= 0 ? [-toe[1], toe[0]] : [toe[1], -toe[0]];
  const shoe = blobPath(L.e, toe, upv, [[-0.07, -0.02], [-0.06, -0.075], [0.15, -0.075], [0.19, -0.04], [0.15, -0.0], [0.05, 0.035], [-0.05, 0.04]]);
  return [[capsule(L.a, L.j, 0.083, 0.066), suit], [capsule(L.j, L.e, 0.064, 0.048), suit], [shoe, boot]];
}
function armShapes(A, pal, dark) {
  const shirt = shade(pal.shirt, dark), skin = shade(pal.skin, dark * 0.6);
  const cuff = add(A.e, norm(sub(A.j, A.e)), 0.07);
  return [[capsule(A.a, A.j, 0.054, 0.046), shirt], [capsule(A.j, cuff, 0.046, 0.04), shirt], [capsule(cuff, A.e, 0.036, 0.033), skin], [capsule(A.e, add(A.e, norm(sub(A.e, A.j)), 0.045), 0.04, 0.034), skin]];
}

export function drawPainter(ctx, P, pal = ME, opt = {}) {
  if (P.back) return drawBack(ctx, P, pal);
  const f = P.face, ink = pal.ink, u = P.up, fr = P.front, t = P.t || 0;
  const far = [...legShapes(P.legs[0], pal, -0.14), ...armShapes(P.arms[0], pal, -0.14)];
  layer(ctx, far, ink);
  // body: the torso, the near leg, neck and head
  const T = blobPath(P.hip, u, fr, [[-0.06, -0.115], [-0.04, 0.11], [0.16, 0.12], [0.34, 0.125], [0.46, 0.085], [0.53, -0.02], [0.47, -0.115], [0.3, -0.13], [0.12, -0.12]]);
  const head = P.head, hu = P.hu, hf = P.hf;
  const face = blobPath(head, hu, hf, [[0.0, -0.105], [0.075, -0.085], [0.118, 0.0], [0.078, 0.085], [0.028, 0.102], [0.005, 0.104], [-0.028, 0.133], [-0.046, 0.1], [-0.064, 0.104], [-0.1, 0.086], [-0.118, 0.04], [-0.105, -0.01], [-0.12, -0.04], [-0.07, -0.095]]);
  const neck = capsule(add(P.sh, u, 0.02), add(head, hu, -0.08), 0.05, 0.048);
  layer(ctx, [...legShapes(P.legs[1], pal, 0), [T, pal.shirt], [neck, pal.skin], [face, pal.skin]], ink);
  // the overalls over the shirt: trousers up to the waist all round, a bib up the front, a strap over the shoulder
  const q = (a, b) => [P.hip[0] + u[0] * a + fr[0] * b, P.hip[1] + u[1] * a + fr[1] * b];
  ctx.save(); ctx.clip(T);
  ctx.fillStyle = rgba(pal.suit); ctx.fill(blobPath(P.hip, u, fr, [[-0.2, -0.2], [-0.2, 0.2], [0.36, 0.2], [0.37, 0.03], [0.2, -0.02], [0.17, -0.2]]));
  ctx.strokeStyle = rgba(pal.suit); ctx.lineWidth = 0.045; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(...q(0.34, 0.05)); ctx.quadraticCurveTo(...q(0.5, 0.0), ...q(0.48, -0.1)); ctx.lineTo(...q(0.18, -0.13)); ctx.stroke();
  ctx.strokeStyle = rgba(shade(pal.suit, -0.16)); ctx.lineWidth = 0.01;
  ctx.beginPath(); ctx.moveTo(...q(0.19, -0.14)); ctx.lineTo(...q(0.2, 0.0)); ctx.lineTo(...q(0.36, 0.02)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(...q(0.3, 0.12)); ctx.lineTo(...q(0.24, 0.12)); ctx.lineTo(...q(0.24, 0.05)); ctx.stroke();
  for (const [a, b, r, c] of [[0.1, 0.06, 0.02, '#4f7fbf'], [0.27, 0.08, 0.014, '#d0603e'], [-0.02, -0.07, 0.017, '#4f7fbf'], [0.05, -0.1, 0.011, '#e0b040']]) { ctx.fillStyle = rgba(fade(c, 0.35), 0.85); ctx.beginPath(); ctx.arc(...q(a, b), r, 0, TAU); ctx.fill(); }
  ctx.restore();
  // the face: ear, eye and brow; then hair and a cap with a brim, or an old man's white hair and beard
  const h = (a, b) => [head[0] + hu[0] * a + hf[0] * b, head[1] + hu[1] * a + hf[1] * b];
  ctx.fillStyle = rgba(pal.hair); ctx.fill(blobPath(head, hu, hf, [[0.07, -0.108], [0.02, -0.112], [-0.05, -0.1], [-0.07, -0.07], [-0.02, -0.06], [0.03, -0.035], [0.06, -0.03], [0.07, -0.06]]));
  ctx.fillStyle = rgba(shade(pal.skin, -0.07)); ctx.beginPath(); ctx.ellipse(...h(-0.0, -0.045), 0.022, 0.03, Math.atan2(hu[1], hu[0]), 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(shade(pal.skin, -0.25)); ctx.lineWidth = 0.007; ctx.beginPath(); ctx.arc(...h(0.0, -0.045), 0.012, 0, TAU); ctx.stroke();
  const blink = (Math.sin(t * 0.83) > 0.992) || P.lyingBack;
  ctx.fillStyle = 'rgb(46,32,30)'; ctx.strokeStyle = 'rgb(46,32,30)';
  if (blink) { ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(...h(0.02, 0.05)); ctx.lineTo(...h(0.02, 0.075)); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(...h(0.022, 0.064), 0.011, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = rgba(shade(pal.hair, -0.1)); ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(...h(0.052, 0.042)); ctx.lineTo(...h(0.058, 0.09)); ctx.stroke();
  if (pal.beard) {
    ctx.fillStyle = rgba(pal.hair);
    ctx.fill(blobPath(head, hu, hf, [[0.07, -0.1], [0.11, -0.04], [0.12, 0.03], [0.08, 0.05], [0.04, -0.03], [-0.02, -0.07], [0.0, -0.105]]));
    ctx.fill(blobPath(head, hu, hf, [[-0.02, 0.02], [-0.05, 0.1], [-0.1, 0.1], [-0.135, 0.05], [-0.11, -0.02], [-0.06, -0.03]]));
  }
  if (pal.cap) {
    const capP = blobPath(head, hu, hf, [[0.035, -0.115], [0.1, -0.09], [0.14, -0.01], [0.125, 0.06], [0.075, 0.1], [0.05, 0.085], [0.045, -0.02]]);
    const brim = blobPath(head, hu, hf, [[0.07, 0.07], [0.068, 0.205], [0.05, 0.2], [0.048, 0.07]]);
    layer(ctx, [[brim, shade(pal.cap, -0.18)], [capP, pal.cap]], ink);
  }
  // the paint can, hung off the belt on a wire handle, or held
  drawCan(ctx, P, opt.noCan);
  // the near arm over everything; its outline stops at the body so the shoulder joins on cleanly
  const armS = armShapes(P.arms[1], pal, 0);
  ctx.save(); const out = new Path2D(); out.rect(P.hip[0] - 5, P.hip[1] - 5, 10, 10); out.addPath(T); ctx.clip(out, 'evenodd');
  ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(ink, 0.72); ctx.lineWidth = 0.03; for (const [pp] of armS) ctx.stroke(pp);
  ctx.restore();
  for (const [pp, c] of armS) { ctx.fillStyle = rgba(c); ctx.fill(pp); }
  if (P.brush != null) {
    const [bx, by] = P.arms[1].e, a = P.brush;
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgb(150,106,70)'; ctx.lineWidth = 0.028; ctx.beginPath(); ctx.moveTo(bx - Math.cos(a) * 0.06, by - Math.sin(a) * 0.06); ctx.lineTo(bx + Math.cos(a) * 0.22, by + Math.sin(a) * 0.22); ctx.stroke();
    ctx.strokeStyle = P.wet ? 'rgb(52,118,212)' : 'rgb(214,196,160)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * 0.22, by + Math.sin(a) * 0.22); ctx.lineTo(bx + Math.cos(a) * 0.32, by + Math.sin(a) * 0.32); ctx.stroke();
  }
}
function drawCan(ctx, P, noCan) {
  if (noCan || P.can === null) return;
  const c = P.can || {}, f = P.face || 1;
  let x, y;
  if (c.at) { [x, y] = c.at; }
  else {
    // hooked on the belt at the hip, swinging a little
    const belt = P.belt || add(add(P.hip, P.up, 0.05), P.front, -0.07), sw = Math.sin((P.t || 0) * 3.1) * 0.02 + (c.swing || 0) * 0.1;
    x = belt[0] + sw; y = belt[1] - 0.19;
    ctx.strokeStyle = 'rgba(80,76,74,0.9)'; ctx.lineWidth = 0.01;
    ctx.beginPath(); ctx.moveTo(x - 0.06, y + 0.07); ctx.quadraticCurveTo(belt[0], belt[1] + 0.04, x + 0.06, y + 0.07); ctx.stroke();
  }
  const w = 0.07, hh = 0.085;
  ctx.fillStyle = 'rgba(66,44,40,0.75)'; ctx.fillRect(x - w - 0.012, y - hh - 0.012, 2 * w + 0.024, 2 * hh + 0.024);
  ctx.fillStyle = 'rgb(198,196,190)'; ctx.fillRect(x - w, y - hh, 2 * w, 2 * hh);
  ctx.fillStyle = rgba(fade('#2f6fd0', 0.1)); ctx.fillRect(x - w, y - 0.035, 2 * w, 0.06);
  ctx.fillRect(x + 0.015 * f, y + 0.025, 0.022, 0.04);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - w + 0.01, y - hh + 0.01, 0.018, 2 * hh - 0.02);
}

/* ---------------------------------------------------------------------------------------------- from behind */
// On the ladder we see the painter's back, as you'd see anyone going up a ladder that faces you: hands on the
// rails, feet on the rungs, one hand and the opposite foot going up together.
function drawBack(ctx, P, pal) {
  const ink = pal.ink, e = P.e;
  const legs = [];
  for (const L of P.legs) {
    legs.push([capsule(L.a, L.j, 0.08, 0.066), shade(pal.suit, L.near ? 0 : -0.06)], [capsule(L.j, L.e, 0.064, 0.05), shade(pal.suit, L.near ? 0 : -0.06)]);
    legs.push([blobPath(L.e, P.d, e, [[-0.07, -0.07], [-0.07, 0.07], [0.02, 0.075], [0.04, 0.0], [0.02, -0.075]]), pal.boot]);
  }
  layer(ctx, legs, ink);
  // the back: shirt across the shoulders, overalls below with two straps up over them, a pocket, old paint
  const T = blobPath(P.hip, P.d, e, [[-0.06, -0.13], [-0.06, 0.13], [0.2, 0.135], [0.4, 0.19], [0.5, 0.17], [0.52, 0.0], [0.5, -0.17], [0.4, -0.19], [0.2, -0.135]]);
  layer(ctx, [[T, pal.shirt]], ink);
  const q = (a, b) => [P.hip[0] + P.d[0] * a + e[0] * b, P.hip[1] + P.d[1] * a + e[1] * b];
  ctx.save(); ctx.clip(T);
  ctx.fillStyle = rgba(pal.suit); ctx.fill(blobPath(P.hip, P.d, e, [[-0.2, -0.3], [-0.2, 0.3], [0.24, 0.3], [0.28, 0.1], [0.3, 0.0], [0.28, -0.1], [0.24, -0.3]]));
  ctx.strokeStyle = rgba(pal.suit); ctx.lineWidth = 0.045; ctx.lineCap = 'butt';
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(...q(0.25, sgn * 0.06)); ctx.lineTo(...q(0.52, sgn * 0.11)); ctx.stroke(); }
  ctx.strokeStyle = rgba(shade(pal.suit, -0.16)); ctx.lineWidth = 0.01;
  ctx.beginPath(); ctx.moveTo(...q(0.12, 0.02)); ctx.lineTo(...q(0.12, 0.1)); ctx.lineTo(...q(0.03, 0.1)); ctx.lineTo(...q(0.03, 0.02)); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(...q(-0.06, 0)); ctx.lineTo(...q(0.15, 0)); ctx.stroke();
  for (const [a, b, r, c] of [[0.05, -0.07, 0.02, '#4f7fbf'], [0.18, 0.06, 0.014, '#d0603e'], [0.22, -0.04, 0.012, '#e0b040']]) { ctx.fillStyle = rgba(fade(c, 0.35), 0.85); ctx.beginPath(); ctx.arc(...q(a, b), r, 0, TAU); ctx.fill(); }
  ctx.restore();
  drawCan(ctx, P);
  // arms up to the rails
  const arms = [];
  for (const A of P.arms) arms.push(...armShapes(A, pal, A.near ? 0 : -0.04));
  layer(ctx, arms, ink);
  // the back of the head: hair, ears, the cap from behind with its strap
  const head = P.head, hd = P.hd, he = P.he;
  const skull = blobPath(head, hd, he, [[0.11, 0], [0.08, 0.085], [0, 0.1], [-0.09, 0.08], [-0.12, 0], [-0.09, -0.08], [0, -0.1], [0.08, -0.085]]);
  const ears = [-1, 1].map(sgn => [blobPath(add(head, he, sgn * 0.1), hd, he, [[0.025, 0], [0, sgn * 0.022], [-0.03, 0], [0, -sgn * 0.01]]), pal.skin]);
  layer(ctx, [...ears, [skull, pal.hair]], ink);
  ctx.fillStyle = rgba(pal.skin); ctx.fill(blobPath(head, hd, he, [[-0.08, -0.05], [-0.115, 0], [-0.08, 0.05], [-0.16, 0.06], [-0.16, -0.06]]));
  if (pal.cap) {
    const capB = blobPath(head, hd, he, [[0.13, 0], [0.11, 0.09], [0.02, 0.112], [0.0, 0.0], [0.02, -0.112], [0.11, -0.09]]);
    layer(ctx, [[capB, pal.cap]], ink);
    ctx.fillStyle = rgba(shade(pal.cap, -0.25)); ctx.fill(blobPath(head, hd, he, [[0.035, -0.035], [0.035, 0.035], [0.005, 0.03], [0.005, -0.03]]));
  }
}
