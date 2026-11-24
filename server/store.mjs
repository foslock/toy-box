// Where the votes and plays are kept: Postgres on the live site, or memory for local preview.
//
// There's one vote per toy, visitor and day, so a second that day changes nothing however it arrives. Plays are just a
// number per toy and day, with nothing about who played. Days are UTC dates ("2026-11-24"), and visitors are the random
// ids the API hands out in a cookie.

const DEFAULT_SCHEMA = 'toy_box';

// The database is shared with other projects, so the tables live in a schema of its own. The name ends up inside SQL
// text, so only a plain lower-case identifier is accepted.
function cleanSchema(raw) {
  const name = (raw ?? '').trim() || DEFAULT_SCHEMA;
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error(`DB_SCHEMA must be a plain lower-case identifier, got "${name}"`);
  return name;
}

// Hosted Postgres wants TLS and presents a certificate Node can't verify; a local server usually has none.
const sslFor = url => /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false };

export async function pgStore({ url, schema: rawSchema }) {
  const schema = cleanSchema(rawSchema), votes = `${schema}.votes`, plays = `${schema}.plays`;
  const { default: pg } = await import('pg');   // only here, so local preview runs without it installed
  const pool = new pg.Pool({ connectionString: url, ssl: sslFor(url), max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 5000 });
  pool.on('error', e => console.warn('[db] idle connection lost:', e.message));

  // The tables are made on first use, and again on the next call if that failed, so the service starts (and recovers)
  // whether or not the database is up yet.
  let made = null;
  const ready = () => made ??= pool.query(`
    CREATE SCHEMA IF NOT EXISTS ${schema};
    CREATE TABLE IF NOT EXISTS ${votes} (
      toy        text        NOT NULL,
      visitor    uuid        NOT NULL,
      day        date        NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (toy, day, visitor)
    );
    CREATE INDEX IF NOT EXISTS votes_visitor_day ON ${votes} (visitor, day);
    CREATE TABLE IF NOT EXISTS ${plays} (
      toy   text    NOT NULL,
      day   date    NOT NULL,
      plays integer NOT NULL,
      PRIMARY KEY (toy, day)
    );
  `).then(() => console.log(`[db] connected, schema "${schema}" ready`), e => { made = null; throw e; });

  return {
    // Both totals, by toy.
    async counts() {
      await ready();
      const total = async sql => new Map((await pool.query(sql)).rows.map(r => [r.toy, r.n]));
      const [v, p] = await Promise.all([
        total(`SELECT toy, count(*)::int AS n FROM ${votes} GROUP BY toy`),
        total(`SELECT toy, sum(plays)::int AS n FROM ${plays} GROUP BY toy`),
      ]);
      return { votes: v, plays: p };
    },
    async votedOn(visitor, day) {
      await ready();
      const { rows } = await pool.query(`SELECT toy FROM ${votes} WHERE visitor = $1 AND day = $2`, [visitor, day]);
      return rows.map(r => r.toy);
    },
    // Whether this vote was a new one.
    async add(toy, visitor, day) {
      await ready();
      const { rowCount } = await pool.query(`INSERT INTO ${votes} (toy, visitor, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [toy, visitor, day]);
      return rowCount === 1;
    },
    async play(toy, day) {
      await ready();
      await pool.query(`INSERT INTO ${plays} AS p (toy, day, plays) VALUES ($1, $2, 1) ON CONFLICT (toy, day) DO UPDATE SET plays = p.plays + 1`, [toy, day]);
    },
    close: () => pool.end(),
  };
}

export function memoryStore() {
  const rows = new Set(), plays = new Map(), key = (...parts) => parts.join(' ');   // "toy day visitor"; none of them has a space
  return {
    async counts() {
      const n = new Map();
      for (const r of rows) { const toy = r.split(' ')[0]; n.set(toy, (n.get(toy) || 0) + 1); }
      return { votes: n, plays: new Map(plays) };
    },
    async votedOn(visitor, day) { return [...rows].map(r => r.split(' ')).filter(r => r[1] === day && r[2] === visitor).map(r => r[0]); },
    async add(toy, visitor, day) { const k = key(toy, day, visitor), fresh = !rows.has(k); rows.add(k); return fresh; },
    async play(toy) { plays.set(toy, (plays.get(toy) || 0) + 1); },
    async close() {},
  };
}
