#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { searchPlaces } from './places.js';
import { toLead, rejectReason } from './leads.js';
import { existingPlaceIds, appendLeads } from './sheet.js';

const HELP = `
Find businesses with no website (and a WhatsApp-able number) and log them to Excel.

Usage:
  npm run find -- --type "beauty salons" --location "Johannesburg" --limit 100

Options:
  -t, --type       What to search for. Comma-separate for several: "beauty salons,gyms,barbers"
  -l, --location   Where. Comma-separate suburbs to get more results: "Sandton,Randburg,Soweto"
  -n, --limit      Stop after this many NEW leads (default 100)
  -o, --out        Excel file to write/append to (default leads.xlsx)
  -c, --country    Country code for phone numbers & search bias (default ZA)
      --any-phone  Keep landlines too (default: only mobile/WhatsApp numbers)
      --no-social  Skip businesses whose only "website" is Facebook/Instagram/etc.
  -h, --help

Requires GOOGLE_MAPS_API_KEY in the environment or a .env file.
Google returns at most 60 places per search, so for 100+ leads list several suburbs.
`;

const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

async function main() {
  const { values } = parseArgs({
    options: {
      type: { type: 'string', short: 't' },
      location: { type: 'string', short: 'l' },
      limit: { type: 'string', short: 'n', default: '100' },
      out: { type: 'string', short: 'o', default: 'leads.xlsx' },
      country: { type: 'string', short: 'c', default: 'ZA' },
      'any-phone': { type: 'boolean', default: false },
      'no-social': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || !values.type || !values.location) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  try {
    process.loadEnvFile();
  } catch {
    // no .env file — fine if the key is already in the environment
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Missing GOOGLE_MAPS_API_KEY. Copy .env.example to .env and paste your key in.');
    process.exit(1);
  }

  const limit = Number(values.limit);
  const country = values.country.toUpperCase();
  const opts = {
    includeSocial: !values['no-social'],
    requireWhatsapp: !values['any-phone'],
    defaultCountry: country,
  };

  const seen = await existingPlaceIds(values.out);
  const alreadyInSheet = seen.size;
  const leads = [];
  const skipped = {};
  let scanned = 0;

  outer: for (const type of split(values.type)) {
    for (const location of split(values.location)) {
      const search = `${type} in ${location}`;
      console.log(`Searching: ${search}`);
      for await (const page of searchPlaces(search, { apiKey, regionCode: country })) {
        for (const place of page) {
          scanned++;
          if (seen.has(place.id)) {
            skipped['already found'] = (skipped['already found'] ?? 0) + 1;
            continue;
          }
          seen.add(place.id);
          const reason = rejectReason(place, opts);
          if (reason) {
            skipped[reason] = (skipped[reason] ?? 0) + 1;
            continue;
          }
          const lead = toLead(place, { search, defaultCountry: country });
          leads.push(lead);
          console.log(`  + ${lead.name}  ${lead.phone}  (WhatsApp: ${lead.whatsapp})`);
          if (leads.length >= limit) break outer;
        }
      }
    }
  }

  if (leads.length) await appendLeads(values.out, leads);

  console.log(`\nScanned ${scanned} businesses, added ${leads.length} new leads to ${values.out}` +
    (alreadyInSheet ? ` (sheet already had ${alreadyInSheet}).` : '.'));
  for (const [reason, n] of Object.entries(skipped)) console.log(`  skipped ${n}: ${reason}`);
  if (leads.length < limit) {
    console.log(`\nFound fewer than ${limit}. Add more suburbs to --location or more types to --type.`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
