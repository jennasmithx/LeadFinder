// Apify "Google Maps Scraper" (compass/crawler-google-places).
// Free Apify accounts get monthly credit with no card: https://apify.com/pricing
// Pricing for this actor: https://apify.com/compass/crawler-google-places

const API = 'https://api.apify.com/v2';
const ACTOR = 'compass~crawler-google-places';
const DONE = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);

async function call(fetchImpl, token, path, init = {}) {
  const res = await fetchImpl(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
  return res.json();
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

// Runs one scrape for several search terms in one location and yields the results.
// Only places WITHOUT a website are fetched (Apify filters them for us), which keeps credit usage low.
export async function* searchApify({ types, location, maxPerSearch, token, fetchImpl = fetch, pollSecs = 60 }) {
  const input = {
    searchStringsArray: types,
    locationQuery: location,
    maxCrawledPlacesPerSearch: maxPerSearch,
    website: 'withoutWebsite',
    language: 'en',
  };
  let { data: run } = await call(fetchImpl, token, `/acts/${ACTOR}/runs?waitForFinish=${pollSecs}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  while (!DONE.has(run.status)) {
    ({ data: run } = await call(fetchImpl, token, `/actor-runs/${run.id}?waitForFinish=${pollSecs}`));
  }
  if (run.status !== 'SUCCEEDED') throw new Error(`Apify run ${run.status.toLowerCase()} (run id ${run.id})`);

  const items = await call(fetchImpl, token, `/datasets/${run.defaultDatasetId}/items?clean=true&format=json`);
  yield items.map(normalize);
}
