// Nine holes through one sleeping house. World units are roughly centimetres;
// the ball is 10 across. Rooms are drawn top-down with the tee near the bottom.
//
// room      outline polygon (walls run along every edge)
// floor     base floor material; zones paint other materials on top (last wins)
// blocks    solid furniture rects [x, y, w, h]
// rounds    solid round things
// segs      thin interior walls / rails: { a, b, t (thickness), mat }
// sleepers  people (and a dog) with a wake meter; `sens` scales what they hear
// windows   moonlight: a gap in a wall that throws a shaft of light in `dir`
// lamps     night-lights: warm pools of light
// funnels   floors that slope toward a point (the shower tray)
// slopes    floors that lean one way (a sagging landing)
// creaks    floorboards that creak when the ball rolls onto them
// lego      bricks: silent to look at, loud to roll over
// stairs    fall in and everyone hears it
// flap      the cat flap: clacks when the ball goes through
// movers    cats and toy trains that follow a looping path

export const HOLES = [
  {
    name: 'The Hall Runner', par: 2, w: 200, h: 520,
    room: [[0, 0], [200, 0], [200, 520], [0, 520]],
    floor: 'wood',
    zones: [{ r: [40, 36, 120, 448], m: 'carpet', look: 'runner' }],
    blocks: [{ r: [166, 180, 34, 96], kind: 'console', mat: 'hard' }],
    rounds: [{ x: 176, y: 470, r: 14, kind: 'plant', mat: 'hard' }],
    sleepers: [{ name: 'Mum', kind: 'door', x: 0, y: 250, side: 'left', sens: 1 }],
    doors: [{ x: 200, y: 400, side: 'right' }, { x: 100, y: 520, side: 'bottom' }],
    cup: { x: 100, y: 74, kind: 'mug' },
    tee: { x: 100, y: 462 },
    windows: [{ a: [64, 0], b: [136, 0], dir: [0.22, 1], len: 330 }],
    lamps: [{ x: 8, y: 430, r: 110, c: 'warm' }],
  },
  {
    name: 'Kitchen Tiles', par: 3, w: 320, h: 520,
    room: [[0, 0], [320, 0], [320, 520], [0, 520]],
    floor: 'tile',
    zones: [{ r: [120, 36, 84, 40], m: 'rug', look: 'mat' }],
    blocks: [
      { r: [0, 150, 48, 220], kind: 'counter', mat: 'hard' },
      { r: [70, 0, 170, 34], kind: 'counter', mat: 'hard', sink: true },
      { r: [256, 0, 64, 74], kind: 'fridge', mat: 'metal' },
      { r: [104, 214, 112, 104], kind: 'island', mat: 'hard' },
    ],
    rounds: [{ x: 296, y: 300, r: 14, kind: 'bin', mat: 'metal' }],
    sleepers: [{ name: 'Biscuit', kind: 'dog', x: 40, y: 72, sens: 1.2, solid: 28 }],
    doors: [{ x: 160, y: 520, side: 'bottom' }],
    cup: { x: 206, y: 96, kind: 'mug' },
    tee: { x: 160, y: 470 },
    windows: [{ a: [124, 0], b: [196, 0], dir: [-0.2, 1], len: 300 }],
    lamps: [{ x: 230, y: 30, r: 44, c: 'green' }],
  },
  {
    name: "Grandpa's Sofa", par: 3, w: 340, h: 480,
    room: [[0, 0], [340, 0], [340, 480], [0, 480]],
    floor: 'wood',
    zones: [{ r: [84, 130, 196, 236], m: 'rug', look: 'rug' }],
    blocks: [
      { r: [0, 124, 62, 214], kind: 'sofa', mat: 'soft' },
      { r: [148, 214, 68, 66], kind: 'table', mat: 'hard' },
      { r: [262, 18, 66, 66], kind: 'armchair', mat: 'soft' },
      { r: [122, 444, 140, 36], kind: 'tvunit', mat: 'hard' },
      { r: [134, 0, 86, 24], kind: 'fireplace', mat: 'hard' },
      { r: [304, 176, 36, 140], kind: 'bookcase', mat: 'hard' },
    ],
    rounds: [],
    sleepers: [{ name: 'Grandpa', kind: 'sofa', x: 30, y: 232, sens: 0.6 }],
    doors: [{ x: 340, y: 420, side: 'right' }],
    cup: { x: 96, y: 96, kind: 'slipper' },
    tee: { x: 290, y: 410 },
    windows: [{ a: [24, 0], b: [104, 0], dir: [0.35, 1], len: 330 }],
    lamps: [{ x: 177, y: 18, r: 110, c: 'ember' }],
    movers: [{ kind: 'cat', r: 11, speed: 22, path: [[112, 186], [250, 186], [250, 312], [112, 312]] }],
  },
  {
    name: 'The Cat Flap', par: 3, w: 300, h: 520,
    room: [[0, 0], [300, 0], [300, 520], [0, 520]],
    floor: 'lino',
    zones: [
      { r: [0, 0, 300, 250], m: 'stone', look: 'flags' },
      { r: [104, 186, 92, 58], m: 'coir', look: 'doormat' },
    ],
    segs: [
      { a: [0, 250], b: [135, 250], t: 14, mat: 'hard' },
      { a: [165, 250], b: [300, 250], t: 14, mat: 'hard' },
    ],
    flap: { x: 150, y: 250, w: 16 },
    blocks: [
      { r: [238, 264, 62, 62], kind: 'washer', mat: 'metal' },
      { r: [0, 50, 38, 140], kind: 'shoerack', mat: 'hard' },
      { r: [206, 410, 94, 110], kind: 'campbed', mat: 'soft' },
    ],
    rounds: [{ x: 272, y: 206, r: 15, kind: 'plant', mat: 'hard' }, { x: 64, y: 26, r: 13, kind: 'plant', mat: 'hard' }],
    sleepers: [{ name: 'Uncle Ray', kind: 'bed', x: 253, y: 436, sens: 1.1 }],
    doors: [{ x: 160, y: 0, side: 'top', front: true }],
    cup: { x: 236, y: 74, kind: 'welly' },
    tee: { x: 60, y: 468 },
    windows: [{ a: [140, 0], b: [180, 0], dir: [-0.1, 1], len: 200 }, { a: [300, 360], b: [300, 400], dir: [-1, -0.15], len: 220 }],
    lamps: [{ x: 266, y: 290, r: 50, c: 'green' }],
  },
  {
    name: 'The Landing', par: 3, w: 240, h: 560,
    room: [[0, 0], [240, 0], [240, 560], [0, 560]],
    floor: 'carpet',
    zones: [{ r: [0, 300, 112, 24], m: 'carpet', look: 'creak' }],
    stairs: { r: [172, 184, 68, 210] },
    segs: [
      { a: [168, 232], b: [168, 394], t: 6, mat: 'hard', kind: 'rail' },
      { a: [168, 394], b: [240, 394], t: 6, mat: 'hard', kind: 'rail' },
      { a: [200, 184], b: [240, 184], t: 6, mat: 'hard', kind: 'rail' },
    ],
    creaks: [{ r: [0, 300, 112, 24] }],
    slopes: [{ r: [96, 176, 72, 76], fx: 70, fy: 0 }],
    blocks: [{ r: [0, 0, 40, 40], kind: 'laundry', mat: 'soft' }],
    rounds: [],
    sleepers: [
      { name: 'Tom', kind: 'door', x: 0, y: 432, side: 'left', sens: 1.2 },
      { name: 'Auntie Bev', kind: 'door', x: 0, y: 170, side: 'left', sens: 1 },
    ],
    doors: [{ x: 240, y: 90, side: 'right' }],
    cup: { x: 74, y: 76, kind: 'trainer' },
    tee: { x: 84, y: 516 },
    windows: [{ a: [70, 0], b: [170, 0], dir: [0.1, 1], len: 380 }],
    lamps: [{ x: 234, y: 520, r: 90, c: 'warm' }],
  },
  {
    name: 'Bath Time', par: 2, w: 300, h: 420,
    room: [[0, 0], [300, 0], [300, 420], [0, 420]],
    floor: 'tile',
    zones: [
      { r: [36, 88, 124, 48], m: 'rug', look: 'bathmat' },
      { r: [176, 286, 124, 134], m: 'tile', look: 'tray' },
    ],
    funnels: [{ r: [176, 286, 124, 134], x: 238, y: 353, k: 2.4 }],
    segs: [{ a: [176, 290], b: [176, 420], t: 5, mat: 'metal', kind: 'glass' }],
    blocks: [{ r: [0, 0, 222, 78], kind: 'bath', mat: 'metal' }],
    rounds: [
      { x: 268, y: 40, r: 22, kind: 'toilet', mat: 'metal' },
      { x: 276, y: 168, r: 17, kind: 'basin', mat: 'metal' },
      { x: 150, y: 240, r: 9, kind: 'duck', mat: 'squeak' },
    ],
    sleepers: [{ name: 'Baby Rosie', kind: 'door', x: 0, y: 300, side: 'left', sens: 1.6 }],
    doors: [],
    cup: { x: 238, y: 353, kind: 'plughole' },
    tee: { x: 112, y: 388 },
    windows: [{ a: [60, 0], b: [150, 0], dir: [0.15, 1], len: 360 }],
    lamps: [],
  },
  {
    name: "Rosie's Nursery", par: 3, w: 320, h: 480,
    room: [[0, 0], [320, 0], [320, 480], [0, 480]],
    floor: 'carpet',
    zones: [{ r: [58, 176, 204, 142], m: 'rug', look: 'playmat' }],
    blocks: [
      { r: [112, 16, 100, 72], kind: 'cot', mat: 'hard' },
      { r: [0, 384, 62, 96], kind: 'toybox', mat: 'hard' },
      { r: [66, 340, 18, 18], kind: 'block', mat: 'hard', hue: 0 },
      { r: [92, 352, 18, 18], kind: 'block', mat: 'hard', hue: 1 },
      { r: [180, 120, 18, 18], kind: 'block', mat: 'hard', hue: 2 },
      { r: [290, 120, 30, 160], kind: 'bookcase', mat: 'hard' },
    ],
    rounds: [
      { x: 246, y: 214, r: 16, kind: 'teddy', mat: 'soft' },
      { x: 136, y: 268, r: 30, kind: 'tent', mat: 'soft' },
      { x: 264, y: 404, r: 22, kind: 'rocker', mat: 'hard' },
    ],
    sleepers: [{ name: 'Rosie', kind: 'cot', x: 162, y: 50, sens: 2 }],
    doors: [{ x: 0, y: 200, side: 'left' }],
    cup: { x: 54, y: 118, kind: 'bootee' },
    tee: { x: 216, y: 440 },
    windows: [{ a: [240, 0], b: [300, 0], dir: [-0.3, 1], len: 300 }],
    lamps: [{ x: 300, y: 26, r: 130, c: 'star' }],
  },
  {
    name: 'Lego Minefield', par: 3, w: 320, h: 520,
    room: [[0, 0], [320, 0], [320, 520], [0, 520]],
    floor: 'carpet',
    zones: [{ r: [80, 250, 160, 100], m: 'rug', look: 'roadmat' }],
    blocks: [
      { r: [252, 0, 68, 150], kind: 'bed', mat: 'soft', hue: 0 },
      { r: [0, 0, 68, 150], kind: 'bed', mat: 'soft', hue: 1 },
      { r: [0, 330, 46, 120], kind: 'desk', mat: 'hard' },
    ],
    rounds: [{ x: 160, y: 176, r: 24, kind: 'beanbag', mat: 'soft' }],
    sleepers: [
      { name: 'Ellie', kind: 'bed', x: 286, y: 26, sens: 1.2 },
      { name: 'Max', kind: 'bed', x: 34, y: 26, sens: 1.2 },
    ],
    lego: [[120, 120], [204, 110], [96, 210], [226, 218], [150, 232], [70, 290], [258, 300], [118, 380], [196, 392], [160, 430], [250, 450], [64, 470], [276, 380], [176, 92]],
    track: { x: 160, y: 300, rx: 112, ry: 74 },
    doors: [{ x: 320, y: 470, side: 'right' }],
    cup: { x: 160, y: 66, kind: 'bucket' },
    tee: { x: 160, y: 480 },
    windows: [{ a: [320, 200], b: [320, 270], dir: [-1, 0.2], len: 260 }],
    lamps: [{ x: 26, y: 346, r: 110, c: 'lava' }],
    movers: [{ kind: 'train', r: 9, speed: 46, oval: true, cars: 3 }],
  },
  {
    name: 'The Big Bed', par: 3, w: 360, h: 520,
    room: [[0, 0], [360, 0], [360, 520], [0, 520]],
    floor: 'carpet',
    zones: [{ r: [70, 236, 220, 70], m: 'rug', look: 'runner2' }],
    blocks: [
      { r: [92, 0, 176, 214], kind: 'bigbed', mat: 'soft' },
      { r: [42, 0, 46, 44], kind: 'bedside', mat: 'hard' },
      { r: [272, 0, 46, 44], kind: 'bedside', mat: 'hard' },
      { r: [0, 300, 50, 160], kind: 'wardrobe', mat: 'hard' },
      { r: [306, 340, 54, 110], kind: 'dresser', mat: 'hard' },
    ],
    rounds: [{ x: 290, y: 394, r: 12, kind: 'stool', mat: 'hard' }, { x: 262, y: 250, r: 19, kind: 'basket', mat: 'soft' }],
    sleepers: [
      { name: 'Mum', kind: 'bigbed', x: 140, y: 40, sens: 1 },
      { name: 'Dad', kind: 'bigbed', x: 220, y: 40, sens: 0.85 },
    ],
    doors: [{ x: 180, y: 520, side: 'bottom' }],
    cup: { x: 314, y: 128, kind: 'slipper' },
    tee: { x: 180, y: 478 },
    windows: [{ a: [360, 170], b: [360, 290], dir: [-1, 0.1], len: 330 }],
    lamps: [{ x: 295, y: 22, r: 36, c: 'green' }],
    movers: [{ kind: 'cat', r: 11, speed: 30, path: [[40, 310], [250, 310]] }],
  },
];

// How each floor treats a rolling ball. a: constant drag, b: drag per unit of
// speed, roll: noise per unit of speed per second, name for the hover tip.
export const FLOORS = {
  carpet: { a: 62, b: 0.9, roll: 0 },
  rug: { a: 90, b: 1.25, roll: 0 },
  coir: { a: 260, b: 3, roll: 0 },
  wood: { a: 30, b: 0.5, roll: 0.028 },
  lino: { a: 28, b: 0.48, roll: 0.025 },
  tile: { a: 20, b: 0.42, roll: 0.07 },
  stone: { a: 26, b: 0.5, roll: 0.055 },
};

// Noise per unit of speed into the wall.
export const WALLS = { soft: 0.006, hard: 0.1, metal: 0.2, squeak: 0.06 };
