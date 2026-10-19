# Fangviper order tracking: setup

How it works: Shopify tells the backend about every order. 24 hours later the backend sends the
"Your order is being made" email from contact@fangviper.com with a link to track.fangviper.com.
The page shows one scene per day and switches to "On its way" + tracking when Shopify marks the
order fulfilled. Printful's API is not needed: Printful already pushes tracking into Shopify.

Nothing here changes products, prices or orders in Shopify. The backend only receives order data.

| Piece | Where it runs | Cost |
|---|---|---|
| Tracking page (`public/`) | GitHub Pages at track.fangviper.com | free |
| Backend (`src/`) | Cloudflare Worker (workers.dev address, customers never see it) | free plan |
| Order storage | Cloudflare D1 database | free plan |
| Email sending | Resend | free up to 3,000 emails a month (100 a day) |

## You do (accounts and keys, about 20 minutes)

1. **Cloudflare**: create a free account at dash.cloudflare.com. No need to move your DNS.
2. **Resend**: create a free account at resend.com.
   - Domains > Add domain > `fangviper.com`.
   - Resend shows 3 or 4 DNS records (on `send.fangviper.com` and `resend._domainkey`).
     Add them at Spaceship. They don't touch your existing Shopify email, MX or DMARC records.
   - Wait until the domain shows **Verified**.
   - API Keys > Create, with **Sending access** only. Keep it for step 4.
3. **Log in and deploy** (in the `fangviper-track` folder; Claude can run 3a to 3c for you):
   ```
   npx wrangler login
   npx wrangler d1 create fangviper-track      (copy the database_id into wrangler.jsonc)
   npm run db:remote
   npx wrangler deploy                          (prints the address, like https://fangviper-track.<name>.workers.dev)
   ```
4. **Secrets**: type these yourself so the keys never pass through chat:
   ```
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put SHOPIFY_WEBHOOK_SECRET
   ```
   (the second value comes from step 5)
5. **Shopify webhooks**: Settings > Notifications > Webhooks > Create webhook, 4 times.
   Format **JSON**, URL `https://<your workers.dev address>/webhooks/shopify`, latest API version:
   - Order creation
   - Order cancellation
   - Fulfillment creation
   - Fulfillment update

   Under the list Shopify shows "Your webhooks will be signed with ...". That value is
   `SHOPIFY_WEBHOOK_SECRET`.
6. **DNS for the page**: at Spaceship add CNAME `track` -> `thepetbitllc-sketch.github.io`
   (same as `links` and `size`).

## Claude does

- Puts the `database_id` and the workers.dev address in place (`wrangler.jsonc`, the
  `api-base` tag in `public/index.html`).
- Creates the GitHub repo and turns on Pages for track.fangviper.com, with HTTPS.
- Test with a real order: place a test order, check that the page link works, and send the email.

## Day-to-day

- Email delay: `EMAIL_DELAY_HOURS` in `wrangler.jsonc` (24). Orders older than 7 days, shipped
  or canceled orders, and orders without an email never get the email.
- Failed sends retry every hour. See them with:
  `npx wrangler d1 execute fangviper-track --remote --command "SELECT number, email_error FROM orders WHERE email_error IS NOT NULL"`
- Live logs: `npx wrangler tail`

## Local testing

`npm run db:local`, then `npx wrangler dev`. `.dev.vars` (not committed) holds
`DEV=1`, `SHOPIFY_WEBHOOK_SECRET=local-test-secret`, `SITE_URL=http://localhost:8787`.
Dev-only routes: `/dev/email?t=<token>` (email preview), `/dev/send-due?delay=<hours>` (run the email job).
Without `RESEND_API_KEY`, the job only reports what it would send.
