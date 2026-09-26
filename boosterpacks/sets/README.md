# Card sets

Every card in Booster Packs belongs to a set. **Around the House** (`house/`) is the first. The game reads everything
about a set from its folder: the cards, their prices and text, the categories they belong to, the art behind each item,
the 3D models, and the pack wrapper. To add a set, make a new folder here and register it.

```
sets/
├── index.js            the list of sets, in the order players see them
├── house/
│   ├── set.js          the set: its cards, prices, categories, wrappers
│   ├── rooms.js        its categories ("rooms"): colours, icons, painted backgrounds
│   └── models/*.js     one 3D model per card, split into files however you like
└── yourset/ …
```

## 1. Write `yourset/set.js`

```js
import { TYPES } from './types.js';

const LIST = [
  // [id, name, type, rarity, price in dollars, [move, power, move text], flavor text, size line]
  ['shell', 'Moon Shell', 'beach', 'C', 1.50, ['Echo', 10, 'Hold it to your ear.'], 'Sounds like the sea. Or a fan.', 'Ø 2 in · 1 oz'],
  // … commons, uncommons and rares
];

const set = {
  id: 'beach',                  // short, lowercase, never changes (saves refer to cards as "beach:shell:0")
  name: 'Beach Day',            // shown on packs, cards and in the binder
  series: 'Series 2',
  code: 'BCH',                  // printed in each card's footer
  price: 25000,                 // one pack, in cents; a booster box is 9× this and unlocks at 10×
  curve: { C: .35, U: .5, R: .72 },   // how much rarer the pricey cards are within a rarity (0 = all equally likely)
  types: TYPES,                 // your categories, below
  typeLabel: 'Place',           // what a category is called
  wrappers: [                   // pack wrapper designs: a rare shown big on the front, over three colours
    { hero: 'sandcastle', colors: ['#063a5e', '#1aa0d8', '#c8f4ff'], accent: '#ffd76a' },
  ],
  blurb: 'Printed on the back of the pack.',
  items: LIST.map(([id, name, type, rarity, dollars, [move, power, text], flavor, size], i) => ({
    id, name, type, rarity, price: Math.round(dollars * 100), move: { name: move, power, text }, flavor, size, no: i + 1,
  })),
  models: {},
};
set.ready = Promise.all(['models'].map(f => import(`./${f}.js`)
  .then(m => Object.assign(set.models, m.default))
  .catch(e => console.error(`Models in ${f}.js didn't load:`, e))));
export default set;
```

**Rarities.** Every pack holds 5 commons (`C`), 3 uncommons (`U`) and 1 rare (`R`), in that order, with no card twice.
Aim for at least 10 of each so packs don't repeat themselves, and roughly 3 commons : 3 uncommons : 2 rares
(Around the House has 37 / 34 / 29). An item may set `weight` to override how often it turns up within its rarity.

**Prices.** Card values drive the whole economy. Around the House keeps commons under $10, uncommons at $10–$100
and rares over $100, with a pack at $250. A pack's cards are worth about $980 on average but only about $530 at the
median, because a few rares are very dear, so most packs lose a little and a few pay for many more. If your prices
are on a different scale, move `price` with them.

**Numbering.** `no` is the card's number in the set (`001/100`). The binder sorts by it.

**Weakness, resistance, upkeep.** Each card's stat row comes from its category (`weak`, `resist`: another category's
key) and its price (upkeep dots). An item can override any of them with its own `weak`, `resist` or `upkeep`.

## 2. Categories (`types`)

Each key is a category. The card frame takes its colours from it; the picture behind the item is painted by `scene`.

```js
export const TYPES = {
  beach: {
    name: 'Beach', color: '#f2a93b', light: '#fff1d6', dark: '#7a4a00', weak: 'storm', resist: 'pool',
    icon(g, x, y, r) { /* draw a white glyph centred on x, y within radius r (fillStyle is already white) */ },
    scene(g, w, h, o) { /* paint the background: o.floor is the y the item stands on, o.full is true on full-art cards */ },
  },
};
```

`scene` is optional (a plain gradient in the category's colours is used without it). `house/rooms.js` has eight
worked examples: tiled walls, counters, wallpaper, a lawn with a picket fence. The game adds the glow, sparkles and
light rays on top, so a scene only needs the room.

## 3. Models

`set.models` maps each item id to a function that builds it with the modelling kit (`../kit.js`) and returns a
three.js object. The studio lights it, frames it and renders it for the card; you only build the thing.

```js
export default {
  shell(k) {
    const g = k.group();
    k.add(g, k.lathe([[0, 0], [.8, .1], [1, .6], [.4, 1.4], [0, 1.6]], { smooth: true }), k.ceramic('#ffd9e6'));
    g.userData.view = { az: 30, el: 20 };     // optional camera angle (degrees)
    return g;
  },
};
```

- The model stands on y = 0 and faces +z. Units don't matter; proportions do.
- `g.userData.view` changes the camera (azimuth, elevation); `fullView` changes it for full-art cards only;
  `floating: true` drops the floor shadow (for things that hang).
- Use `k.rand()` rather than `Math.random()` so the picture is the same every time.
- An item without a model gets a stand-in gift box, so you can add cards first and models later.

Open `dev.html?set=yourset` (from a local server, such as `npm run dev` then `/boosterpacks/dev.html`) to see every
model's picture in a contact sheet. Add `&kind=full` for full-art framing, `&kind=card&v=0,1,2,3` for finished cards
in all four finishes, or `&items=a,b` to show a few.

## 4. Register it

In `sets/index.js`, import the set and add it to `SETS`. With more than one set, the shop shows a switch for which
set's packs to buy, the binder files every set's cards in set order, and the menu tracks progress per set.

Don't rename or delete a card id once people have it: saves store cards as `set:item:variant`. Cards from a set that's
no longer registered stay in the save but don't show.
