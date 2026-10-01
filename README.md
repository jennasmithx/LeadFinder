# Lead Finder

Finds businesses on Google Maps that **have no website** and **have a mobile/WhatsApp number**, then logs them to `leads.xlsx`.

```
Google Places API  →  filter (no website + WhatsApp number)  →  leads.xlsx
```

## Setup (one time)

1. Install [Node.js](https://nodejs.org) 22 or newer.
2. Get a Google Maps API key:
   - Go to https://console.cloud.google.com, create a project, and add billing. Google gives a monthly free allowance.
   - Under **APIs & Services → Library**, enable **Places API (New)**.
   - Under **APIs & Services → Credentials**, create an **API key**.
3. In this folder:
   ```bash
   npm install
   cp .env.example .env      # then paste your key into .env
   ```

## Use

```bash
npm run find -- --type "beauty salons" --location "Johannesburg" --limit 100
```

Several categories and suburbs at once:

```bash
npm run find -- -t "beauty salons,nail salons,gyms,barbers" -l "Sandton,Randburg,Rosebank,Soweto,Midrand" -n 200
```

Google returns at most **60 businesses per search**, so for 100+ leads list several suburbs.

Run it as often as you like. New leads are **added** to the same `leads.xlsx`, businesses already in the sheet are skipped, and your edits to the `Status` and `Notes` columns are kept.

### Options

| Flag | Meaning | Default |
|---|---|---|
| `-t, --type` | What to search for (comma-separated) | required |
| `-l, --location` | Where (comma-separated) | required |
| `-n, --limit` | Stop after this many new leads | 100 |
| `-o, --out` | Excel file | `leads.xlsx` |
| `-c, --country` | Country code for phone numbers | `ZA` |
| `--any-phone` | Keep landline numbers too | off |
| `--no-social` | Skip businesses whose only "website" is Facebook/Instagram/etc. | off |

## The spreadsheet

Columns: Business, Category, Phone, WhatsApp?, WhatsApp link (click to open a chat), Social page, Address, Rating, Reviews, Google Maps link, Search, Found on, Status, Notes, Place ID.

## How it decides

- **No website:** the Google listing has no website. A Facebook/Instagram/Linktree/wa.me link alone still counts as *no website*, since those are often the best prospects. The page is shown in the **Social page** column. Use `--no-social` to exclude them.
- **WhatsApp:** Google doesn't say whether a number is on WhatsApp, so:
  - `Confirmed`: the listing links to wa.me or whatsapp.com.
  - `Likely`: the number is a **mobile** number. In South Africa nearly all of these are on WhatsApp.
  - Landlines are skipped unless you pass `--any-phone`.
- Permanently or temporarily closed businesses are skipped.

## Cost

Each search page (up to 20 businesses) is one Places "Text Search" request. Phone and website fields are billed at Google's Enterprise rate. Check current pricing and your free monthly credit at https://developers.google.com/maps/billing-and-pricing/pricing. Set a budget alert in Google Cloud to be safe.

## Tests

```bash
npm test
```
