// The castle, built tile by tile. Coordinates are tiles; x grows right, y grows down.
// Entities stand with their feet on y (the top of the floor row).
//
// Tiles
//   #  stone            .  interior (back wall)     ' ' open sky
//   -  plank (one-way)  %  false floor (looks like stone, gives way)
//   :  invisible bridge |  illusory wall (looks like stone until struck)
//   ^  spikes (kill)    v  abyss (kill)              g / G  boss gates

export const W = 362, H = 48;

export const AUTHORS = {
  ilse:  { name: 'Ilse of the Lamp',   rule: 'Always tells the truth.',                        appr: [310, 940] },
  ansel: { name: 'Brother Ansel',      rule: 'Always tells the truth.',                        appr: [120, 420] },
  pell:  { name: 'mumbling_pell',      rule: 'Tells the truth. Nobody ever appraises him.',    appr: [0, 3] },
  guts:  { name: 'xX_GutsNGlory_Xx',   rule: 'Always lies.',                                   appr: [1800, 2600] },
  fop:   { name: 'Gilded Fop',         rule: 'Lies about treasure. Honest about everything else.', appr: [500, 800] },
  lefty: { name: 'Lefty Marrow',       rule: 'Swaps left and right. Honest otherwise.',        appr: [150, 330] },
  appr:  { name: 'SirAppraiser',       rule: 'Always lies, and everyone appraises him.',       appr: [9999, 9999] },
  you:   { name: 'You',                rule: 'Your own hand.',                                 appr: [0, 0] },
};

export function buildLevel() {
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
  const ents = [], msgs = [], ghosts = [];
  const ent = (type, x, y, o = {}) => ents.push({ type, x: x + 0.5, y, ...o });
  const msg = (id, x, y, author, text, truth, note, tag) => msgs.push({ id, x: x + 0.5, y, author, text, truth, note, tag: tag || id });

  // ---------- A. The Gate (outdoors): the tutorial and the first liar
  fill(0, 0, 63, 11, ' ');
  fill(12, 10, 39, 11, '#');
  fill(49, 10, 63, 11, '#');
  fill(40, 12, 48, 13, ' ');
  fill(40, 14, 48, 14, 'v');
  fill(32, 10, 33, 10, '-');
  fill(32, 11, 33, 17, '.');
  fill(32, 16, 63, 17, '.');
  ent('start', 3, 12);
  msg('a', 8, 12, 'ilse', 'Try jumping', true, 'The ledge was there to be jumped.', 'ledge');
  msg('b', 17, 10, 'ansel', 'Hollow ahead', true, 'There was a Hollow.', 'hollow1');
  ent('hollow', 23, 10, { tut: true });
  ent('candle', 27, 10, { name: 'The Gate' });
  msg('c', 31, 10, 'pell', 'Path below', true, 'The planks led down.', 'shaft');
  msg('d', 35, 10, 'ilse', 'Liar ahead', true, 'The next message lied.', 'pit');
  ghosts.push({ x: 37.5, y: 10, script: [[0.42, 'R'], [0.25, 'RJ'], [2.5, 'R']] });
  msg('e', 38, 10, 'guts', 'Try jumping', false, 'Nobody clears that pit.', 'pit');
  ent('hollow', 50, 18);

  // ---------- B. The Ramparts: an invisible bridge and a wall that isn't
  fill(64, 0, 109, 17, ' ');
  fill(81, 18, 89, 21, ' ');
  fill(81, 22, 89, 22, 'v');
  fill(81, 18, 89, 18, ':');
  ent('crow', 73, 13);
  msg('f', 78, 18, 'ilse', 'Hidden path ahead', true, 'The bridge was there, unseen.', 'bridge');
  msg('g', 94, 18, 'ansel', 'Treasure', true, 'A flask, as promised.', 'chest1');
  ent('chest', 96, 18, { give: 'flask', id: 'c1' });
  ent('crow', 101, 12);
  msg('i', 103, 18, 'guts', 'Try jumping', false, 'That wall is far too tall to jump.', 'wall');
  msg('h', 106, 18, 'pell', 'Hidden path ahead', true, 'The wall was only an illusion.', 'wall');
  fill(110, 0, 111, 15, '#');
  fill(110, 16, 111, 17, '|');
  fill(112, 12, 139, 17, '.');
  ent('candle', 116, 18, { name: 'Ramparts' });
  ent('hollow', 127, 18);
  fill(136, 18, 137, 20, '.');

  // ---------- C. The Chapel: a turned coat, a floor that isn't and a hungry chest
  fill(120, 21, 205, 26, '.');
  msg('j', 144, 27, 'lefty', 'Be wary of left', false, 'It came from the right.', 'ambush');
  ent('hollow', 151, 27, { dormant: true, wake: 148 });
  ent('hollow', 132, 27);
  msg('l', 156, 27, 'ansel', 'Be wary of floor', true, 'The floor gave way.', 'false');
  ghosts.push({ x: 157.5, y: 27, script: [[4, 'R']] });
  msg('k', 159, 27, 'fop', 'Treasure', false, 'The treasure was bait over a drop.', 'false');
  fill(161, 27, 170, 27, '%');
  fill(161, 28, 170, 29, 'o'); // hidden: looks like stone until the floor goes
  fill(161, 30, 170, 30, 'v');
  fill(160, 25, 171, 25, '-');
  ent('chest', 166, 27, { give: 'flask', id: 'bait' });
  msg('n', 177, 27, 'ilse', 'Be wary of chest', true, 'The chest had teeth.', 'mimic1');
  msg('m', 180, 27, 'appr', 'Treasure', false, 'Not treasure. Teeth.', 'mimic1');
  ent('mimic', 183, 27);
  ent('chest', 191, 27, { give: 'flask', id: 'c2' });
  ent('candle', 196, 27, { name: 'Chapel' });
  msg('o', 199, 27, 'ilse', 'Try rolling', true, 'Rolling through its swings works.', 'boss1');
  msg('p', 202, 27, 'guts', 'Try blocking', false, 'There is no block.', 'boss1');

  // Bell Warden's arena
  fill(206, 17, 237, 26, '.');
  fill(207, 21, 207, 26, 'g');
  ent('warden', 228, 27, { gate: 'g' });

  // ---------- D. The Cisterns: two forks, four voices
  fill(238, 25, 250, 26, '.');
  fill(238, 25, 238, 26, 'G');
  ent('hollow', 243, 27);
  msg('q', 246, 27, 'lefty', 'Be wary of right', false, 'He meant left.', 'fork1');
  msg('r', 249, 27, 'pell', 'Be wary of left', true, 'The left drop ended in spikes.', 'fork1');
  fill(251, 23, 272, 26, '.');
  fill(255, 27, 256, 33, '.');
  fill(255, 34, 256, 34, '^');
  fill(267, 27, 268, 30, '.');
  fill(258, 31, 287, 34, '.');
  msg('s', 271, 35, 'appr', 'Be wary of left', false, 'The left drop was the way down.', 'fork2');
  msg('t', 275, 35, 'ansel', 'Be wary of right', true, 'The right drop ended in spikes.', 'fork2');
  fill(262, 35, 263, 37, '.');
  fill(284, 35, 285, 36, '.');
  fill(284, 37, 285, 37, '^');

  // ---------- E. The Ossuary
  fill(250, 38, 320, 42, '.');
  fill(292, 34, 320, 37, '.');
  msg('w', 255, 43, 'pell', 'Treasure', true, 'A whetstone. Your blade bites deeper.', 'chest3');
  ent('chest', 252, 43, { give: 'whet', id: 'c3' });
  msg('v', 278, 43, 'guts', 'Treasure', false, 'Another mouth.', 'mimic2');
  ent('mimic', 281, 43);
  msg('u', 293, 43, 'fop', 'Be wary of above', true, 'Something fell from above.', 'crow3');
  ent('crow', 299, 36, { tag: 'crow3' });
  ent('hollow', 304, 43);
  ent('hollow', 311, 43);
  ent('candle', 316, 43, { name: 'Ossuary' });

  // ---------- F. The hand that writes
  fill(321, 30, 358, 42, '.');
  fill(321, 34, 321, 42, 'g');
  ent('hand', 340, 43, { gate: 'g' });
  ent('exit', 355, 43);

  // Places that settle a message's truth when you stand in them (or die in them).
  const zones = [
    { tag: 'ledge', x0: 12, y0: 7, x1: 17, y1: 10.2, ground: true },
    { tag: 'hollow1', x0: 18, y0: 6, x1: 26, y1: 10.2 },
    { tag: 'shaft', x0: 32, y0: 12, x1: 34, y1: 18 },
    { tag: 'pit', x0: 40, y0: 10.5, x1: 49, y1: 15 },
    { tag: 'false', x0: 161, y0: 27.5, x1: 171, y1: 31 },
    { tag: 'fork1', x0: 255, y0: 28, x1: 257, y1: 35 },
    { tag: 'fork1', x0: 267, y0: 28, x1: 269, y1: 31 },
    { tag: 'fork2', x0: 262, y0: 36, x1: 264, y1: 38 },
    { tag: 'fork2', x0: 284, y0: 36, x1: 286, y1: 38 },
  ];
  for (const e of ents) {
    if (e.type === 'mimic') e.tag = e.x < 200 ? 'mimic1' : 'mimic2';
    if (e.type === 'chest' && e.id === 'c1') e.tag = 'chest1';
    if (e.type === 'chest' && e.id === 'c3') e.tag = 'chest3';
    if (e.type === 'hollow' && e.tut) e.tag = 'hollow1';
    if (e.type === 'hollow' && e.dormant) e.tag = 'ambush';
  }
  return { grid: g, ents, msgs, ghosts, zones };
}

// The grammar the player writes with when they fall.
export const TEMPLATES = ['Try ****', '**** ahead', 'Be wary of ****', 'No **** ahead', '****!', 'Why is it always ****?'];
export const WORDS = ['jumping', 'rolling', 'left', 'right', 'above', 'below', 'floor', 'chest', 'Hollow', 'liar', 'treasure', 'hidden path', 'enemy', 'this wall', 'the gap', 'patience', 'finger', 'hole'];
