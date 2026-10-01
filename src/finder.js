import { searchPlaces } from './places.js';
import { searchApify } from './apify.js';
import { CITIES } from './cities.js';
import { toLead, rejectReason } from './leads.js';
import { existingPlaceIds, appendLeads } from './sheet.js';

export function loadEnv() {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file — fine if keys are already in the environment
  }
}

// Apify is preferred (no card needed); Google is used if that's the only key present.
export function pickSource(env = process.env) {
  if (env.APIFY_TOKEN) return 'apify';
  if (env.GOOGLE_MAPS_API_KEY) return 'google';
  return null;
}

// Yields the pages of places to look through, from whichever source is configured.
async function* scan({ source, types, locations, country, limit, env, fetchImpl }) {
  if (source === 'apify') {
    // Apify only returns places without a website; ~1.5x covers ones dropped for landlines.
    const maxPerSearch = Math.ceil((limit * 1.5) / types.length);
    for (const location of locations) {
      const city = CITIES[location] ? `${location}, South Africa` : location;
      yield { search: `${types.join(', ')} in ${location}` };
      yield* searchApify({ types, location: city, maxPerSearch, token: env.APIFY_TOKEN, fetchImpl });
    }
    return;
  }
  for (const type of types) {
    for (const location of locations.flatMap((l) => CITIES[l] ?? [l])) {
      yield { search: `${type} in ${location}` };
      yield* searchPlaces(`${type} in ${location}`, { apiKey: env.GOOGLE_MAPS_API_KEY, regionCode: country, fetchImpl });
    }
  }
}

// Finds leads and appends them to the Excel file. Yields progress events:
//   { type: 'searching', search } | { type: 'lead', lead } | { type: 'done', scanned, added, skipped, file }
export async function* findLeads({
  types,
  locations,
  limit = 100,
  out = 'leads.xlsx',
  country = 'ZA',
  includeSocial = true,
  requireWhatsapp = true,
  env = process.env,
  fetchImpl = fetch,
}) {
  const source = pickSource(env);
  if (!source) throw new Error('No API key found. Put APIFY_TOKEN (or GOOGLE_MAPS_API_KEY) in your .env file.');

  const opts = { includeSocial, requireWhatsapp, defaultCountry: country };
  const seen = await existingPlaceIds(out);
  const leads = [];
  const skipped = {};
  const skip = (reason) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  let scanned = 0;
  let search = '';

  outer: for await (const page of scan({ source, types, locations, country, limit, env, fetchImpl })) {
    if (!Array.isArray(page)) {
      search = page.search;
      yield { type: 'searching', search, source };
      continue;
    }
    for (const place of page) {
      scanned++;
      if (!place.id || seen.has(place.id)) {
        skip('already in your sheet');
        continue;
      }
      seen.add(place.id);
      const reason = rejectReason(place, opts);
      if (reason) {
        skip(reason);
        continue;
      }
      const lead = toLead(place, { search: place.searchString ? `${place.searchString} (${search.split(' in ').pop()})` : search, defaultCountry: country });
      leads.push(lead);
      yield { type: 'lead', lead };
      if (leads.length >= limit) break outer;
    }
  }

  if (leads.length) await appendLeads(out, leads);
  yield { type: 'done', scanned, added: leads.length, skipped, file: out, source };
}
