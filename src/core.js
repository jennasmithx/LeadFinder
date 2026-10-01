import { CITIES } from './cities.js';
import * as apify from './apify.js';
import { searchPlaces } from './places.js';
import { toLead, rejectReason } from './leads.js';

export const STATUSES = ['New', 'Messaged', 'Replied', 'Interested', 'Not interested'];
const MAX_JOBS = 20;

export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Apify is preferred (no card needed); Google is used if that's the only key present.
export function pickSource(env = process.env) {
  if (env.APIFY_TOKEN) return 'apify';
  if (env.GOOGLE_MAPS_API_KEY) return 'google';
  return null;
}

const norm = (s) => String(s).toLowerCase().trim();

// Picks the next suburb to search, so each Generate covers new ground.
// After every suburb has been searched once, it digs deeper into each one.
export async function planSearch(store, { location, types, limit }) {
  const city = Object.keys(CITIES).find((c) => norm(c) === norm(location));
  const areas = city ? CITIES[city] : [location];
  const rotation = await store.get('rotation', {});
  const key = `${norm(location)}|${types.map(norm).sort().join(',')}`;
  const n = rotation[key] ?? 0;
  rotation[key] = n + 1;
  await store.set('rotation', rotation);

  const area = areas[n % areas.length];
  const round = Math.floor(n / areas.length);
  return {
    area: city ? `${area}, ${city}` : area,
    query: city ? `${area}, ${city}, South Africa` : location,
    // ~1.5x the target, since some results get dropped (landlines, low ratings).
    maxPerSearch: Math.ceil((limit * 1.5) / types.length) * (round + 1),
  };
}

// Filters places and adds the good ones to the saved leads. Skips businesses already saved.
export async function addPlaces(store, places, { area, filters }) {
  const leads = await store.get('leads', []);
  const seen = new Set(leads.map((l) => l.placeId));
  const added = [];
  const skipped = {};
  for (const place of places) {
    const reason = !place.id ? 'no place id' : seen.has(place.id) ? 'already in your list' : rejectReason(place, filters);
    if (reason) {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
      continue;
    }
    seen.add(place.id);
    const search = place.searchString ? `${place.searchString} in ${area}` : area;
    added.push(toLead(place, { search, defaultCountry: filters.defaultCountry }));
  }
  if (added.length) await store.set('leads', [...leads, ...added]);
  return { added: added.length, addedIds: added.map((l) => l.placeId), skipped, scanned: places.length };
}

function parseRequest(body) {
  const types = [...(body.types ?? []), ...String(body.customType ?? '').split(',')]
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 10);
  const location = String(body.location ?? '').trim();
  if (!types.length || !location) throw new UserError('Pick a city and at least one business type.');
  return {
    types,
    location,
    limit: Math.min(Math.max(Number(body.limit) || 30, 1), 300),
    filters: {
      requireWhatsapp: !body.includeLandlines,
      minRating: Number(body.minRating) || 0,
      minReviews: Number(body.minReviews) || 0,
      defaultCountry: 'ZA',
    },
  };
}

// Starts a search. Google finishes straight away; Apify returns a job id to check with checkJob.
export async function startGenerate({ env, store, fetchImpl = fetch }, body) {
  const { types, location, limit, filters } = parseRequest(body);
  const source = pickSource(env);
  if (!source) throw new UserError('No API key found. Set APIFY_TOKEN (see README).', 500);
  const plan = await planSearch(store, { location, types, limit });

  if (source === 'google') {
    const places = [];
    for (const type of types) {
      for await (const page of searchPlaces(`${type} in ${plan.query}`, { apiKey: env.GOOGLE_MAPS_API_KEY, regionCode: 'ZA', fetchImpl })) {
        places.push(...page.map((p) => ({ ...p, searchString: type })));
      }
    }
    return { done: true, area: plan.area, ...(await addPlaces(store, places, { area: plan.area, filters })) };
  }

  const input = apify.buildInput(types, plan.query, plan.maxPerSearch);
  const run = await apify.startRun({ token: env.APIFY_TOKEN, input, fetchImpl });
  const jobs = await store.get('jobs', {});
  jobs[run.id] = { area: plan.area, filters, startedAt: Date.now() };
  const ids = Object.keys(jobs).sort((a, b) => jobs[a].startedAt - jobs[b].startedAt);
  for (const old of ids.slice(0, Math.max(0, ids.length - MAX_JOBS))) delete jobs[old];
  await store.set('jobs', jobs);
  return { done: false, jobId: run.id, area: plan.area };
}

// Checks an Apify search. When it has finished, saves the new leads (only once per job).
export async function checkJob({ env, store, fetchImpl = fetch }, id) {
  const jobs = await store.get('jobs', {});
  const job = jobs[id];
  if (!job) throw new UserError('That search was not found. Try Generate again.', 404);
  if (job.result) return { done: true, area: job.area, ...job.result };

  const run = await apify.getRun({ token: env.APIFY_TOKEN, id, fetchImpl });
  if (!apify.isFinished(run.status)) return { done: false, area: job.area, status: run.status };

  if (run.status !== 'SUCCEEDED') {
    job.result = { error: `The search ${run.status.toLowerCase()} on Apify. Check your Apify credit, then try again.` };
  } else {
    const items = await apify.getItems({ token: env.APIFY_TOKEN, datasetId: run.defaultDatasetId, fetchImpl });
    job.result = await addPlaces(store, items.map(apify.normalize), job);
  }
  const latest = await store.get('jobs', {});
  latest[id] = job;
  await store.set('jobs', latest);
  return { done: true, area: job.area, ...job.result };
}

// Status and notes are kept in their own record ("marks"), so a search finishing at the
// same moment as you change a status can't overwrite either one.
export async function listLeads(store) {
  const [leads, marks] = await Promise.all([store.get('leads', []), store.get('marks', {})]);
  return leads.map((l) => ({ ...l, status: 'New', notes: '', ...marks[l.placeId] }));
}

export async function updateLead(store, { placeId, status, notes }) {
  const leads = await store.get('leads', []);
  if (!leads.some((l) => l.placeId === placeId)) throw new UserError('Lead not found.', 404);
  const marks = await store.get('marks', {});
  const mark = { ...marks[placeId] };
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw new UserError('Unknown status.');
    mark.status = status;
  }
  if (notes !== undefined) mark.notes = String(notes).slice(0, 1000);
  marks[placeId] = mark;
  await store.set('marks', marks);
  return { placeId, ...mark };
}
