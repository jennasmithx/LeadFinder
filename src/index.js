#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { loadEnv } from './env.js';
import { createStore } from './store.js';
import { buildWorkbook } from './sheet.js';
import { startGenerate, checkJob, listLeads } from './core.js';

const HELP = `
Find businesses with no website and a WhatsApp number. Prefer clicking? Run "npm start".

Usage:
  npm run find -- --type "beauty salons,gyms" --location "Johannesburg" --limit 30

Options:
  -t, --type         What to search for (comma-separated)
  -l, --location     Johannesburg / Cape Town / Durban / Pretoria (searches the next suburb each run),
                     or any place name
  -n, --limit        Roughly how many leads to aim for (default 30)
  -o, --out          Excel file with ALL your saved leads (default leads.xlsx)
      --min-rating   Only businesses rated at least this (e.g. 4)
      --min-reviews  Only businesses with at least this many reviews
      --any-phone    Keep landlines too
  -h, --help
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { values } = parseArgs({
    options: {
      type: { type: 'string', short: 't' },
      location: { type: 'string', short: 'l' },
      limit: { type: 'string', short: 'n', default: '30' },
      out: { type: 'string', short: 'o', default: 'leads.xlsx' },
      'min-rating': { type: 'string', default: '0' },
      'min-reviews': { type: 'string', default: '0' },
      'any-phone': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values.type || !values.location) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }
  loadEnv();
  const ctx = { env: process.env, store: createStore(process.env), fetchImpl: fetch };

  let result = await startGenerate(ctx, {
    types: values.type.split(','),
    location: values.location,
    limit: values.limit,
    minRating: values['min-rating'],
    minReviews: values['min-reviews'],
    includeLandlines: values['any-phone'],
  });
  console.log(`Searching ${result.area}…`);
  const { jobId } = result;
  while (!result.done) {
    await sleep(10_000);
    result = await checkJob(ctx, jobId);
    if (!result.done) console.log(`  still searching (${result.status.toLowerCase()})…`);
  }
  if (result.error) throw new Error(result.error);

  console.log(`\nChecked ${result.scanned} businesses, added ${result.added} new leads.`);
  for (const [reason, n] of Object.entries(result.skipped)) console.log(`  skipped ${n}: ${reason}`);
  const leads = await listLeads(ctx.store);
  fs.writeFileSync(values.out, await buildWorkbook(leads));
  console.log(`Saved all ${leads.length} leads to ${values.out}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
