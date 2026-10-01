import crypto from 'node:crypto';
import { createStore } from './store.js';
import { buildWorkbook } from './sheet.js';
import { CITIES, BUSINESS_TYPES } from './cities.js';
import {
  STATUSES, UserError, pickSource, startGenerate, checkJob, updateLead, listLeads,
  getSettings, saveSettings, whatsappLinkWithMessage,
} from './core.js';

// Shared by the Vercel functions in /api and the local server (src/server.js).
const routes = {
  config: {
    method: 'GET',
    public: true,
    run: ({ env }) => ({
      source: pickSource(env),
      needsPassword: Boolean(env.APP_PASSWORD),
      cities: Object.keys(CITIES),
      types: BUSINESS_TYPES,
      statuses: STATUSES,
    }),
  },
  leads: { method: 'GET', run: async ({ store }) => ({ leads: await listLeads(store) }) },
  generate: { method: 'POST', run: (ctx, { body }) => startGenerate(ctx, body) },
  job: { method: 'GET', run: (ctx, { query }) => checkJob(ctx, query.id) },
  lead: { method: 'POST', run: ({ store }, { body }) => updateLead(store, body) },
  settings: { method: 'GET', run: ({ store }) => getSettings(store) },
  'save-settings': { method: 'POST', run: ({ store }, { body }) => saveSettings(store, body) },
  export: {
    method: 'GET',
    run: async ({ store }) => {
      const [leads, { message }] = await Promise.all([listLeads(store), getSettings(store)]);
      const withMessage = leads.map((l) => ({ ...l, whatsappLink: whatsappLinkWithMessage(l, message) }));
      return { file: await buildWorkbook(withMessage) };
    },
  },
};

function passwordOk(env, given) {
  if (!env.APP_PASSWORD) {
    if (env.VERCEL) throw new UserError('Set APP_PASSWORD in Vercel → Settings → Environment Variables, then redeploy.', 500);
    return true; // running on your own computer
  }
  const a = crypto.createHash('sha256').update(String(given ?? '')).digest();
  const b = crypto.createHash('sha256').update(env.APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

async function readJson(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  let data = '';
  for await (const chunk of req) data += chunk;
  return JSON.parse(data || '{}');
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function handle(req, res, name, { env = process.env, fetchImpl = fetch } = {}) {
  try {
    const route = routes[name];
    if (!route) return send(res, 404, { error: 'Not found' });
    if (req.method !== route.method) return send(res, 405, { error: 'Method not allowed' });
    if (!route.public && !passwordOk(env, req.headers['x-app-password'])) {
      return send(res, 401, { error: 'Wrong password' });
    }
    const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
    const body = req.method === 'POST' ? await readJson(req) : {};
    const ctx = { env, fetchImpl, store: route.public ? null : createStore(env, fetchImpl) };
    const result = await route.run(ctx, { query, body });

    if (result.file) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="leads.xlsx"');
      return res.end(result.file);
    }
    send(res, 200, result);
  } catch (err) {
    send(res, err.status ?? 500, { error: err.message });
  }
}

// Wraps a route as a Vercel serverless function.
export const vercel = (name) => (req, res) => handle(req, res, name);
