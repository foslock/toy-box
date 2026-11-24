# toy-box

Small browser experiments, published as a static site on [Render](https://render.com). Each experiment lives in its own folder. The home page is generated from those folders and shows a card for each one, with a screenshot and a short blurb.

```
toy-box/
├── cave/                 one toy per top-level folder
│   ├── index.html        the toy itself (plus anything it loads)
│   ├── toy.json          title, blurb, tags… this is what puts it on the home page
│   ├── preview.webp      card image, made by `npm run shots`
│   └── og.jpg            link-preview image, made by `npm run og`
├── site/                 home page template, favicon and the home page's link-preview image
├── scripts/              build, screenshot and local-server scripts (no dependencies)
├── server/               the vote service: upvotes, play counts and the view count, kept in Postgres
└── render.yaml           Render Blueprint
```

## Add a toy

1. Make a folder, for example `boids/`, with an `index.html` in it.
2. Add `boids/toy.json`:

   ```json
   {
     "title": "Boids",
     "blurb": "One sentence on what it is and what to watch for.",
     "added": "2026-10-02",
     "tags": ["canvas", "simulation"],
     "tape": "blue"
   }
   ```

3. Leave the top-left corner of the page clear: the build adds a small Home button there (about 50px square) that links back to the board. Existing toys start their titles 60px in, beside it.
4. `npm run shots -- boids` captures `boids/preview.webp` with your installed Chrome. Previews are taken from the source folder, so the Home button isn't in them.
5. `npm run og -- boids` draws `boids/og.jpg`, the picture iMessage, Slack and social sites show when someone shares the toy's link: the preview cropped to 1200×630 with the toy's name label on it.
6. `npm run dev` builds the site and serves it at http://127.0.0.1:5173.
7. Commit the folder (including both images) and push. Render rebuilds on every push.

### `toy.json` fields

| Field | Required | Default | What it does |
|---|---|---|---|
| `title` | yes | | Name on the card's label |
| `blurb` | yes | | One sentence under the label. The cards are small, four to a row, so keep it to about 25 words |
| `added` | no | | `YYYY-MM-DD`. Shown on the card. What **Newest** sorts by, and what gives the card its New badge for its first week |
| `position` | no | | Pins the card to that spot in the **Newest** order (`1` is the first card) instead of sorting it by date |
| `category` | no | | `games` or `ambient`. The search box finds toys by it |
| `tags` | no | `[]` | Short words the search box finds the toy by. They aren't shown on the card |
| `tape` | no | rotates | Label color: `red`, `blue`, `green`, `teal`, `purple`, `orange`, `black`, or a `#rrggbb` hex |
| `entry` | no | `index.html` | The page to link to, if it isn't `index.html` |
| `preview` | no | `preview.webp` | Card image file. If it's missing, the card shows a striped placeholder with the toy's initials |
| `loader` | no | `false` | Shows a small loading bar while the toy starts up. For toys that take a moment (three.js from the CDN, shader compiles). The toy calls `window.toyboxReady?.()` right after it queues its first frame; see below |
| `capture` | no | see below | How `npm run shots` takes the screenshot |
| `share` | no | `{ "y": 50 }` | How `npm run og` crops the preview for the link-preview image: `y` is how far down the screenshot the crop sits, from `0` (the top) to `100` (the bottom) |

`capture` accepts `width` and `height` (the browser viewport, default 1200×900), `wait` (milliseconds to let the toy animate before the shot, default 2500), `scale` (pixel density, default 1), `selector` (a CSS selector to crop to, such as `"canvas"`; by default the whole viewport is captured) and `query` (appended to the page URL, such as `"?demo"`, for toys that need to be doing something in the shot).

### Loading bar

Toys that stall for a second or two before anything draws set `"loader": true`. The build then adds a small progress bar to the middle of the page, and the toy tells it when it's running:

```js
requestAnimationFrame(frame);
window.toyboxReady?.();   // the bar disappears in the same paint as that first frame
```

The `?.` keeps the toy working when it's opened straight from its folder, where there's no bar. The bar is there from the first paint. It turns into a "Try again" button if a script fails to load or throws during startup, and clears itself 15 seconds after the page loads if the toy never calls in.

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Writes the site to `dist/`: every toy folder (with a Home button added to its page) plus the generated home page. Stops with a clear message if a `toy.json` is invalid |
| `npm run dev` | Builds, then serves `dist/` locally with the vote API beside it (`PORT` overrides 5173). Votes last until it stops, unless `DATABASE_URL` is set |
| `npm test --prefix server` | Tests the vote service (after `npm ci --prefix server`). Set `TEST_DATABASE_URL` to run them on a real Postgres too, in a throwaway schema |
| `npm run shots` | Captures previews for toys that don't have one yet. Name toys to re-capture them (`npm run shots -- cave`), or pass `--all`. Needs Node 22+ and Chrome (set `CHROME_PATH` if Chrome isn't found) |
| `npm run og` | Draws the link-preview images: `site/og.png` (the TOY BOX label on the pegboard) and every toy's `og.jpg`. Name toys to redraw just those (`npm run og -- cave`). Same needs as `shots` |

Screenshots are taken locally and committed, so the Render build never needs a browser. The build adds Open Graph tags to the home page and every toy page, pointing at `https://theboxof.toys`; a toy without an `og.jpg` uses the home page's image.

## Order, votes, plays, views and New badges

The board opens with the most upvoted toys first. **Most played** and **Newest** switch it to those orders; ties go newest first. The order and the search ride in the address: `/?sort=played&q=cards` (or `sort=new`).

A visitor can upvote each toy once per day (UTC). A visitor is a random id in a cookie their first vote sets; it's only sent to `/api`. As a backstop against cleared cookies, one network address can add at most 20 votes to a toy in a day. That tally is kept in memory, and addresses aren't stored. The home page remembers the last counts it saw, so it opens in order at once, and it still works if the vote service is away: no thumbs and newest first on a first visit, the last known order after that.

Toys added in the last week carry a New badge until the visitor opens them. Each toy's page notes its own opening in `localStorage` (`toybox-opened`, added by the build), so it counts however they got there.

Each card also shows how many times its toy has been played. A toy's page reports a play when it loads, from the board or straight from its link, unless the same browser loaded that toy in the last 30 minutes. Every load starts the 30 minutes over, so sitting on refresh is one play, and coming back later the same day is another. The browser keeps its own times (`toybox-loads`, in the same script), so nothing about the player is sent. Crawlers aren't counted, and one address can add at most 100 plays to a toy in a day.

The footer counts views of the site, starting from when the counter was added. The home page and every toy page report one when they load, unless the same browser loaded any of them in the last 5 minutes, kept in `localStorage` the same way (`toybox-viewed`). One address can add at most 1,000 a day.

The counts are in the `toy_box` schema of the Postgres database the other projects share (`card-clash-db`). `votes (toy, visitor, day, created_at)` has a row per vote, and its key `(toy, day, visitor)` is what makes it one a day. `plays (toy, day, plays)` is a running total per toy and day, and `views (day, views)` one per day. The service creates them on first start.

## Analytics

The build also adds Google Analytics (`G-YPR5S60RRR`) to the home page and every toy page. It only runs on theboxof.toys, so local previews aren't counted, and toys don't need to do anything for it. Visitors whose device's time zone puts them in the EU, EEA, UK or Switzerland (or who hide their time zone) get a small ask at the bottom of the page, and Analytics doesn't load until they allow it. As a backstop, Google's consent mode starts visitors it places in those countries with analytics cookies off. The answer is saved for the whole site, and **Cookie choices** in the home page footer brings the ask back to change it.

## Deploy on Render

In the Render dashboard choose **New → Blueprint** and pick this repo. `render.yaml` creates two services: a static site that runs `npm run build` and publishes `dist/`, and the vote service in `server/`, which the site passes `/api/*` on to. Pushes to `main` redeploy automatically (the vote service only when something it reads has changed).

The vote service needs one value set in its **Environment** page: `DATABASE_URL`, the **internal** connection string of `card-clash-db`. It must be in that database's region. If Render gives the service another address than `theboxoftoys-api.onrender.com`, put that one in the `/api/*` rewrite in `render.yaml`.

For a few minutes after a deploy, Render's CDN can still serve the previous copy of a file. The build keeps that from mixing old and new modules: it versions each toy's scripts by content, so a toy page's `<script src>`s and every import of the toy's own modules ask for `file.js?v=<hash>`. It does this by adding the entries to the page's import map, or adding an import map if the page has none. A toy only needs to import its own files by relative path, as they all do already. Workers aren't covered: a script started with `new Worker(...)` loads by its plain name.
