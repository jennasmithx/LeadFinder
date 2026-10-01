import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/store.js';
import { planSearch, startGenerate, checkJob, updateLead, listLeads, getSettings, saveSettings, whatsappLinkWithMessage } from '../src/core.js';
import { handle } from '../src/api.js';
import { buildInput, normalize } from '../src/apify.js';
import { resolveScope } from '../src/cities.js';

const items = [
  { placeId: 'p1', title: 'Glow Nails', phone: '082 555 1234', phoneUnformatted: '+27825551234', address: 'Sandton', totalScore: 4.6, reviewsCount: 30, searchString: 'nail salons' },
  { placeId: 'p2', title: 'Office Salon', phone: '011 555 1234', searchString: 'nail salons' },
  { placeId: 'p3', title: 'Gone Gym', phone: '072 111 2222', permanentlyClosed: true },
  { placeId: 'p4', title: 'Low Stars', phone: '073 111 2222', totalScore: 2.1, reviewsCount: 3 },
];

// Fake Apify: the run is RUNNING on the first check and SUCCEEDED after that.
function fakeApify() {
  const calls = [];
  let checks = 0;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    let body;
    if (url.endsWith('/runs')) body = { data: { id: `r${calls.length}`, status: 'READY', defaultDatasetId: 'd1' } };
    else if (url.includes('/actor-runs/')) body = { data: { status: checks++ ? 'SUCCEEDED' : 'RUNNING', defaultDatasetId: 'd1' } };
    else if (url.includes('/datasets/d1/items')) body = items;
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, calls };
}

test('normalize and input', () => {
  assert.equal(normalize(items[2]).businessStatus, 'CLOSED_PERMANENTLY');
  assert.equal(buildInput(['gyms'], 'Durban', 5).website, 'withoutWebsite');
});

test('planSearch rotates through areas, then digs deeper', async () => {
  const store = new MemoryStore();
  const durban = resolveScope({ location: 'durban' });
  const a = await planSearch(store, { scope: durban, types: ['gyms'], limit: 10 });
  const b = await planSearch(store, { scope: resolveScope({ province: 'KwaZulu-Natal', town: 'Durban' }), types: ['gyms'], limit: 10 });
  assert.equal(a.area, 'Durban CBD, Durban');
  assert.equal(a.query, 'Durban CBD, Durban, South Africa');
  assert.equal(b.area, 'Umhlanga, Durban'); // typed "durban" and picking Durban share one rotation
  for (let i = 2; i < 16; i++) await planSearch(store, { scope: durban, types: ['gyms'], limit: 10 });
  const again = await planSearch(store, { scope: durban, types: ['gyms'], limit: 10 });
  assert.equal(again.area, 'Durban CBD, Durban');
  assert.equal(again.maxPerSearch, a.maxPerSearch * 2);
});

test('provinces, all of SA and typed places', async () => {
  const store = new MemoryStore();
  const plan = (body) => planSearch(store, { scope: resolveScope(body), types: ['plumbers'], limit: 10 });
  assert.deepEqual([(await plan({ province: 'Limpopo' })).area, (await plan({ province: 'Limpopo' })).area], ['Polokwane, Limpopo', 'Tzaneen, Limpopo']);
  // A province spreads across its towns rather than doing every Joburg suburb first.
  const gp = resolveScope({ province: 'Gauteng' }).areas.slice(0, 3).map((x) => x.label);
  assert.deepEqual(gp, ['Sandton, Johannesburg', 'Pretoria CBD, Pretoria', 'Benoni, Ekurhuleni']);
  const sa = resolveScope({ province: 'All of South Africa' });
  assert.deepEqual(sa.areas.slice(0, 2).map((x) => x.label), ['Sandton, Johannesburg', 'Cape Town CBD, Cape Town']);
  assert.equal(new Set(sa.areas.map((x) => x.query)).size, sa.areas.length);
  assert.equal((await plan({ location: 'Hogsback' })).query, 'Hogsback, South Africa');
  assert.equal((await plan({ location: 'limpopo' })).area, 'Mokopane, Limpopo'); // same rotation as picking Limpopo
  // Tzaneen was already searched via Limpopo, so picking it directly searches deeper.
  const tz = await plan({ province: 'Limpopo', town: 'Tzaneen' });
  assert.equal(tz.area, 'Tzaneen, Limpopo');
  assert.equal(tz.maxPerSearch, 2 * (await plan({ province: 'Northern Cape' })).maxPerSearch);
  assert.equal(resolveScope({ province: 'Atlantis' }), null);
  assert.equal(resolveScope({ province: 'Gauteng', town: 'Durban' }), null);
});

test('generate → job → leads saved once, filters applied', async () => {
  const store = new MemoryStore();
  const { fetchImpl, calls } = fakeApify();
  const ctx = { env: { APIFY_TOKEN: 't' }, store, fetchImpl };

  const started = await startGenerate(ctx, { province: 'Gauteng', town: 'Johannesburg', types: ['nail salons'], limit: 10, minRating: 3 });
  assert.equal(started.done, false);
  assert.equal(started.area, 'Sandton, Johannesburg');
  assert.equal(JSON.parse(calls[0].init.body).locationQuery, 'Sandton, Johannesburg, South Africa');

  assert.equal((await checkJob(ctx, started.jobId)).done, false);
  const done = await checkJob(ctx, started.jobId);
  assert.equal(done.added, 1);
  assert.deepEqual(done.skipped, { 'no WhatsApp': 1, 'not operational': 1, 'rating too low': 1 });

  const leads = await listLeads(store);
  assert.deepEqual(leads.map((l) => [l.name, l.status, l.search]), [['Glow Nails', 'New', 'nail salons in Sandton, Johannesburg']]);

  // Checking again doesn't add twice; a second search (no rating filter) skips businesses already saved.
  assert.equal((await checkJob(ctx, started.jobId)).added, 1);
  const second = await startGenerate(ctx, { location: 'Johannesburg', types: ['nail salons'], limit: 10 });
  assert.equal(second.area, 'Randburg, Johannesburg');
  const r2 = await checkJob(ctx, second.jobId);
  assert.equal(r2.added, 1);
  assert.equal(r2.skipped['already in your list'], 1);
  assert.deepEqual((await store.get('leads', [])).map((l) => l.name), ['Glow Nails', 'Low Stars']);
});

test('status and notes survive new leads being saved at the same time', async () => {
  const store = new MemoryStore();
  await store.set('leads', [{ placeId: 'x' }]);
  await updateLead(store, { placeId: 'x', status: 'Interested' });
  await updateLead(store, { placeId: 'x', notes: 'wants a site' });
  await store.set('leads', [{ placeId: 'x' }, { placeId: 'y' }]); // a search finishing
  assert.deepEqual(await listLeads(store), [
    { placeId: 'x', status: 'Interested', notes: 'wants a site' },
    { placeId: 'y', status: 'New', notes: '' },
  ]);
  await assert.rejects(updateLead(store, { placeId: 'x', status: 'Bogus' }));
  await assert.rejects(updateLead(store, { placeId: 'nope', status: 'New' }));
});

// Minimal stand-ins for Node's req/res.
function call(name, { method = 'GET', headers = {}, body, url = `/api/${name}` } = {}, env) {
  return new Promise((resolve) => {
    const req = { method, headers, url, body };
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(data) { resolve({ status: this.statusCode, body: this.headers['Content-Type'] === 'application/json' ? JSON.parse(data) : data }); },
    };
    handle(req, res, name, { env, fetchImpl: fakeApify().fetchImpl });
  });
}

test('password protects everything except config', async () => {
  const env = { APIFY_TOKEN: 't', APP_PASSWORD: 'secret' };
  assert.equal((await call('config', {}, env)).body.needsPassword, true);
  assert.equal((await call('leads', {}, env)).status, 401);
  assert.equal((await call('leads', { headers: { 'x-app-password': 'nope' } }, env)).status, 401);
  assert.equal((await call('generate', { headers: { 'x-app-password': 'secret' } }, env)).status, 405);
});

test('on Vercel a password is required', async () => {
  const r = await call('leads', {}, { APIFY_TOKEN: 't', VERCEL: '1' });
  assert.equal(r.status, 500);
  assert.match(r.body.error, /APP_PASSWORD/);
});

test('WhatsApp message: saved, defaulted, and put into the link with the business name', async () => {
  const store = new MemoryStore();
  assert.match((await getSettings(store)).message, /^Hi \{business\},/);
  await saveSettings(store, { message: 'Hi {business}, quick question?' });
  const { message } = await getSettings(store);
  const link = whatsappLinkWithMessage({ name: 'Glow & Co', whatsappLink: 'https://wa.me/27825551234' }, message);
  assert.equal(link, 'https://wa.me/27825551234?text=Hi%20Glow%20%26%20Co%2C%20quick%20question%3F');
  assert.equal(whatsappLinkWithMessage({ name: 'X', whatsappLink: '' }, message), '');
});
