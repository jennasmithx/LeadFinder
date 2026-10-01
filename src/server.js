#!/usr/bin/env node
// Runs the website on your own computer: npm start → http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './api.js';
import { loadEnv } from './env.js';
import { pickSource } from './core.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT) || 3000;
loadEnv();

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const api = pathname.match(/^\/api\/([\w-]+)$/);
  if (api) return handle(req, res, api[1]);
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(ROOT, 'public', 'index.html')).pipe(res);
  }
  res.writeHead(404).end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Lead Finder is running → open http://localhost:${PORT}`);
  if (!pickSource()) console.log('Warning: no APIFY_TOKEN or GOOGLE_MAPS_API_KEY in .env yet. See README.');
});
