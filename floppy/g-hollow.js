// 1998: hollow. Greys. A house that has a bit less in it every day.
import { wrap } from './screen.js';

// four rooms side by side, 160 px each (low-res)
const ROOMS = ['bedroom', 'landing', 'kitchen', 'hall'];
const THINGS = [
  { id: 'bed', x: 40, room: 0, w: 46 },
  { id: 'computer', x: 118, room: 0, w: 26 },
  { id: 'window', x: 216, room: 1, w: 30 },
  { id: 'photo', x: 274, room: 1, w: 18 },
  { id: 'fridge', x: 352, room: 2, w: 24 },
  { id: 'table', x: 420, room: 2, w: 40 },
  { id: 'phone', x: 520, room: 3, w: 16 },
  { id: 'door', x: 600, room: 3, w: 26 },
];
const TEXT = {
  bed: ['you could just lie down.', 'you lie down. it\'s four in the afternoon.', 'someone is knocking downstairs.'],
  computer: ['you could make something. you don\'t.', 'the screen is off. it\'s just your face in it.', 'you leave it.'],
  window: ['it\'s sunny out. that seems like a lot.', 'people walking to school. you shut the curtains.', 'curtains.'],
  photo: ['you and priya at scarborough. 1996. she\'s pulling a face.', 'you turn it round.', ''],
  fridge: ['mum left a plate. the note says "eat something x".', 'another plate. another note.', 'you eat a bit. for the note.'],
  table: ['three chairs pushed in. one pulled out.', 'the chairs.', 'the chairs.'],
  phone: ['priya hasn\'t rung. you haven\'t rung her.', 'it rings. you let it.', 'it doesn\'t ring.'],
  door: ['not today.', 'not today.', null],
};

export function hollow(api) {
  let x = 60, face = 1, day = 0, t = 0, msg = null, msgT = 0, fade = 2.2, card = 'day 1', knock = 0, visitor = 0, done = 0, walkT = 0, ptrDir = 0, sleeping = 0, looks = 0;
  const near = () => THINGS.find((o) => Math.abs(o.x - x) < o.w / 2 + 10 && (day < 2 || o.id !== 'photo'));
  function say(s) { if (!s) return; msg = s; msgT = 0; }
  function look() {
    if (fade > 0.6 || visitor || sleeping) return;
    const o = near(); if (!o) { say(['', 'nothing.', 'nothing.'][Math.min(2, day)] || 'nothing.'); return; }
    looks++;
    if (o.id === 'bed') {
      if (day >= 2) { say(TEXT.bed[2]); return; }
      if (!bedArmed) { say(TEXT.bed[0]); bedArmed = true; return; }
      say(TEXT.bed[1]); sleeping = 0.01; bedArmed = false; return;
    }
    if (o.id === 'door' && day >= 2 && knock) { visitor = 0.01; msg = null; return; }
    say(TEXT[o.id][Math.min(2, day)]);
    api.sfx.soft(day === 0 ? 220 : day === 1 ? 196 : 174, 0.5, 0.03);
  }
  let bedArmed = false;
  const grey = (v) => { const k = Math.round(v); return `rgb(${k},${k},${k + 4})`; };
  return {
    pad: 'walk', _x: () => x,
    key(k) {
      if (done > 2) { if (k === 'enter' || k === 'space') api.exit(); return; }
      if (k === 'enter' || k === 'space' || k === 'up') look();
    },
    pointer(type, px, py) {
      if (done > 2 && type === 'up') { api.exit(); return; }
      if (type === 'down' || type === 'move') {
        const hx = (x - cam()) * 2;
        ptrDir = Math.abs(px - hx) < 36 ? 0 : px < hx ? -1 : 1;
        if (type === 'down') this._down = { px, t };
      }
      if (type === 'up') {
        const d = this._down; ptrDir = 0;
        if (d && t - d.t < 0.3) {
          // a quick tap on something near you looks at it
          const wx = px / 2 + cam(); const o = THINGS.find((q) => Math.abs(q.x - wx) < q.w / 2 + 8);
          if (o && near() === o) look();
        }
        this._down = null;
      }
    },
    tick(dt) {
      t += dt;
      if (fade > 0) fade -= dt;
      if (msg) msgT += dt;
      if (sleeping) {
        sleeping += dt;
        if (sleeping > 2.4) { sleeping = 0; day++; looks = 0; msg = null; card = `day ${day + 1}`; fade = 2.2; x = 60; face = 1; if (day === 2) knock = 0.01; }
        return;
      }
      if (visitor) {
        visitor += dt;
        if (visitor > 9 && !done) { done = 0.01; api.done(); api.sfx.chord([262, 330, 392, 523], 3, 0.03); }
        if (done) done += dt;
        return;
      }
      if (knock) {
        const before = knock; knock += dt;
        if (Math.floor(before / 5) !== Math.floor(knock / 5) || before === 0.01) { api.sfx.thud(); setTimeout(() => api.sfx.thud(), 220); }
      }
      if (fade > 0.8) return;
      const dir = (api.held.has('left') ? -1 : 0) + (api.held.has('right') ? 1 : 0) || ptrDir;
      if (api.demo) return;
      if (dir) { x = Math.max(14, Math.min(626, x + dir * 46 * dt)); face = dir; walkT += dt; if (msg && msgT > 0.8) msg = null; }
    },
    draw(scr) {
      const g = scr.lx, c = cam();
      const dim = [1, 0.85, 0.68][Math.min(2, day)];
      const v = (n) => grey(n * dim);
      g.fillStyle = v(40); g.fillRect(0, 0, 320, 200);
      g.save(); g.translate(-c, 0);
      for (let r = 0; r < 4; r++) {
        const X = r * 160;
        g.fillStyle = v([92, 84, 98, 80][r]); g.fillRect(X, 30, 160, 130);   // wall
        g.fillStyle = v(52); g.fillRect(X, 160, 160, 40);                    // floor
        g.fillStyle = v(38); g.fillRect(X, 158, 160, 3);
        if (r > 0) { g.fillStyle = v(30); g.fillRect(X - 3, 40, 6, 120); }   // doorway posts
      }
      // things
      const T = (id) => THINGS.find((o) => o.id === id);
      let o = T('bed'); g.fillStyle = v(70); g.fillRect(o.x - 24, 138, 48, 20); g.fillStyle = v(120); g.fillRect(o.x - 24, 132, 48, 8); g.fillStyle = v(150); g.fillRect(o.x - 22, 128, 12, 6); g.fillStyle = v(60); g.fillRect(o.x - 26, 118, 4, 40);
      o = T('computer'); g.fillStyle = v(60); g.fillRect(o.x - 16, 126, 32, 4); g.fillRect(o.x - 14, 130, 3, 28); g.fillRect(o.x + 11, 130, 3, 28);
      g.fillStyle = v(130); g.fillRect(o.x - 10, 106, 20, 18); g.fillStyle = day === 0 ? v(70) : v(20); g.fillRect(o.x - 8, 108, 16, 13);
      if (day === 0 && ((t * 2) | 0) % 2) { g.fillStyle = v(150); g.fillRect(o.x - 6, 118, 3, 1); }
      o = T('window'); const curt = day >= 1; g.fillStyle = curt ? v(60) : grey(200 * dim); g.fillRect(o.x - 15, 60, 30, 40); g.fillStyle = v(40); g.fillRect(o.x - 1, 60, 2, 40); g.fillRect(o.x - 15, 79, 30, 2);
      if (curt) { g.fillStyle = v(76); g.fillRect(o.x - 17, 58, 16, 44); g.fillRect(o.x + 1, 58, 16, 44); }
      else { g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(o.x - 15, 100); g.lineTo(o.x + 15, 100); g.lineTo(o.x + 40, 158); g.lineTo(o.x - 4, 158); g.fill(); }
      o = T('photo'); if (day < 2) { g.fillStyle = v(50); g.fillRect(o.x - 8, 74, 16, 13); g.fillStyle = day === 0 ? v(170) : v(70); g.fillRect(o.x - 6, 76, 12, 9); if (day === 0) { g.fillStyle = v(90); g.fillRect(o.x - 4, 79, 3, 6); g.fillRect(o.x + 1, 78, 3, 7); } }
      o = T('fridge'); g.fillStyle = v(150); g.fillRect(o.x - 12, 100, 24, 58); g.fillStyle = v(110); g.fillRect(o.x - 12, 120, 24, 1); g.fillRect(o.x + 7, 106, 2, 10); g.fillStyle = grey(220 * dim); g.fillRect(o.x - 6, 108, 6, 6);
      o = T('table'); g.fillStyle = v(66); g.fillRect(o.x - 20, 132, 40, 4); g.fillRect(o.x - 18, 136, 3, 22); g.fillRect(o.x + 15, 136, 3, 22);
      for (const cx of [-30, 26]) { g.fillRect(o.x + cx, 140, 8, 3); g.fillRect(o.x + cx + (cx < 0 ? 0 : 6), 122, 2, 36); }
      if (day === 0) { g.fillStyle = grey(200 * dim); g.fillRect(o.x - 6, 129, 12, 3); }
      o = T('phone'); g.fillStyle = v(60); g.fillRect(o.x - 8, 124, 16, 34); g.fillStyle = v(30); g.fillRect(o.x - 6, 118, 12, 6);
      o = T('door'); g.fillStyle = v(46); g.fillRect(o.x - 15, 72, 30, 86);
      const open = visitor ? Math.min(1, visitor / 2.5) : 0;
      if (open) {
        const W = 26 * open;
        const lg = g.createLinearGradient(o.x - 13, 0, o.x + 13, 0); lg.addColorStop(0, '#fff4d8'); lg.addColorStop(1, '#ffe0a0');
        g.fillStyle = lg; g.fillRect(o.x - 13, 74, W, 84);
        g.fillStyle = 'rgba(255,230,170,.18)'; g.beginPath(); g.moveTo(o.x - 13, 158); g.lineTo(o.x - 13 + W, 158); g.lineTo(o.x - 60, 200); g.lineTo(o.x - 13 - 90 * open, 200); g.fill();
        if (visitor > 2.5) { // small figure in the light
          g.fillStyle = '#3a2a28'; g.fillRect(o.x - 3, 132, 7, 16); g.fillRect(o.x - 2, 125, 5, 6); g.fillRect(o.x - 3, 148, 3, 10); g.fillRect(o.x + 1, 148, 3, 10);
        }
      } else { g.fillStyle = v(70); g.fillRect(o.x - 13, 74, 26, 84); g.fillStyle = v(110); g.fillRect(o.x + 7, 114, 3, 3); }
      // her: thin, hunched, grey
      const bob = Math.sin(walkT * 8) * (api.held.size || ptrDir ? 1 : 0);
      const lying = sleeping > 0.3;
      if (lying) { g.fillStyle = grey(30); g.fillRect(16, 126, 22, 6); g.fillRect(36, 125, 5, 5); }
      else if (!visitor || visitor < 4) {
        const hx = Math.round(x);
        g.fillStyle = grey(30); g.fillRect(hx - 3, 120 + bob, 7, 22); g.fillRect(hx - 2 + face, 112 + bob, 5, 7);
        g.fillRect(hx - 3, 142, 3, 16); g.fillRect(hx + 1, 142, 3, 16);
      } else {
        const hx = 584; g.fillStyle = grey(30); g.fillRect(hx - 3, 120, 7, 22); g.fillRect(hx - 1, 112, 5, 7); g.fillRect(hx - 3, 142, 3, 16); g.fillRect(hx + 1, 142, 3, 16);
      }
      g.restore();
      if (sleeping > 0.3) { g.fillStyle = `rgba(0,0,0,${Math.min(1, (sleeping - 0.3) / 1.5)})`; g.fillRect(0, 0, 320, 200); }
      if (fade > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, fade / 1.2)})`; g.fillRect(0, 0, 320, 200); }
      if (done) { g.fillStyle = `rgba(255,244,216,${Math.min(1, done / 2)})`; g.fillRect(0, 0, 320, 200); }
      scr.blit();
      const ctx = scr.ctx;
      if (fade > 0.3) scr.small(280, 210, card, '#9a9a9a', 40);
      if (msg && !sleeping) {
        const lines = wrap(msg, 34);
        lines.forEach((l, i) => scr.small(48, 340 + i * 24 - (lines.length - 1) * 12, l, '#d0d0d0', 26));
      }
      if (visitor > 3 && visitor < 9) {
        const say = visitor < 5.5 ? '"mags? are you making a new one?"' : visitor < 7.5 ? '"can i play it?"' : 'ok.';
        scr.small(48, 340, say, visitor < 7.5 ? '#ffe8b0' : '#ffffff', 28);
      }
      if (done > 1.5) { scr.small(270, 190, 'hollow', '#5a5040', 44); scr.small(296, 225, '1998', '#5a5040', 28); }
      if (done > 2.5) scr.small(260, 380, 'press enter', '#8a7a60', 22);
      if (!msg && fade <= 0 && !sleeping && !visitor && day === 0 && t < 12) scr.small(48, 380, 'walk with ← →. look at things with enter.', '#6a6a6a', 22);
      if (knock && !visitor && !sleeping && fade <= 0 && !msg) scr.small(48, 380, 'knock knock.', '#a0a0a0', 24);
      void ctx;
    },
  };
  function cam() { return Math.max(0, Math.min(640 - 320, x - 160)); }
}
