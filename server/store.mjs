// Where the votes are kept: Postgres on the live site, or memory for local preview.
//
// Both hold one row per toy, visitor and day, so a second vote that day changes nothing however it arrives.
// Days are UTC dates ("2026-11-24"), and visitors are the random ids the API hands out in a cookie.

const DEFAULT_SCHEMA = 'toy_box';

// The database is shared with other projects, so the table lives in a schema of its own. The name ends up inside SQL
// text, so only a plain lower-case identifier is accepted.
function cleanSchema(raw) {
  const name = (raw ?? '').trim() || DEFAULT_SCHEMA;
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error(`DB_SCHEMA must be a plain lower-case identifier, got "${name}"`);
  return name;
}

// Hosted Postgres wants TLS and presents a certificate Node can't verify; a local server usually has none.
const sslFor = url => /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false };

export async function pgStore({ url, schema: rawSchema }) {
  const schema = cleanSchema(rawSchema), votes = `${schema}.votes`;
  const { default: pg } = await import('pg');   // only here, so local preview runs without it installed
  const pool = new pg.Pool({ connectionString: url, ssl: sslFor(url), max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 5000 });
  pool.on('error', e => console.warn('[db] idle connection lost:', e.message));

  // The table is made on first use, and again on the next call if that failed, so the service starts (and recovers)
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
  `).then(() => console.log(`[db] connected, schema "${schema}" ready`), e => { made = null; throw e; });

  return {
    async counts() {
      await ready();
      const { rows } = await pool.query(`SELECT toy, count(*)::int AS n FROM ${votes} GROUP BY toy`);
      return new Map(rows.map(r => [r.toy, r.n]));
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
    close: () => pool.end(),
  };
}

export function memoryStore() {
  const rows = new Set(), key = (...parts) => parts.join(' ');   // "toy day visitor"; none of them has a space
  return {
    async counts() {
      const n = new Map();
      for (const r of rows) { const toy = r.split(' ')[0]; n.set(toy, (n.get(toy) || 0) + 1); }
      return n;
    },
    async votedOn(visitor, day) { return [...rows].map(r => r.split(' ')).filter(r => r[1] === day && r[2] === visitor).map(r => r[0]); },
    async add(toy, visitor, day) { const k = key(toy, day, visitor), fresh = !rows.has(k); rows.add(k); return fresh; },
    async close() {},
  };
}
