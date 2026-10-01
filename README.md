# Lead Finder

Finds businesses on Google Maps with **no website** and a **WhatsApp number**. Pick a city and business types, tap **Generate**, and message them straight from your phone.

- Searches **anywhere in South Africa**: pick all of SA, one of the 9 provinces, a town in it (Johannesburg, Polokwane, Gqeberha…), or type any place.
- **Every Generate searches the next area** (Sandton, then Randburg… or Polokwane, then Tzaneen…), so you get new businesses each time and never duplicates. Areas already searched are searched deeper next time.
- Filters: minimum star rating, minimum number of reviews, landlines on or off.
- Each lead has a **WhatsApp button**, a Google Maps link, a **status** (New → Messaged → Replied → Interested / Not interested) and **notes**.
- **Your WhatsApp message:** write it once with `{business}` where the name goes. Every WhatsApp button then opens the chat with it already typed, e.g. *"Hi Glow Nails, I came across your business…"*.
- **Download Excel** whenever you want a spreadsheet of everything (its WhatsApp links include your message too).
- Password protected.

## Put it online with Vercel (works on your phone)

You need a free **Apify** account (for the business data) and a free **Vercel** account (for the website). Neither needs a card.

1. **Apify token:** sign up at https://apify.com, then open https://console.apify.com/settings/integrations and copy your **Personal API token**.
2. **Vercel:** go to https://vercel.com, tap **Sign Up**, and choose **Continue with GitHub**.
3. Tap **Add New… → Project** and **Import** the `testing` repository.
4. Open **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `APIFY_TOKEN` | your Apify token |
   | `APP_PASSWORD` | a password you make up |
5. Tap **Deploy**. When it's done, open your link (like `https://testing-abc.vercel.app`) and enter your password.
6. Optional: in your phone's browser menu, choose **Add to Home Screen**.

Changed a variable later? Go to **Deployments → ⋯ → Redeploy** so it takes effect.

## Or run it on your own computer

1. Install Node.js 20+ from https://nodejs.org.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and paste your `APIFY_TOKEN` in.
4. Run `npm start` and open http://localhost:3000.

The computer and Vercel versions share the same saved leads (they're stored in your Apify account), so you can use either one.

## How it decides

- **No website:** only businesses with no website on their Google listing.
- **WhatsApp:** Google doesn't say whether a number is on WhatsApp, so it keeps **mobile numbers** (06x/07x/08x, nearly all on WhatsApp) and skips landlines. Tap the WhatsApp button; if a number isn't on WhatsApp, WhatsApp tells you right away.
- Closed businesses are skipped.

## Cost

Apify's free plan gives **$5 of credit every month**, and it resets monthly. Business data costs about **$0.005 per business**, so that's roughly **1,000 businesses a month**. If the credit runs out, searches stop until next month; with no card, nothing can be charged. Current prices: https://apify.com/compass/crawler-google-places

Tip: each search costs about the same whether you ask for 10 or 50 leads, so asking for 30–50 at a time and working through them is the best use of your credit.

## Where your data lives

Leads, statuses and notes are saved in a storage area called **lead-finder** in your Apify account (Apify → **Storage → Key-value stores**). Searches started from the website appear under Apify → **Runs**.

## Command line (optional)

```bash
npm run find -- --type "beauty salons,gyms" --location "Durban" --limit 30
```

It saves all your leads to `leads.xlsx`. Run `npm run find -- --help` for options.

## Using Google instead of Apify (optional)

Set `GOOGLE_MAPS_API_KEY` instead of `APIFY_TOKEN` (needs a card on Google Cloud; enable **Places API (New)**; 1,000 free searches a month). This only works on your own computer, because the Vercel version saves leads in Apify.

## Tests

```bash
npm test
```
