// The vote service (upvotes and play counts) behind theboxof.toys/api (see render.yaml). Needs DATABASE_URL; PORT and DB_SCHEMA are optional.
import { createServer } from 'node:http';
import { loadToys } from '../scripts/lib/toys.mjs';
import { createApi } from './api.mjs';
import { pgStore } from './store.mjs';

const { DATABASE_URL, DB_SCHEMA, PORT } = process.env;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL to the Postgres connection string. (npm run dev in the repo root previews votes without one.)');
  process.exit(1);
}
const store = await pgStore({ url: DATABASE_URL, schema: DB_SCHEMA });
const slugs = loadToys().toys.map(t => t.slug), api = createApi({ store, slugs });
store.counts().catch(e => console.warn('[db] not reachable yet:', e.message));   // connect and make the table now rather than on the first visit

const server = createServer((req, res) => {
  // Up is up: a database hiccup is the API's 503 to report, not a reason to restart.
  if (req.url === '/healthz') return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
  api(req, res).catch(e => { console.error(e); if (!res.headersSent) res.writeHead(500); res.end(); });
});
server.listen(Number(PORT) || 5174, () => console.log(`Votes for ${slugs.length} toys on port ${server.address().port}`));
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { server.close(() => store.close().finally(() => process.exit(0))); server.closeIdleConnections(); });
