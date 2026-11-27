// 2001: FOR THE SQUIRT. A walk through every game she made, mended, to a train.
import { spr, wrap } from './screen.js';

const P = { o: '#20141a', s: '#f2c49a', h: '#5a3a22', H: '#8a5a32', j: '#3a6ad0', J: '#24448a', r: '#d04a3a', R: '#902a22', w: '#ffffff', k: '#20202a', y: '#f0c040', b: '#c8964a', B: '#8a6030', g: '#5a5a66', G: '#2c2c36', n: '#e8d8b0' };
const KID = ['...oooo...', '..ohhhho..', '..ohsssho.', '..osksks..', '..ossssso.', '...osso...', '..ojjjjo..', '.ojjjjjjo.', '.osjjjjso.', '..ojjjjo..', '..oJJJJo..', '..oJooJo..', '..oJo.oJo.', '..oko.oko.'];
const KID2 = KID.slice(0, 11).concat(['..oJJoJo..', '.oJo..oJo.', '.oko...oko']);
const MAGS = ['...oooooo..', '..oHHHHHHo.', '.oHHsssHHHo', '.oHsksksHHo', '.oHssssssHo', '.oHHsssHHHo', '.oHHrrrHHo.', '.oHrrrrrrHo', '..orrrrrro.', '..osrrrrso.', '..orrrrrro.', '..oRRRRRRo.', '..oRRRRRRo.', '..oJJooJJo.', '..oJJo.oJJo', '..oJJo.oJJo', '..okko.okko'];
const DOG = ['oo..........oo', 'obo........obo', '.obbbbbbbbbbbo', '.obbbbbbbbbbo.', '..oBBo...oBBo.', '..oBo.....oBo.'];
const DOGH = ['.oo..', 'ookbo', 'obbbbo', 'obbbo.', '.oo..'];

const STOPS = [
  { x: 170, say: "I'm thinking of a number between 1 and 100. It's 7. It was always 7 when you played. I rigged it so you'd win." },
  { x: 420, say: "Biscuit's coming too. He's slower now, and grey round the nose. Still the best dog." },
  { x: 670, say: "I went back to see Mr Okafor before he retired. Told him I'm doing Computer Science. He shook my hand for about a minute." },
  { x: 920, say: 'I fixed the lap counter. It was one line. It took me six years.' },
  { x: 1170, say: "Priya emailed me the King's speech. It's on this disk. We're going to finish it. Properly, this time." },
  { x: 1420, say: "You knocked. You were ten. You probably don't remember. I let you in because it was you, and that was the day it started getting better." },
  { x: 1670, say: 'Thank you for playing everything I ever made. Even the bad ones. Especially the bad ones.' },
  { x: 1930, say: 'I go to Glasgow on Saturday. You can have the computer. Make something. Make it bad. The bad ones are the best ones.' },
];
const END_X = 1960, WORLD = 2140;

export function foryou(api) {
  let x = 40, t = 0, walkT = 0, face = 1, stop = -1, typed = 0, dog = null, ptrDir = 0, end = 0, finaleCalled = false;
  const sky = (p) => {
    const stops = [[0, [150, 200, 240]], [0.55, [240, 180, 140]], [0.8, [220, 120, 110]], [1, [70, 60, 110]]];
    for (let i = 1; i < stops.length; i++) if (p <= stops[i][0]) { const [a, A] = stops[i - 1], [b, B] = stops[i]; const k = (p - a) / (b - a); return A.map((v, j) => Math.round(v + (B[j] - v) * k)); }
    return stops[3][1];
  };
  const cam = () => Math.max(0, Math.min(WORLD - 320, x - 120));
  return {
    pad: 'lr', _end: () => end,
    key(k) { if (end > 4 && (k === 'enter' || k === 'space')) finish(); },
    pointer(type, px) {
      if (type === 'up') { ptrDir = 0; if (end > 4) finish(); return; }
      ptrDir = px < 200 ? -1 : 1;
    },
    tick(dt) {
      t += dt;
      if (end) { end += dt; return; }
      let dir = (api.held.has('left') ? -1 : 0) + (api.held.has('right') ? 1 : 0) || ptrDir;
      if (api.demo) dir = 1;
      const reading = stop >= 0 && typed < STOPS[stop].say.length + 25;
      if (dir) { x = Math.max(20, Math.min(END_X, x + dir * (reading ? 20 : 46) * dt)); face = dir; walkT += dt; }
      const s = STOPS.findIndex((q) => Math.abs(q.x - x) < 70);
      if (s !== stop && s >= 0) { stop = s; typed = 0; api.sfx.soft(392 + s * 40, 0.3, 0.035); }
      if (stop >= 0) typed += dt * 34;
      if (x > 380 && !dog) dog = { x: x - 40 };
      if (dog) dog.x += (x - 26 * face - dog.x) * Math.min(1, dt * 2.2);
      if (x >= END_X - 2 && typed > STOPS[7].say.length + 20) { end = 0.01; api.sfx.chord([262, 330, 392, 523, 659], 4, 0.03); api.done(); }
    },
    draw(scr) {
      const g = scr.lx, c = cam(), p = x / END_X;
      const [r, gg, b] = sky(p);
      const sg = g.createLinearGradient(0, 0, 0, 160); sg.addColorStop(0, `rgb(${r * 0.7 | 0},${gg * 0.7 | 0},${b * 0.85 | 0})`); sg.addColorStop(1, `rgb(${r},${gg},${b})`);
      g.fillStyle = sg; g.fillRect(0, 0, 320, 200);
      if (p > 0.82) { g.fillStyle = `rgba(255,255,240,${(p - 0.82) * 4})`; for (let i = 0; i < 30; i++) g.fillRect((i * 83) % 320, (i * 37) % 90, 1, 1); }
      // far hills
      g.fillStyle = `rgba(60,80,90,.45)`; g.beginPath(); g.moveTo(0, 160);
      for (let X = 0; X <= 320; X += 8) g.lineTo(X, 122 + Math.sin((X + c * 0.3) * 0.02) * 10 + Math.sin((X + c * 0.3) * 0.053) * 6);
      g.lineTo(320, 160); g.fill();
      g.save(); g.translate(-c, 0);
      // ground
      g.fillStyle = '#4c8a3c'; g.fillRect(c, 160, 320, 40); g.fillStyle = '#c8a46a'; g.fillRect(c, 166, 320, 10);
      for (let X = Math.floor(c / 12) * 12; X < c + 330; X += 12) { g.fillStyle = '#3a7030'; g.fillRect(X + ((X * 7) % 5), 182 + ((X * 3) % 9), 2, 2); }
      props(g);
      // dog and kid and Mags
      if (dog) spr(g, Math.round(dog.x) - 7, 160 - 6, DOG, P, face < 0), spr(g, Math.round(dog.x) + (face < 0 ? -9 : 5), 160 - 9, DOGH, P, face < 0);
      const moving = (api.held.has('left') || api.held.has('right') || ptrDir || api.demo) && !end;
      spr(g, Math.round(x) - 5, 160 - 16, moving && ((walkT * 8) | 0) % 2 ? KID2 : KID, P, face < 0);
      spr(g, 2010, 160 - 17 - (end > 2 && ((t * 3) | 0) % 2 ? 2 : 0), MAGS, P, true);
      g.restore();
      if (end) { g.fillStyle = `rgba(255,250,235,${Math.min(1, Math.max(0, end - 2) / 2)})`; g.fillRect(0, 0, 320, 200); }
      scr.blit();
      // words
      if (stop >= 0 && !(end > 2.5)) {
        const s = STOPS[stop].say.slice(0, Math.floor(typed));
        const lines = wrap(s, 36);
        const ctx = scr.ctx;
        ctx.fillStyle = 'rgba(255,250,235,.92)'; ctx.fillRect(24, 18, 592, 28 + lines.length * 22);
        ctx.fillStyle = '#20141a'; ctx.fillRect(24, 18, 592, 2);
        lines.forEach((l, i) => scr.small(40, 46 + i * 22, l, '#2a2030', 24));
      }
      if (end > 3) { scr.small(250, 180, 'Love, Mags', '#2a2030', 44); }
      if (end > 4) { scr.small(270, 222, 'P.S. phone me', '#5a4a50', 28); scr.small(268, 370, 'press enter', '#9a8a80', 22); }
      if (t < 5 && x < 80) scr.small(40, 380, 'walk with → (or hold the screen)', '#ffffff', 22);
    },
  };
  function finish() { if (finaleCalled) return; finaleCalled = true; api.exit(); api.finale(); }
  function props(g) {
    // 1: a big beige monitor saying 7
    g.fillStyle = '#d8cfb8'; g.fillRect(140, 104, 64, 52); g.fillStyle = '#111'; g.fillRect(146, 110, 52, 38);
    g.fillStyle = '#aaa'; g.font = '30px VT323'; g.fillText('7', 164, 140); g.fillStyle = '#bfb497'; g.fillRect(160, 156, 24, 4);
    // 2: kennel
    g.fillStyle = '#8a3a2a'; g.beginPath(); g.moveTo(380, 130); g.lineTo(404, 112); g.lineTo(428, 130); g.fill(); g.fillStyle = '#b8643a'; g.fillRect(384, 130, 40, 30); g.fillStyle = '#2a1a10'; g.fillRect(398, 140, 12, 20);
    g.fillStyle = '#fff'; g.font = '10px VT323'; g.fillText('BISCUIT', 389, 128 + 9);
    // 3: CGA maze gate, opening
    const open = Math.min(1, Math.max(0, (x - 590) / 60));
    g.fillStyle = '#55ffff'; g.fillRect(640, 100, 12, 60); g.fillRect(700, 100, 12, 60); g.fillRect(640, 94, 72, 8);
    g.fillStyle = '#ff55ff'; g.fillRect(652, 102 + open * 50, 48, 58 - open * 50);
    // 4: the race: a car loops past, LAP 3 OF 3
    const cx = 830 + ((t * 120) % 220);
    g.fillStyle = '#555'; g.fillRect(820, 150, 240, 10);
    g.fillStyle = '#ff5555'; g.fillRect(cx, 146, 16, 7); g.fillStyle = '#ffff55'; g.fillRect(cx, 149, 16, 1); g.fillStyle = '#000'; g.fillRect(cx + 2, 152, 3, 3); g.fillRect(cx + 11, 152, 3, 3);
    g.fillStyle = '#000'; g.fillRect(890, 96, 60, 18); g.fillStyle = '#ffff55'; g.font = '14px VT323'; g.fillText('LAP 3 OF 3', 893, 109);
    g.fillStyle = '#333'; g.fillRect(918, 114, 3, 32);
    // 5: the castle, finished, with the bell
    g.fillStyle = '#8a8aa0'; g.fillRect(1120, 90, 100, 70); g.fillRect(1110, 70, 24, 90); g.fillRect(1206, 70, 24, 90);
    for (let i = 0; i < 5; i++) { g.fillRect(1120 + i * 22, 84, 12, 8); }
    g.fillStyle = '#5a5a70'; g.fillRect(1158, 126, 24, 34); g.fillStyle = '#6a4ab0'; g.fillRect(1116, 58, 12, 12); g.fillRect(1212, 58, 12, 12);
    const sw = Math.sin(t * 4) * 0.4; g.save(); g.translate(1170, 70); g.rotate(sw); g.fillStyle = '#e0b030'; g.beginPath(); g.moveTo(-8, 14); g.lineTo(-5, 0); g.lineTo(5, 0); g.lineTo(8, 14); g.fill(); g.restore();
    g.fillStyle = '#5a5a70'; g.fillRect(1168, 62, 4, 10);
    // 6: the hollow house, lit up, door open
    g.fillStyle = '#7a6a5a'; g.fillRect(1380, 96, 90, 64); g.fillStyle = '#5a3a2a'; g.beginPath(); g.moveTo(1372, 98); g.lineTo(1425, 66); g.lineTo(1478, 98); g.fill();
    g.fillStyle = '#ffe08a'; g.fillRect(1392, 108, 18, 14); g.fillRect(1440, 108, 18, 14); g.fillRect(1418, 128, 14, 32);
    g.fillStyle = 'rgba(255,224,138,.25)'; g.beginPath(); g.moveTo(1418, 160); g.lineTo(1432, 160); g.lineTo(1450, 176); g.lineTo(1400, 176); g.fill();
    // 7: lighthouse at dusk
    g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(1690, 160); g.lineTo(1696, 80); g.lineTo(1712, 80); g.lineTo(1718, 160); g.fill();
    g.fillStyle = '#c03030'; g.fillRect(1693, 120, 22, 8); g.fillRect(1695, 96, 18, 7);
    g.fillStyle = '#ffe9a0'; g.fillRect(1697, 70, 14, 10); g.fillStyle = '#222'; g.fillRect(1695, 68, 18, 2);
    const bt = t * 1.3; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,236,170,.22)'; g.beginPath(); g.moveTo(1704, 75); g.lineTo(1704 + Math.cos(bt) * 160, 75 + Math.sin(bt) * 22 - 12); g.lineTo(1704 + Math.cos(bt) * 160, 75 + Math.sin(bt) * 22 + 12); g.fill(); g.restore();
    // 8: the station
    g.fillStyle = '#6a6a72'; g.fillRect(1880, 150, 260, 10);
    g.fillStyle = '#2a4a8a'; g.fillRect(2030, 104, 110, 46); g.fillStyle = '#ffe9a0'; for (let i = 0; i < 4; i++) g.fillRect(2040 + i * 24, 114, 14, 12);
    g.fillStyle = '#1a2a50'; g.fillRect(2030, 142, 110, 4);
    g.fillStyle = '#1a3a6a'; g.fillRect(1950, 92, 52, 16); g.fillStyle = '#fff'; g.font = '13px VT323'; g.fillText('GLASGOW', 1955, 104); g.fillStyle = '#333'; g.fillRect(1974, 108, 3, 42);
    g.fillStyle = '#8a5a2a'; g.fillRect(2000, 146, 10, 8);  // her bag
  }
}
