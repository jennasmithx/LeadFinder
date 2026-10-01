import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { searchApify, normalize } from '../src/apify.js';
import { findLeads, pickSource } from '../src/finder.js';

const items = [
  { placeId: 'p1', title: 'Glow Nails', phone: '082 555 1234', phoneUnformatted: '+27825551234', address: 'Sandton', url: 'https://maps.google.com/?cid=1', categoryName: 'Nail salon', searchString: 'nail salons' },
  { placeId: 'p2', title: 'Office Salon', phone: '011 555 1234', address: 'Rosebank' },
  { placeId: 'p3', title: 'Gone Gym', phone: '072 111 2222', permanentlyClosed: true },
];

// Fake Apify API: run starts RUNNING, finishes on first poll, then returns the dataset.
function fakeApify(calls = []) {
  return async (url, init = {}) => {
    calls.push({ url, init });
    let body;
    if (url.includes('/runs?')) body = { data: { id: 'r1', status: 'RUNNING', defaultDatasetId: 'd1' } };
    else if (url.includes('/actor-runs/r1')) body = { data: { id: 'r1', status: 'SUCCEEDED', defaultDatasetId: 'd1' } };
    else if (url.includes('/datasets/d1/items')) body = items;
    return { ok: true, json: async () => body };
  };
}

test('normalize maps closed flags', () => {
  assert.equal(normalize(items[2]).businessStatus, 'CLOSED_PERMANENTLY');
  assert.equal(normalize(items[0]).displayName.text, 'Glow Nails');
});

test('searchApify starts run with no-website filter, polls, and returns items', async () => {
  const calls = [];
  const pages = [];
  for await (const p of searchApify({ types: ['gyms'], location: 'Durban, South Africa', maxPerSearch: 10, token: 't', fetchImpl: fakeApify(calls) })) pages.push(p);
  const input = JSON.parse(calls[0].init.body);
  assert.equal(input.website, 'withoutWebsite');
  assert.equal(input.locationQuery, 'Durban, South Africa');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer t');
  assert.deepEqual(pages[0].map((p) => p.id), ['p1', 'p2', 'p3']);
});

test('pickSource prefers Apify', () => {
  assert.equal(pickSource({ APIFY_TOKEN: 'a', GOOGLE_MAPS_API_KEY: 'g' }), 'apify');
  assert.equal(pickSource({ GOOGLE_MAPS_API_KEY: 'g' }), 'google');
  assert.equal(pickSource({}), null);
});

test('findLeads keeps only open mobile-number businesses and writes the sheet', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'leads-')), 'leads.xlsx');
  const events = [];
  for await (const e of findLeads({ types: ['nail salons'], locations: ['Johannesburg'], out, env: { APIFY_TOKEN: 't' }, fetchImpl: fakeApify() })) events.push(e);
  const leads = events.filter((e) => e.type === 'lead').map((e) => e.lead);
  assert.deepEqual(leads.map((l) => l.name), ['Glow Nails']);
  assert.equal(leads[0].whatsappLink, 'https://wa.me/27825551234');
  const done = events.at(-1);
  assert.deepEqual(done.skipped, { 'no WhatsApp': 1, 'not operational': 1 });
  assert.ok(fs.existsSync(out));
});
