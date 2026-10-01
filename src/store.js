import fs from 'node:fs';
import path from 'node:path';
import { apifyFetch } from './apify.js';

// Saves leads in a named key-value store in your Apify account, so the Vercel site,
// your computer and your phone all see the same list.
const storeIds = new Map();

export class ApifyStore {
  constructor(token, fetchImpl = fetch) {
    this.token = token;
    this.fetch = fetchImpl;
  }

  async id() {
    if (!storeIds.has(this.token)) {
      // Returns the existing store if one with this name already exists.
      const res = await apifyFetch(this.fetch, this.token, '/key-value-stores?name=lead-finder', { method: 'POST' });
      if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
      storeIds.set(this.token, (await res.json()).data.id);
    }
    return storeIds.get(this.token);
  }

  async get(key, fallback) {
    const res = await apifyFetch(this.fetch, this.token, `/key-value-stores/${await this.id()}/records/${key}`);
    if (res.status === 404) return fallback;
    if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async set(key, value) {
    const res = await apifyFetch(this.fetch, this.token, `/key-value-stores/${await this.id()}/records/${key}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
  }
}

// Local fallback for people using only a Google key on their own computer.
export class FileStore {
  constructor(file = path.join(process.cwd(), '.data', 'store.json')) {
    this.file = file;
  }

  read() {
    return fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
  }

  async get(key, fallback) {
    return this.read()[key] ?? fallback;
  }

  async set(key, value) {
    const data = this.read();
    data[key] = value;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(data));
  }
}

export class MemoryStore {
  data = {};
  async get(key, fallback) {
    return structuredClone(this.data[key] ?? fallback);
  }
  async set(key, value) {
    this.data[key] = structuredClone(value);
  }
}

export function createStore(env = process.env, fetchImpl = fetch) {
  if (env.APIFY_TOKEN) return new ApifyStore(env.APIFY_TOKEN, fetchImpl);
  if (env.VERCEL) throw new Error('The Vercel version needs APIFY_TOKEN set in Vercel → Settings → Environment Variables.');
  return new FileStore();
}
