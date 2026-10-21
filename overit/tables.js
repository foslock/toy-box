// The tower, bottom to top. Each table has one nasty trick.
import { W, arc } from './engine.js';

export const TABLES = [
  {
    name: 'LAUNCH PAD', trick: 'A WARM-UP. AIM FOR THE GATE.',
    theme: 'space',
    build(t) {
      t.frame();
      t.gate.x = 180; t.gate.w = 46;
      t.bumper(112, 210, 20);
      t.bumper(248, 210, 20);
      t.post(180, 300, 6);
      // lane guides into the gate
      t.wall([[120, 60], [150, 24]]);
      t.wall([[240, 60], [210, 24]]);
    },
  },
  {
    name: 'DEEP SEA', trick: 'THE KELP SLOWS EVERYTHING DOWN.',
    theme: 'sea',
    build(t) {
      t.frame();
      t.gate.x = 122; t.gate.w = 38;
      t.zone({ x: 0, y: 70, w: W, h: 92, drag: 2.4, kind: 'kelp' });
      const j1 = t.bumper(250, 200, 17, 600, { kind: 'bumper', jelly: true });
      j1.move = time => [250 + Math.sin(time * 0.8) * 20, 210 + Math.sin(time * 1.3) * 26];
      const j2 = t.bumper(110, 270, 17, 600, { jelly: true });
      j2.move = time => [110 + Math.sin(time * 0.9 + 2) * 18, 280 + Math.sin(time * 1.1 + 1) * 24];
      t.post(220, 330, 6);
    },
  },
  {
    name: "DEAD MAN'S GULCH", trick: 'THE GATE WILL NOT HOLD STILL.',
    theme: 'west',
    build(t) {
      t.frame();
      t.gate.x = 180; t.gate.w = 36; t.gate.amp = 92; t.gate.period = 4.2;
      t.bumper(120, 190, 18);
      t.bumper(240, 190, 18);
      t.post(180, 250, 6);
      t.post(70, 300, 6);
      t.post(290, 300, 6);
    },
  },
  {
    name: 'ROBOT WORKS', trick: 'THE WHOLE TABLE ROCKS.',
    theme: 'robot',
    build(t) {
      t.frame();
      t.gate.x = 180; t.gate.w = 34;
      t.tiltAmp = 0.34; t.tiltRate = 0.85;
      t.bumper(124, 180, 18);
      t.bumper(236, 180, 18);
      t.post(80, 290, 7); t.post(280, 290, 7); t.post(180, 250, 7);
      t.wall([[130, 60], [158, 26]]);
      t.wall([[230, 60], [202, 26]]);
    },
  },
  {
    name: 'BIG TOP', trick: 'THE CLOWNS THROW YOU BACK DOWN.',
    theme: 'circus',
    build(t) {
      t.frame();
      t.gate.x = 180; t.gate.w = 36;
      t.bumper(132, 150, 16, 820);
      t.bumper(228, 150, 16, 820);
      t.bumper(180, 210, 16, 820);
      t.bumper(80, 290, 15, 640);
      t.bumper(280, 290, 15, 640);
      t.post(180, 360, 6);
    },
  },
  {
    name: 'HAUNTED HOUSE', trick: 'THE GHOST GUARDS THE DOOR.',
    theme: 'haunted',
    build(t) {
      t.frame();
      t.gate.x = 180; t.gate.w = 44;
      const g = t.post(180, 64, 15, { kind: 'ghost', e: 0.7 });
      g.move = time => [180 + Math.sin(time * 1.2) * 96, 64 + Math.sin(time * 3.2) * 8];
      t.bumper(116, 240, 19);
      t.bumper(244, 240, 19);
      t.bumper(180, 300, 19);
      t.wall([[30, 150], [60, 110]]);
      t.wall([[330, 150], [300, 110]]);
    },
  },
  {
    name: 'LOST TEMPLE', trick: 'ONE NARROW STAIR TO THE TOP.',
    theme: 'temple',
    build(t) {
      t.frame({ cornerL: 0 });
      // the gate sits at the top of a narrow lane up the left wall
      t.top.x0 = 0;
      t.gate.x = 20; t.gate.w = 36;
      t.wall([[40, 0], [40, 210], [62, 250]], { kind: 'stone' });
      t.bumper(180, 120, 19);
      t.bumper(268, 150, 19);
      t.bumper(206, 220, 19);
      t.post(120, 300, 6);
    },
  },
  {
    name: 'ICE PALACE', trick: 'SMALL FLIPPERS. SLIPPERY WALLS.',
    theme: 'ice',
    build(t) {
      t.wallE = 0.78;
      t.frame({ flipperLen: 54 });
      t.gate.x = 180; t.gate.w = 34;
      t.bumper(110, 160, 16, 700);
      t.bumper(250, 160, 16, 700);
      t.bumper(180, 220, 16, 700);
      t.post(60, 280, 6, { e: 0.8 }); t.post(300, 280, 6, { e: 0.8 });
    },
  },
  {
    name: 'VOLCANO', trick: 'KNOCK DOWN THE ROCKS TO OPEN THE GATE.',
    theme: 'volcano',
    build(t) {
      t.frame();
      t.gate.x = 236; t.gate.w = 36; t.gate.closed = true;
      t.target(28, 196, 10, 30);
      t.target(28, 236, 10, 30);
      t.target(28, 276, 10, 30);
      t.target(322, 196, 10, 30);
      t.target(322, 236, 10, 30);
      t.target(322, 276, 10, 30);
      t.bumper(150, 150, 18);
      t.bumper(220, 200, 18);
      t.post(180, 320, 6);
    },
  },
  {
    name: 'THE STORM', trick: 'WIND. A RUNNING GATE. LIGHTNING SLAMS IT SHUT.',
    theme: 'storm',
    build(t) {
      t.frame();
      t.gate.x = 180; t.gate.w = 30; t.gate.amp = 100; t.gate.shut = [2.6, 1.3]; t.gate.period = 3.2;
      t.gustEvery = 4; t.nextGust = 2.5; t.gustForce = 1150;
      t.bumper(104, 128, 16, 760);
      t.bumper(180, 106, 16, 760);
      t.bumper(256, 128, 16, 760);
      t.bumper(142, 250, 17);
      t.bumper(218, 250, 17);
    },
  },
];

export const ARRIVE = { x: 22, y: 430, vx: 0, vy: 0 };
