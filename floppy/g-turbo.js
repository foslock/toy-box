// 1995: TURBO TURBO 95. EGA top-down racer. The lap counter is broken, on purpose.
const CX = 160, CY = 112, A = 78, R = 62, HW = 17;
const L = 4 * A + 2 * Math.PI * R;
const E = ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'];

export function sOf(x, y) {
  const dx = x - CX;
  if (Math.abs(dx) <= A) return y < CY ? dx + A : 2 * A + Math.PI * R + (A - dx);
  if (dx > A) { const th = Math.atan2(y - CY, dx - A); return 2 * A + (th + Math.PI / 2) * R; }
  const ph = Math.atan2(y - CY, dx + A); const psi = ph > 0 ? ph - Math.PI / 2 : ph + 1.5 * Math.PI;
  return 4 * A + Math.PI * R + psi * R;
}
export function ptAt(s, off = 0) {
  s = ((s % L) + L) % L;
  if (s < 2 * A) return [CX - A + s, CY - R - off];
  s -= 2 * A;
  if (s < Math.PI * R) { const th = s / R - Math.PI / 2; return [CX + A + Math.cos(th) * (R + off), CY + Math.sin(th) * (R + off)]; }
  s -= Math.PI * R;
  if (s < 2 * A) return [CX + A - s, CY + R + off];
  s -= 2 * A; const ph = s / R + Math.PI / 2; return [CX - A + Math.cos(ph) * (R + off), CY + Math.sin(ph) * (R + off)];
}
function distC(x, y) { const dx = Math.max(-A, Math.min(A, x - CX)); return Math.hypot(x - (CX + dx), y - CY); }
const onTrack = (x, y) => Math.abs(distC(x, y) - R) < HW;
const wrapD = (d) => (d > L / 2 ? d - L : d < -L / 2 ? d + L : d);
const lapShown = (l) => (l > 2 ? l * 2 - 1 : l);   // the bug from LAPS.BAS

export function turbo(api) {
  let cars, t, count, over, overT = 0, winner, steerPtr = 0, bg = null;
  function car(name, lane, col, stripe) {
    const [x, y] = ptAt(A - 14, lane);
    return { name, x, y, a: 0, v: 0, s: sOf(x, y), total: sOf(x, y) - A, col, stripe, done: 0, time: 0 };
  }
  function start() {
    cars = [car('MAGS II', -7, E[12], E[14]), car('THE PRIYA', 7, E[9], E[15])]; cars[0].assist = true;
    t = 0; count = 3.2; over = false; winner = null;
  }
  start();
  function drive(c, steer, brake, dt, vmax) {
    const on = onTrack(c.x, c.y);
    const top = on ? vmax : 54;
    if (brake) c.v = Math.max(0, c.v - 160 * dt);
    else c.v += Math.sign(top - c.v) * Math.min(Math.abs(top - c.v), (c.v > top ? 120 : 62) * dt);
    c.st = (c.st || 0) + (steer - (c.st || 0)) * Math.min(1, dt * 9);
    c.a += c.st * 2.4 * Math.min(1, c.v / 40) * dt;
    if (!steer && c.assist) {   // let go and the car settles along the track
      const [tx, ty] = ptAt(c.s + 30, 0); const want = Math.atan2(ty - c.y, tx - c.x);
      const d = Math.atan2(Math.sin(want - c.a), Math.cos(want - c.a)); c.a += Math.sign(d) * Math.min(Math.abs(d), 0.6 * dt);
    }
    c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
    c.x = Math.max(5, Math.min(315, c.x)); c.y = Math.max(24, Math.min(196, c.y));
    const s = sOf(c.x, c.y); c.total += wrapD(s - c.s); c.s = s;
  }
  function laps(c) { return Math.max(0, Math.floor(c.total / L)); }
  function paintBg() {
    bg = document.createElement('canvas'); bg.width = 320; bg.height = 200; const g = bg.getContext('2d');
    g.fillStyle = E[2]; g.fillRect(0, 0, 320, 200);
    for (let i = 0; i < 260; i++) { g.fillStyle = i % 3 ? E[10] : E[0]; const x = (i * 97) % 320, y = 20 + ((i * 61) % 180); g.fillRect(x, y, 2, 1); }
    const path = (w, col, dash) => {
      g.lineWidth = w; g.strokeStyle = col; g.setLineDash(dash || []);
      g.beginPath(); g.moveTo(CX - A, CY - R); g.lineTo(CX + A, CY - R); g.arc(CX + A, CY, R, -Math.PI / 2, Math.PI / 2);
      g.lineTo(CX - A, CY + R); g.arc(CX - A, CY, R, Math.PI / 2, 1.5 * Math.PI); g.closePath(); g.stroke();
    };
    // kerbs: red and white, outside and inside
    g.save(); g.beginPath();
    path(HW * 2 + 6, E[15]); path(HW * 2 + 6, E[12], [6, 6]);
    path(HW * 2, E[8]); g.restore();
    g.setLineDash([]);
    // centre dashes
    g.lineWidth = 1; path(1, E[7], [4, 8]); g.setLineDash([]);
    // start line chequers at the middle of the top straight
    for (let j = 0; j < 8; j++) for (let k = 0; k < 2; k++) { g.fillStyle = (j + k) % 2 ? E[15] : E[0]; g.fillRect(CX - 2 + k * 2, CY - R - HW + j * 4.25, 2, 4.25); }
    // infield: grandstand and trees
    g.fillStyle = E[6]; g.fillRect(CX - 52, CY - 20, 104, 40);
    g.fillStyle = E[8]; for (let r = 0; r < 4; r++) g.fillRect(CX - 50, CY - 18 + r * 9, 100, 4);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 25; i++) { g.fillStyle = E[[12, 14, 11, 13, 15][(i * 7 + r * 3) % 5]]; g.fillRect(CX - 49 + i * 4, CY - 21 + r * 9, 2, 3); }
    const tree = (x, y) => { g.fillStyle = E[0]; g.beginPath(); g.arc(x + 1, y + 1, 6, 0, 7); g.fill(); g.fillStyle = E[10]; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.fillStyle = E[2]; g.fillRect(x - 2, y - 2, 3, 3); };
    for (const [x, y] of [[CX - 66, CY - 26], [CX + 66, CY + 24], [CX - 64, CY + 22], [CX + 68, CY - 24], [12, 30], [306, 186], [12, 188], [304, 34]]) tree(x, y);
  }
  function drawCar(g, c) {
    g.save(); g.translate(Math.round(c.x), Math.round(c.y)); g.rotate(Math.round(c.a / (Math.PI / 8)) * (Math.PI / 8));
    g.fillStyle = E[0]; g.fillRect(-6, -4, 13, 9);
    g.fillStyle = c.col; g.fillRect(-6, -3, 12, 7);
    g.fillStyle = c.stripe; g.fillRect(-6, 0, 12, 1);
    g.fillStyle = E[11]; g.fillRect(1, -2, 3, 5);
    g.restore();
  }
  return {
    pad: 'lr',
    _bot() {
      if (over) return 'over';
      const me = cars[0]; const [tx, ty] = ptAt(me.s + 26, -3);
      const want = Math.atan2(ty - me.y, tx - me.x); const d = Math.atan2(Math.sin(want - me.a), Math.cos(want - me.a));
      const db = this._db || 0.12; return d < -db ? 'L' : d > db ? 'R' : '-';
    },
    _res() { return { winner: winner && winner.name, me: cars[0].done, priya: cars[1].done || null, t, gap: (cars[0].total - cars[1].total) | 0 }; },
    key(k) {
      if (over && t - overT > 0.8 && (k === 'enter' || k === 'space')) start();
    },
    pointer(type, x) {
      if (type === 'up') { steerPtr = 0; if (over && t - overT > 1.2) start(); return; }
      steerPtr = x < 320 ? -1 : 1;
    },
    stop() { api.sfx.engineOff(); },
    tick(dt) {
      t += dt;
      const [me, pr] = cars;
      if (count > 0) {
        const before = Math.ceil(count); count -= dt; const after = Math.ceil(count);
        if (after !== before) api.sfx.beep(after > 0 ? 440 : 880, after > 0 ? 0.12 : 0.3);
        api.sfx.engine(0.05);
        return;
      }
      if (!me.done) {
        let steer = (api.held.has('left') ? -1 : 0) + (api.held.has('right') ? 1 : 0) || steerPtr;
        if (api.demo) { const [tx, ty] = ptAt(me.s + 24, -4); const want = Math.atan2(ty - me.y, tx - me.x); steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(want - me.a), Math.cos(want - me.a)) * 3)); }
        drive(me, steer, api.held.has('down'), dt, 96);
        me.time = t;
      } else drive(me, 0, true, dt, 0);
      // the Priya: follows the racing line, wobbles a bit, quick on the straights
      if (!pr.done) {
        const look = pr.s + 22, [tx, ty] = ptAt(look, Math.sin(t * 0.9) * 6);
        const want = Math.atan2(ty - pr.y, tx - pr.x);
        const diff = Math.atan2(Math.sin(want - pr.a), Math.cos(want - pr.a));
        const straight = Math.abs(pr.x - CX) < A - 6;
        drive(pr, Math.max(-1, Math.min(1, diff * 3)), false, dt, straight ? 86 : 76);
        pr.time = t;
      } else drive(pr, 0, true, dt, 0);
      // bumping
      const dx = pr.x - me.x, dy = pr.y - me.y, d = Math.hypot(dx, dy);
      if (d < 9 && d > 0.01) { const p = (9 - d) / 2; me.x -= dx / d * p; me.y -= dy / d * p; pr.x += dx / d * p; pr.y += dy / d * p; me.v *= 0.9; pr.v *= 0.92; if (Math.random() < 0.2) api.sfx.thud(); }
      for (const c of cars) if (!c.done && laps(c) >= 3) { c.done = t; if (!winner) { winner = c; api.sfx.tune(c === me ? [523, 659, 784, 1047] : [392, 330, 262], 0.12); } }
      if (me.done && !over) { over = true; overT = t; api.done(); }
      api.sfx.engine(me.done ? 0 : me.v / 96);
    },
    draw(scr) {
      if (!bg) paintBg();
      const g = scr.lx; g.drawImage(bg, 0, 0);
      cars.slice().reverse().forEach((c) => drawCar(g, c));
      scr.blit();
      const ctx = scr.ctx;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 40);
      const me = cars[0];
      const l = Math.min(laps(me) + 1, 4);
      scr.text(0, 0, `LAP ${lapShown(l)} OF 3`, 14);
      scr.text(14, 0, `TIME ${me.time.toFixed(1)}`, 15);
      scr.text(27, 0, laps(me) >= laps(cars[1]) && me.total >= cars[1].total ? 'POS 1ST' : 'POS 2ND', 11);
      scr.small(250, 230, 'TURBO TURBO 95', '#ffff55', 30);
      if (count > 0) { const n = Math.ceil(count); scr.small(300, 140, n > 0 ? String(n) : 'GO', '#ffffff', 60); }
      else if (t - 0 < 0.6 + 3.2 && count <= 0 && t < 4) scr.small(290, 140, 'GO!', '#55ff55', 60);
      if (over) {
        scr.fill(5, 6, 30, 8, 1); scr.fill(6, 7, 28, 6, 0);
        if (winner === me) { scr.text(7, 7, 'YOU BEAT THE PRIYA!!!', 14); scr.text(7, 8, '(SHE WILL SAY IT WAS LAG)', 7); }
        else { scr.text(7, 7, 'THE PRIYA WINS.', 12); scr.text(7, 8, 'AGAIN.', 7); }
        scr.text(7, 10, `LAP ${lapShown(laps(me) + 1)} OF 3  ${me.done.toFixed(1)}S`, 15);
        scr.text(7, 11, 'ENTER: RACE AGAIN  ESC: QUIT', 11);
      }
    },
  };
}
