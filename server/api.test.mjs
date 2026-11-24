// npm test. Runs against the in-memory store, and against a real Postgres too if TEST_DATABASE_URL is set (the tests
// use a throwaway schema there and drop it).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApi } from './api.mjs';
import { memoryStore, pgStore } from './store.mjs';

const NOON = Date.UTC(2026, 10, 24, 12);

async function start(store, opts = {}) {
  const clock = { t: NOON };
  const server = createServer(createApi({ store, slugs: ['cave', 'wine'], now: () => clock.t, ...opts }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // A visitor with their own cookie jar.
  const visitor = (headers = {}) => {
    let jar = '';
    const call = async (method, path) => {
      const res = await fetch(base + path, { method, headers: { ...headers, ...(jar && { cookie: jar }) } });
      const set = res.headers.get('set-cookie');
      if (set) jar = set.split(';')[0];
      return { status: res.status, set, body: await res.json(), headers: res.headers };
    };
    return { get: () => call('GET', '/api/votes'), vote: toy => call('POST', `/api/votes/${toy}`), play: toy => call('POST', `/api/plays/${toy}`), call };
  };
  return { clock, visitor, stop: () => { server.close(); server.closeAllConnections(); } };
}

const url = process.env.TEST_DATABASE_URL, schema = `toy_box_test_${process.pid}`;
const stores = [['memory', async () => memoryStore()]];
if (url) stores.push(['postgres', () => pgStore({ url, schema })]);

for (const [name, make] of stores) describe(`votes in ${name}`, () => {
  let store, api;
  before(async () => { store = await make(); });
  after(() => store.close());

  test('a visitor gets one vote per toy per day', async () => {
    api = await start(store);
    try {
      const a = api.visitor(), b = api.visitor();
      let r = await a.get();
      assert.deepEqual([r.status, r.body.counts, r.body.mine, r.set], [200, {}, [], null], 'nobody gets a cookie for looking');
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assert.equal(r.body.resetsIn, 12 * 3600 * 1000);

      r = await a.vote('cave');
      assert.deepEqual([r.status, r.body.count], [200, 1]);
      assert.match(r.set, /^toybox_visitor=[0-9a-f-]{36}; Path=\/api; Max-Age=\d+; HttpOnly; SameSite=Lax$/);
      r = await a.vote('cave');
      assert.deepEqual([r.status, r.body.count, r.set], [200, 1, null], 'again the same day changes nothing');
      assert.equal((await a.vote('wine')).body.count, 1, 'another toy is another vote');
      assert.equal((await b.vote('cave')).body.count, 2, 'and so is another visitor');
      assert.deepEqual((await b.get()).body.mine, ['cave']);

      api.clock.t += 12 * 3600 * 1000;   // midnight UTC
      r = await a.get();
      assert.deepEqual([r.body.counts, r.body.mine], [{ cave: 2, wine: 1 }, []]);
      assert.equal((await a.vote('cave')).body.count, 3, 'the next day they can vote again');
    } finally { api.stop(); }
  });

  test('plays add up, whoever they come from', async () => {
    api = await start(store);
    try {
      const a = api.visitor(), b = api.visitor();
      const r = await a.play('wine');
      assert.deepEqual([r.status, r.body, r.set], [200, { toy: 'wine', count: 1 }, null], 'nobody gets a cookie for playing');
      await Promise.all(Array.from({ length: 10 }, () => b.play('wine')));
      api.clock.t += 24 * 3600 * 1000;
      assert.equal((await a.play('wine')).body.count, 12, 'across days too');
      assert.deepEqual((await b.get()).body.plays, { wine: 12 });
      assert.equal((await a.play('nope')).status, 404);
    } finally { api.stop(); }
  });

  test('votes at the same moment count once', async () => {
    api = await start(store);
    try {
      const a = api.visitor(), n = (await a.vote('wine')).body.count;
      api.clock.t += 2 * 24 * 3600 * 1000;
      await Promise.all(Array.from({ length: 8 }, () => a.vote('wine')));
      assert.equal((await a.vote('wine')).body.count, n + 1);
    } finally { api.stop(); }
  });
});

test('what it turns away', async () => {
  const api = await start(memoryStore());
  try {
    const a = api.visitor();
    assert.equal((await a.vote('nope')).status, 404);
    assert.equal((await a.call('POST', '/api/votes')).status, 405);
    assert.equal((await a.call('GET', '/api/votes/cave')).status, 405);
    assert.equal((await a.call('GET', '/api/plays/cave')).status, 405);
    assert.equal((await a.call('POST', '/api/plays')).status, 404);
    assert.equal((await a.call('POST', '/api/PLAYS/cave')).status, 404);
    assert.equal((await api.visitor({ 'sec-fetch-site': 'cross-site' }).play('cave')).status, 403);
    assert.equal((await api.visitor({ 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }).play('cave')).body.count, 0, 'crawlers are not players');
    assert.equal((await a.call('GET', '/api/other')).status, 404);
    assert.equal((await a.call('GET', '//')).status, 404);
    assert.equal((await api.visitor({ 'sec-fetch-site': 'cross-site' }).vote('cave')).status, 403);
    assert.equal((await api.visitor({ 'sec-fetch-site': 'same-origin' }).vote('cave')).status, 200);
    assert.match((await api.visitor({ 'x-forwarded-proto': 'https' }).vote('cave')).set, /; Secure$/);
    assert.equal((await api.visitor({ cookie: 'toybox_visitor=DROP TABLE' }).vote('cave')).status, 200, 'a made-up id is replaced');
  } finally { api.stop(); }
});

test('one address can only add so many votes to a toy in a day', async () => {
  const api = await start(memoryStore(), { perAddress: 3 });
  try {
    const from = ip => api.visitor({ 'x-forwarded-for': `${ip}, 10.0.0.1` });
    for (let i = 0; i < 3; i++) assert.equal((await from('203.0.113.5').vote('cave')).status, 200);
    assert.equal((await from('203.0.113.5').vote('cave')).status, 429);
    assert.equal((await from('203.0.113.5').vote('wine')).status, 200);
    assert.equal((await from('203.0.113.6').vote('cave')).status, 200);
    api.clock.t += 24 * 3600 * 1000;
    assert.equal((await from('203.0.113.5').vote('cave')).status, 200);
  } finally { api.stop(); }
});

test('one address can only add so many plays to a toy in a day, and that is apart from its votes', async () => {
  const api = await start(memoryStore(), { perAddress: 2, playsPerAddress: 3 });
  try {
    const a = api.visitor({ 'x-forwarded-for': '203.0.113.5' });
    for (let i = 0; i < 6; i++) assert.equal((await a.play('cave')).status, 200);
    assert.equal((await a.get()).body.plays.cave, 3);
    assert.equal((await a.vote('cave')).body.count, 1);
  } finally { api.stop(); }
});

test('a database that is down is a 503, and recovers', async () => {
  const good = memoryStore(), down = async () => { throw new Error('connection refused'); };
  const store = { counts: down, votedOn: down, add: down, play: down };
  const api = await start(store), log = console.error;
  console.error = () => {};
  try {
    const a = api.visitor();
    assert.equal((await a.get()).status, 503);
    assert.equal((await a.vote('cave')).status, 503);
    assert.equal((await a.play('cave')).status, 503);
    Object.assign(store, good);
    assert.equal((await a.vote('cave')).status, 200);
    assert.deepEqual((await a.get()).body.counts, { cave: 1 });
  } finally { console.error = log; api.stop(); }
});

if (url) after(async () => {
  const { default: pg } = await import('pg'), c = new pg.Client({ connectionString: url });
  await c.connect(); await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await c.end();
});
test('the schema name is checked', async () => { await assert.rejects(pgStore({ url: 'postgres://localhost/x', schema: 'a; drop' }), /DB_SCHEMA/); });
