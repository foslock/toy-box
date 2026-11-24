// The home page's upvotes and play counts, as a request handler:
//
//   GET  /api/votes        → { counts: { cave: 12, … }, plays: { cave: 340, … }, mine: ["cave"], resetsIn: 43200000 }
//   POST /api/votes/cave   → { toy: "cave", count: 13, resetsIn: 43200000 }
//   POST /api/plays/cave   → { toy: "cave", count: 341 }
//
// A visitor can upvote each toy once per UTC day. `mine` is what they've upvoted today, and `resetsIn` is how many
// milliseconds until they can again. A visitor is a random id in a cookie, set by their first vote and not before.
// Clearing cookies gets a new id, so an address can also only add so many votes to one toy in a day; that tally is
// kept in memory, and no address is ever stored.
//
// A toy's page reports a play when it loads, unless that browser loaded the same toy in the last half hour (see
// build.mjs), so nothing here needs to know who's playing. The same tally keeps a script from running a count up, and
// crawlers that run the page aren't players.
import { randomUUID } from 'node:crypto';

const COOKIE = 'toybox_visitor', COOKIE_AGE = 400 * 24 * 3600;   // seconds; as long as browsers allow
const DAY = 24 * 3600 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// (Cubot is a make of phone.)
const BOT = /(?<!cu)bot\b|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i;
const COUNTS_FOR = 5000;   // ms one look at the counts is good for

export function createApi({ store, slugs, perAddress = 20, playsPerAddress = 100, now = Date.now }) {
  const known = new Set(slugs);
  const today = () => new Date(now()).toISOString().slice(0, 10), resetsIn = () => DAY - now() % DAY;

  // Counts are read at most every few seconds, however many visitors turn up at once.
  let counts = null, countsAt = -Infinity;
  function readCounts() {
    if (!counts || now() - countsAt >= COUNTS_FOR) {
      const read = counts = store.counts();
      countsAt = now();
      read.catch(() => { if (counts === read) counts = null; });
    }
    return counts;
  }

  let tally = new Map(), tallyDay = '';
  function tallied(address, kind, toy, most) {
    if (tallyDay !== today() || tally.size > 100_000) { tally = new Map(); tallyDay = today(); }
    const key = `${address} ${kind} ${toy}`;
    return { full: (tally.get(key) || 0) >= most, add: () => tally.set(key, (tally.get(key) || 0) + 1) };
  }

  return async function handle(req, res) {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
      res.end(JSON.stringify(body));
    };
    const pathname = req.url.split('?')[0];
    const m = pathname.match(/^\/api\/(?:votes|(votes|plays)\/([a-z0-9_-]+))\/?$/);
    if (!m) return send(404, { error: 'not found' });
    const [, kind, toy] = m;
    if (req.method !== (toy ? 'POST' : 'GET')) return send(405, { error: 'method not allowed' }, { Allow: toy ? 'POST' : 'GET' });
    if (toy && !known.has(toy)) return send(404, { error: 'no such toy' });
    // Another site's page can't vote or play on a visitor's behalf.
    if (toy && !['same-origin', 'none', undefined].includes(req.headers['sec-fetch-site'])) return send(403, { error: 'these come from the site itself' });

    const id = cookie(req, COOKIE), visitor = id && UUID.test(id) ? id : null;
    try {
      if (!toy) {
        const [all, mine] = await Promise.all([readCounts(), visitor ? store.votedOn(visitor, today()) : []]);
        const object = totals => Object.fromEntries([...totals].filter(([t]) => known.has(t)));
        return send(200, { counts: object(all.votes), plays: object(all.plays), mine: mine.filter(t => known.has(t)), resetsIn: resetsIn() });
      }
      const spot = tallied(addressOf(req), kind, toy, kind === 'votes' ? perAddress : playsPerAddress);
      if (kind === 'plays') {
        // One that doesn't count isn't a mistake: the page has nothing to do about it.
        if (!spot.full && !BOT.test(req.headers['user-agent'] || '')) { await store.play(toy, today()); spot.add(); counts = null; }
        return send(200, { toy, count: (await readCounts()).plays.get(toy) || 0 });
      }
      if (spot.full) return send(429, { error: 'too many votes from this address today' }, { 'Retry-After': Math.ceil(resetsIn() / 1000) });
      const who = visitor || randomUUID();
      if (await store.add(toy, who, today())) { spot.add(); counts = null; }
      const n = (await readCounts()).votes.get(toy) || 0;
      const secure = req.headers['x-forwarded-proto']?.split(',')[0].trim() === 'https' ? '; Secure' : '';
      return send(200, { toy, count: n, resetsIn: resetsIn() }, visitor ? {} : { 'Set-Cookie': `${COOKIE}=${who}; Path=/api; Max-Age=${COOKIE_AGE}; HttpOnly; SameSite=Lax${secure}` });
    } catch (e) {
      console.error(`[api] ${req.method} ${pathname} failed:`, e.message);
      return send(503, { error: 'votes are unavailable right now' }, { 'Retry-After': '30' });
    }
  };
}

function cookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

// Behind Render's proxy the visitor's address is the first in X-Forwarded-For. A script could make one up, which is
// why this only backs up the cookie.
const addressOf = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
