# Lead Finder

Finds businesses on Google Maps that have **no website** and a **WhatsApp number**, and saves them to `leads.xlsx` with a click-to-chat WhatsApp link for each one.

Pick a city and business types on a small website that runs on your own computer, click **Generate**, and get your leads.

## Setup (one time, about 10 minutes)

1. **Install Node.js** (version 22 or newer) from https://nodejs.org.
2. **Get a free Apify account. No card needed.**
   - Sign up at https://apify.com.
   - Go to **Settings → API & Integrations** (https://console.apify.com/settings/integrations) and copy your **API token**.
3. **Download this project**, open a terminal in its folder, and run:
   ```bash
   npm install
   ```
4. Make a copy of `.env.example` named `.env`. Open it and paste your token after `APIFY_TOKEN=`.

## Use it

```bash
npm start
```

Then open **http://localhost:3000** in your browser:

1. Pick a city: Johannesburg, Cape Town, Durban, Pretoria, or type any other place.
2. Pick business types (salons, gyms, barbers…) or type your own.
3. Choose how many leads you want, then click **Generate**.
4. Leads appear as they're found. Click a number to open a WhatsApp chat, or **Download Excel** for the spreadsheet.

Every run **adds** to the same `leads.xlsx`. Businesses already in it are skipped, so you never get duplicates. Your notes in the **Status** and **Notes** columns are kept.

Close the terminal (or press Ctrl+C) to stop it.

## What you get

| Column | |
|---|---|
| Business, Category, Address | From Google Maps |
| Phone | The business's mobile number |
| WhatsApp? | `Likely` = mobile number. `Confirmed` = the listing links to WhatsApp |
| WhatsApp link | `wa.me/…`: click to open a chat |
| Social page | Their Facebook/Instagram page, if that's all they have (Google source only) |
| Rating, Reviews, Google Maps | From Google Maps |
| Status, Notes | Empty, for you to track who you've contacted |

**How it decides:**
- **No website:** only businesses with no website on their Google listing are kept.
- **WhatsApp:** Google doesn't say whether a number is on WhatsApp, so the tool keeps **mobile numbers** (06x/07x/08x in South Africa, almost all on WhatsApp) and drops landlines. Tick **Include landlines** to keep those too.
- Closed businesses are skipped.

## Is it free?

Apify gives free accounts **$5 of credit every month**. This tool costs about **$0.005 per business found**, so the free credit covers roughly **1,000 businesses a month**. When the credit runs out, Apify stops; it can't charge you without a card. Check the current prices at https://apify.com/compass/crawler-google-places.

## Using Google instead (optional)

If you ever add a card to Google Cloud, put `GOOGLE_MAPS_API_KEY=` in `.env` instead (enable **Places API (New)**). Google gives 1,000 free searches a month, about 20,000 businesses. To make sure you're never charged, set the **requests per day** quota to 30 under *APIs & Services → Places API (New) → Quotas*. If both keys are set, Apify is used.

## Command line (optional)

```bash
npm run find -- --type "beauty salons,gyms" --location "Durban" --limit 100
```

Run `npm run find -- --help` for all options.

## Tests

```bash
npm test
```
