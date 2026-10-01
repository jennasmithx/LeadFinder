#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { findLeads, loadEnv } from './finder.js';

const HELP = `
Find businesses with no website (and a WhatsApp-able number) and log them to Excel.
Prefer clicking? Run "npm start" and open http://localhost:3000 instead.

Usage:
  npm run find -- --type "beauty salons" --location "Johannesburg" --limit 100

Options:
  -t, --type       What to search for. Comma-separate for several: "beauty salons,gyms,barbers"
  -l, --location   Where. Johannesburg / Cape Town / Durban / Pretoria, or any place name.
                   Comma-separate for several.
  -n, --limit      Stop after this many NEW leads (default 100)
  -o, --out        Excel file to write/append to (default leads.xlsx)
  -c, --country    Country code for phone numbers (default ZA)
      --any-phone  Keep landlines too (default: only mobile/WhatsApp numbers)
      --no-social  Skip businesses whose only "website" is Facebook/Instagram/etc. (Google only)
  -h, --help

Needs APIFY_TOKEN (free, no card) or GOOGLE_MAPS_API_KEY in a .env file. See README.
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
  loadEnv();

  const limit = Number(values.limit);
  const events = findLeads({
    types: split(values.type),
    locations: split(values.location),
    limit,
    out: values.out,
    country: values.country.toUpperCase(),
    includeSocial: !values['no-social'],
    requireWhatsapp: !values['any-phone'],
  });

  for await (const e of events) {
    if (e.type === 'searching') console.log(`Searching (${e.source}): ${e.search}`);
    if (e.type === 'lead') console.log(`  + ${e.lead.name}  ${e.lead.phone}  ${e.lead.whatsappLink}`);
    if (e.type === 'done') {
      console.log(`\nScanned ${e.scanned} businesses, added ${e.added} new leads to ${e.file}.`);
      for (const [reason, n] of Object.entries(e.skipped)) console.log(`  skipped ${n}: ${reason}`);
      if (e.added < limit) console.log(`\nFound fewer than ${limit}. Try more business types or another city.`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
