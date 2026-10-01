// Apify: runs the "Google Maps Scraper" (compass/crawler-google-places) and stores your leads.
// Free Apify accounts get monthly credit with no card: https://apify.com/pricing

const API = 'https://api.apify.com/v2';
const ACTOR = 'compass~crawler-google-places';
const FINISHED = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);

export const isFinished = (status) => FINISHED.has(status);

export function apifyFetch(fetchImpl, token, path, init = {}) {
  return fetchImpl(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
}

async function call(fetchImpl, token, path, init) {
  const res = await apifyFetch(fetchImpl, token, path, init);
  if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
  return res.json();
}

// Only places WITHOUT a website are fetched (Apify filters them for us), which keeps credit usage low.
export function buildInput(types, location, maxPerSearch) {
  return {
    searchStringsArray: types,
    locationQuery: location,
    maxCrawledPlacesPerSearch: maxPerSearch,
    website: 'withoutWebsite',
    language: 'en',
  };
}

export async function startRun({ token, input, fetchImpl = fetch }) {
  const { data } = await call(fetchImpl, token, `/acts/${ACTOR}/runs`, { method: 'POST', body: JSON.stringify(input) });
  return data;
}

export async function getRun({ token, id, fetchImpl = fetch }) {
  const { data } = await call(fetchImpl, token, `/actor-runs/${encodeURIComponent(id)}`);
  return data;
}

export function getItems({ token, datasetId, fetchImpl = fetch }) {
  return call(fetchImpl, token, `/datasets/${datasetId}/items?clean=true&format=json`);
}

// Converts an Apify result into the same shape the Google Places API returns,
// so the rest of the tool doesn't care where the data came from.
export function normalize(item) {
  let businessStatus = 'OPERATIONAL';
  if (item.permanentlyClosed) businessStatus = 'CLOSED_PERMANENTLY';
  else if (item.temporarilyClosed) businessStatus = 'CLOSED_TEMPORARILY';
  return {
    id: item.placeId,
    displayName: { text: item.title ?? '' },
    formattedAddress: item.address ?? '',
    nationalPhoneNumber: item.phone ?? undefined,
    internationalPhoneNumber: item.phoneUnformatted ?? undefined,
    websiteUri: item.website ?? undefined,
    googleMapsUri: item.url ?? '',
    rating: item.totalScore ?? undefined,
    userRatingCount: item.reviewsCount ?? 0,
    primaryTypeDisplayName: { text: item.categoryName ?? '' },
    businessStatus,
    searchString: item.searchString,
  };
}
