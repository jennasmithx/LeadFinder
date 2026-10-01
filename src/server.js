#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLeads, loadEnv, pickSource } from './finder.js';
import { CITIES, BUSINESS_TYPES } from './cities.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT) || 3000;
const OUT = path.join(ROOT, 'leads.xlsx');

loadEnv();
let busy = false;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) data += chunk;
  return JSON.parse(data || '{}');
}

// Streams progress as newline-delimited JSON so the page can show leads as they come in.
async function generate(req, res) {
  if (busy) return json(res, 409, { error: 'Already generating, wait for it to finish.' });
  const body = await readBody(req);
  const types = [...(body.types ?? []), ...String(body.customType ?? '').split(',')].map((s) => s.trim()).filter(Boolean);
  const location = String(body.location ?? '').trim();
  if (!types.length || !location) return json(res, 400, { error: 'Pick a city and at least one business type.' });

  busy = true;
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
  const send = (e) => res.write(`${JSON.stringify(e)}\n`);
  try {
    for await (const e of findLeads({
      types,
      locations: [location],
      limit: Math.min(Math.max(Number(body.limit) || 50, 1), 500),
      out: OUT,
      requireWhatsapp: !body.includeLandlines,
    })) {
      send(e);
    }
  } catch (err) {
    send({ type: 'error', message: err.message });
  } finally {
    busy = false;
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(path.join(ROOT, 'public', 'index.html')).pipe(res);
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, { source: pickSource(), cities: Object.keys(CITIES), types: BUSINESS_TYPES, hasSheet: fs.existsSync(OUT) });
    }
    if (req.method === 'POST' && url.pathname === '/api/generate') return await generate(req, res);
    if (req.method === 'GET' && url.pathname === '/api/download') {
      if (!fs.existsSync(OUT)) return json(res, 404, { error: 'No leads yet.' });
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="leads.xlsx"',
      });
      return fs.createReadStream(OUT).pipe(res);
    }
    json(res, 404, { error: 'Not found' });
  } catch (err) {
    if (!res.headersSent) json(res, 500, { error: err.message });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Lead Finder is running → open http://localhost:${PORT}`);
  if (!pickSource()) console.log('Warning: no APIFY_TOKEN or GOOGLE_MAPS_API_KEY in .env yet. See README.');
});
