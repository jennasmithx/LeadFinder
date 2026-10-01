// Google Places API (New) — Text Search.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'nextPageToken',
].join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Yields every place Google returns for a query, one page (max 20) at a time.
// Google caps a single text query at 60 results (3 pages).
export async function* searchPlaces(textQuery, { apiKey, regionCode, fetchImpl = fetch } = {}) {
  let pageToken;
  do {
    const body = { textQuery, pageSize: 20 };
    if (regionCode) body.regionCode = regionCode;
    if (pageToken) body.pageToken = pageToken;

    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELDS,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Places API ${res.status}: ${text}`);
    }

    const data = await res.json();
    yield data.places ?? [];
    pageToken = data.nextPageToken;
    if (pageToken) await sleep(500);
  } while (pageToken);
}
