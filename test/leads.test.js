import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { websiteKind, whatsappStatus, rejectReason, toLead } from '../src/leads.js';
import { searchPlaces } from '../src/places.js';
import { appendLeads, existingPlaceIds } from '../src/sheet.js';

const opts = { includeSocial: true, requireWhatsapp: true, defaultCountry: 'ZA' };
const mobile = { id: 'a', displayName: { text: 'Glow Nails' }, nationalPhoneNumber: '082 555 1234', businessStatus: 'OPERATIONAL' };
const landline = { id: 'b', displayName: { text: 'Old Salon' }, nationalPhoneNumber: '011 555 1234', businessStatus: 'OPERATIONAL' };

test('website classification', () => {
  assert.equal(websiteKind(undefined), 'none');
  assert.equal(websiteKind('https://www.instagram.com/glow'), 'social');
  assert.equal(websiteKind('https://m.facebook.com/glow'), 'social');
  assert.equal(websiteKind('https://glownails.co.za'), 'website');
});

test('whatsapp detection', () => {
  assert.equal(whatsappStatus(mobile, 'ZA'), 'Likely');
  assert.equal(whatsappStatus(landline, 'ZA'), 'No');
  assert.equal(whatsappStatus({ ...landline, websiteUri: 'https://wa.me/27115551234' }, 'ZA'), 'Confirmed');
});

test('filtering', () => {
  assert.equal(rejectReason(mobile, opts), null);
  assert.equal(rejectReason(landline, opts), 'no WhatsApp');
  assert.equal(rejectReason(landline, { ...opts, requireWhatsapp: false }), null);
  assert.equal(rejectReason({ ...mobile, websiteUri: 'https://glow.co.za' }, opts), 'has website');
  assert.equal(rejectReason({ ...mobile, websiteUri: 'https://instagram.com/g' }, { ...opts, includeSocial: false }), 'has social page');
  assert.equal(rejectReason({ ...mobile, businessStatus: 'CLOSED_PERMANENTLY' }, opts), 'not operational');
});

test('lead has wa.me link', () => {
  const lead = toLead(mobile, { search: 'x', defaultCountry: 'ZA' });
  assert.equal(lead.whatsappLink, 'https://wa.me/27825551234');
  assert.equal(lead.phone, '+27 82 555 1234');
});

test('search follows page tokens', async () => {
  const pages = [{ places: [mobile], nextPageToken: 't' }, { places: [landline] }];
  const bodies = [];
  const fetchImpl = async (_u, init) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, json: async () => pages.shift() };
  };
  const got = [];
  for await (const p of searchPlaces('salons in Joburg', { apiKey: 'k', fetchImpl })) got.push(...p);
  assert.deepEqual(got.map((p) => p.id), ['a', 'b']);
  assert.equal(bodies[1].pageToken, 't');
});

test('sheet appends and dedupes by place id', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'leads-')), 'leads.xlsx');
  await appendLeads(file, [toLead(mobile, { search: 's', defaultCountry: 'ZA' })]);
  await appendLeads(file, [toLead(landline, { search: 's', defaultCountry: 'ZA' })]);
  assert.deepEqual([...(await existingPlaceIds(file))], ['a', 'b']);
});
