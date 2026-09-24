// Serves the built site from dist/ for local preview. Run `npm run dev` (it builds first).
import { join } from 'node:path';
import { ROOT } from './lib/toys.mjs';
import { serve } from './lib/serve.mjs';

const { url } = await serve(join(ROOT, 'dist'), Number(process.env.PORT) || 5173);
console.log(`Toy Box → ${url}`);
