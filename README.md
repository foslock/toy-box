# toy-box

Small browser experiments, published as a static site on [Render](https://render.com). Each experiment lives in its own folder. The home page is generated from those folders and shows a card for each one, with a screenshot and a short blurb.

```
toy-box/
├── cave/                 one toy per top-level folder
│   ├── index.html        the toy itself (plus anything it loads)
│   ├── toy.json          title, blurb, tags… this is what puts it on the home page
│   └── preview.webp      card image, made by `npm run shots`
├── site/                 home page template + favicon
├── scripts/              build, screenshot and local-server scripts (no dependencies)
└── render.yaml           Render Blueprint
```

## Add a toy

1. Make a folder, for example `boids/`, with an `index.html` in it.
2. Add `boids/toy.json`:

   ```json
   {
     "title": "Boids",
     "blurb": "One or two sentences on what it is and what to watch for.",
     "added": "2026-10-02",
     "tags": ["canvas", "simulation"],
     "tape": "blue"
   }
   ```

3. Leave the top-left corner of the page clear: the build adds a small Home button there (about 50px square) that links back to the board. Existing toys start their titles 60px in, beside it.
4. `npm run shots -- boids` captures `boids/preview.webp` with your installed Chrome. Previews are taken from the source folder, so the Home button isn't in them.
5. `npm run dev` builds the site and serves it at http://127.0.0.1:5173.
6. Commit the folder (including the preview image) and push. Render rebuilds on every push.

### `toy.json` fields

| Field | Required | Default | What it does |
|---|---|---|---|
| `title` | yes | | Name on the card's label |
| `blurb` | yes | | Short description under the label |
| `added` | no | | `YYYY-MM-DD`. Cards are sorted newest first |
| `tags` | no | `[]` | Short words shown along the bottom of the card |
| `tape` | no | rotates | Label color: `red`, `blue`, `green`, `teal`, `purple`, `orange`, `black`, or a `#rrggbb` hex |
| `entry` | no | `index.html` | The page to link to, if it isn't `index.html` |
| `preview` | no | `preview.webp` | Card image file. If it's missing, the card shows a striped placeholder with the toy's initials |
| `capture` | no | see below | How `npm run shots` takes the screenshot |

`capture` accepts `width` and `height` (the browser viewport, default 1200×900), `wait` (milliseconds to let the toy animate before the shot, default 2500), `scale` (pixel density, default 1), `selector` (a CSS selector to crop to, such as `"canvas"`; by default the whole viewport is captured) and `query` (appended to the page URL, such as `"?demo"`, for toys that need to be doing something in the shot).

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Writes the site to `dist/`: every toy folder (with a Home button added to its page) plus the generated home page. Stops with a clear message if a `toy.json` is invalid |
| `npm run dev` | Builds, then serves `dist/` locally (`PORT` overrides 5173) |
| `npm run shots` | Captures previews for toys that don't have one yet. Name toys to re-capture them (`npm run shots -- cave`), or pass `--all`. Needs Node 22+ and Chrome (set `CHROME_PATH` if Chrome isn't found) |

Screenshots are taken locally and committed, so the Render build never needs a browser.

## Deploy on Render

In the Render dashboard choose **New → Blueprint** and pick this repo. `render.yaml` creates a static site that runs `npm run build` and publishes `dist/`. Pushes to `main` redeploy automatically.
