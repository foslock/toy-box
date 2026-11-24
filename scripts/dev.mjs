// Serves the built site from dist/ for local preview, with the vote API beside it as on the live site. Run `npm run dev`
// (it builds first). Votes are kept in memory until it stops; set DATABASE_URL to keep them in Postgres instead (after
// `npm ci --prefix server`).
import { join } from 'node:path';
import { ROOT, loadToys } from './lib/toys.mjs';
import { serve } from './lib/serve.mjs';
import { createApi } from '../server/api.mjs';
import { memoryStore, pgStore } from '../server/store.mjs';

const { DATABASE_URL, DB_SCHEMA } = process.env;
const store = DATABASE_URL ? await pgStore({ url: DATABASE_URL, schema: DB_SCHEMA }) : memoryStore();
const api = createApi({ store, slugs: loadToys().toys.map(t => t.slug) });
const { url } = await serve(join(ROOT, 'dist'), Number(process.env.PORT) || 5173, api);
console.log(`Toy Box → ${url} (votes in ${DATABASE_URL ? 'Postgres' : 'memory'})`);
