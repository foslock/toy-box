// 1994: MAZE CRAZE. CGA, four colours: black, cyan, magenta, white.
import { spr } from './screen.js';

const C = { k: '#000000', c: '#55ffff', m: '#ff55ff', w: '#ffffff' };
export const MAZES = [
  [
    '####################',
    '#S.....#...........#',
    '#.####.#.#########.#',
    '#.#....#.#.......#.#',
    '#.#.####.#.#.###.#.#',
    '#.#......#.#...#...#',
    '#.########.#.#.#####',
    '#.#........#.#.....#',
    '#.#.########.#####.#',
    '#...#........#....E#',
    '####################',
  ],
  [
    '####################',
    '#S.#.......#.......#',
    '#..#.#####.#.#####.#',
    '#.##.#...#...#...#.#',
    '#....#.#.#####.#.#.#',
    '####.#.#.......#.#.#',
    '#....#.#########.#.#',
    '#.####.....G.....#.#',
    '#.######.#######.#.#',
    '#........#.......#E#',
    '####################',
  ],
  [
    '####################',
    '#S#.......#.......*#',
    '#.#.#####.#.#####.##',
    '#.#.#...#...#...#..#',
    '#...#.#.#####.#.##.#',
    '###.#.#.......#....#',
    '#...#.#######.######',
    '#.###.#.....#......#',
    '#.#...#.###.######.#',
    '#...#...#.......G..E',
    '####################',
  ],
];
const SMILE = ['..mmmmmm..', '.mmmmmmmm.', 'mmwmmmmwmm', 'mmwmmmmwmm', 'mmmmmmmmmm', 'mwmmmmmmwm', 'mmwwwwwwmm', '.mmmmmmmm.', '..mmmmmm..'];
const GLOOP = ['...wwww...', '..wwwwww..', '.wwkwwkww.', '.wwkwwkww.', 'wwwwwwwwww', 'wwwwwwwwww', 'wcwwcwwcww', 'c.c..c.c.c'];
const PAL = { m: C.m, w: C.w, k: C.k, c: C.c };

export function maze(api) {
  let lv = 0, grid, px, py, sx, sy, ex, ey, gl = null, moves = 0, t = 0, banner = 1.4, secret = false, msg = null, finished = false, rep = 0, bump = 0;
  function load(n) {
    lv = n; grid = MAZES[n].map((r) => r.split(''));
    gl = null;
    grid.forEach((r, y) => r.forEach((ch, x) => {
      if (ch === 'S') { px = sx = x; py = sy = y; }
      if (ch === 'E') { ex = x; ey = y; }
      if (ch === 'G') gl = { x, y, t: 0 };
    }));
    banner = 1.4;
  }
  load(0);
  const open = (x, y) => grid[y] && grid[y][x] && grid[y][x] !== '#';
  function step(dx, dy) {
    if (banner > 0 || finished || msg) return;
    const nx = px + dx, ny = py + dy;
    if (!open(nx, ny)) { if (bump <= 0) api.sfx.beep(110, 0.04); bump = 0.15; return; }
    px = nx; py = ny; moves++; api.sfx.beep(1400, 0.012);
    if (grid[py][px] === '*' && !secret) { secret = true; grid[py][px] = '.'; msg = ['SECRET!!!', '', 'HELLO TO EVERYONE AT', 'COMPUTER CLUB. MR OKAFOR', 'IS THE BEST TEACHER', '(HE MADE ME WRITE THAT)', '(HE DIDNT)']; api.sfx.tune([784, 988, 1175, 1568], 0.08); }
    caught();
    if (px === ex && py === ey) {
      api.sfx.tune([523, 659, 784, 1047], 0.09);
      if (lv < 2) load(lv + 1); else { finished = true; api.done(); }
    }
  }
  function caught() {
    if (gl && gl.x === px && gl.y === py) { api.sfx.tune([300, 200, 120], 0.1); px = sx; py = sy; msg = ['THE GLOOP GOT YOU', '', 'BACK TO THE START!!']; }
  }
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  return {
    pad: 'arrows', swipe: true,
    _bot() {
      if (finished) return 'done';
      if (msg) return 'enter';
      if (banner > 0) return 'wait';
      const goal = !secret && lv === 2 ? (() => { let s; grid.forEach((r, y) => r.forEach((c, x) => { if (c === '*') s = [x, y]; })); return s; })() : [ex, ey];
      const prev = new Map([[px + ',' + py, null]]); const q = [[px, py]];
      while (q.length) { const [x, y] = q.shift(); if (x === goal[0] && y === goal[1]) break;
        for (const [k, [dx, dy]] of Object.entries(DIRS)) { const n = (x + dx) + ',' + (y + dy); if (open(x + dx, y + dy) && !prev.has(n)) { prev.set(n, [x, y, k]); q.push([x + dx, y + dy]); } } }
      let cur = goal.join(','), k = null;
      while (prev.get(cur)) { const [x, y, kk] = prev.get(cur); k = kk; cur = x + ',' + y; }
      return k || 'wait';
    },
    key(k) {
      if (msg) { if (k === 'enter' || k === 'space') msg = null; return; }
      if (finished) { if (k === 'enter' || k === 'space') { finished = false; moves = 0; load(0); } return; }
      if (DIRS[k]) { step(...DIRS[k]); rep = 0.22; }
    },
    tap() { if (msg) msg = null; else if (finished) { finished = false; moves = 0; load(0); } },
    tick(dt) {
      t += dt; bump -= dt;
      if (banner > 0) banner -= dt;
      // held arrows repeat
      const k = ['up', 'down', 'left', 'right'].find((d) => api.held.has(d));
      if (k && !msg) { rep -= dt; if (rep <= 0) { step(...DIRS[k]); rep = 0.12; } }
      if (gl && banner <= 0 && !msg && !finished) {
        gl.t += dt;
        if (gl.t > (lv === 2 ? 0.38 : 0.5)) {
          gl.t = 0;
          const opts = Object.values(DIRS).filter(([dx, dy]) => open(gl.x + dx, gl.y + dy) && grid[gl.y + dy][gl.x + dx] !== 'E' && grid[gl.y + dy][gl.x + dx] !== 'S');
          if (opts.length) {
            let pick;
            if (Math.random() < 0.55) pick = opts.reduce((a, b) => (Math.abs(gl.x + a[0] - px) + Math.abs(gl.y + a[1] - py) <= Math.abs(gl.x + b[0] - px) + Math.abs(gl.y + b[1] - py) ? a : b));
            else pick = opts[Math.floor(Math.random() * opts.length)];
            gl.x += pick[0]; gl.y += pick[1];
          }
          caught();
        }
      }
    },
    draw(scr) {
      const g = scr.lx;
      g.fillStyle = C.k; g.fillRect(0, 0, 320, 200);
      const oy = 22;
      grid.forEach((r, y) => r.forEach((ch, x) => {
        const X = x * 16, Y = oy + y * 16;
        if (ch === '#') {
          g.fillStyle = C.c; g.fillRect(X, Y, 16, 16);
          g.fillStyle = C.k; if ((x + y) % 2 === 0) g.fillRect(X + 3, Y + 3, 10, 10); else { g.fillRect(X + 2, Y + 7, 12, 2); }
        } else if (ch === 'E') {
          g.fillStyle = C.w; g.fillRect(X + 2, Y + 1, 12, 15); g.fillStyle = C.m; g.fillRect(X + 4, Y + 3, 8, 12); g.fillStyle = C.w; g.fillRect(X + 10, Y + 9, 2, 2);
        } else if (ch === '*' && ((t * 3) | 0) % 2) {
          g.fillStyle = C.w; g.fillRect(X + 6, Y + 6, 4, 4);
        }
      }));
      if (gl) spr(g, gl.x * 16 + 3, oy + gl.y * 16 + 4 + (((t * 4) | 0) % 2), GLOOP, PAL);
      spr(g, px * 16 + 3, oy + py * 16 + 3, SMILE, PAL);
      scr.blit();
      scr.text(0, 0, `MAZE CRAZE   LEVEL ${lv + 1}`, 15);
      scr.text(26, 0, `MOVES ${String(moves).padStart(4, '0')}`, 13);
      const box = (lines, hint = 'PRESS ENTER') => {
        const w = Math.max(...lines.map((l) => l.length)) + 4, x0 = (40 - w) >> 1, y0 = 9 - (lines.length >> 1);
        scr.fill(x0, y0 - 1, w, lines.length + 3, 13); scr.fill(x0 + 1, y0 - 1 + 0, w - 2, lines.length + 3, 0);
        scr.fill(x0 + 1, y0, w - 2, lines.length + 1, 0);
        lines.forEach((l, i) => scr.text(x0 + 2, y0 + i, l, i === 0 ? 13 : 15));
        if (hint) scr.text(x0 + 2, y0 + lines.length, hint, 11);
      };
      if (banner > 0) box([`LEVEL ${lv + 1}`, lv === 1 ? 'WATCH OUT FOR THE GLOOP' : lv === 2 ? 'FIND THE SECRET!!' : 'GET TO THE DOOR'], '');
      else if (msg) box(msg);
      else if (finished) box(['YOU WIN!!!', '', `MOVES: ${moves}`, secret ? 'AND YOU FOUND THE SECRET' : 'NOW GO BACK FOR THE SECRET', '', 'ENTER: PLAY AGAIN', 'ESC: QUIT'], '');
    },
  };
}
