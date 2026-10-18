# Upgrade TM Detailers from Atelier V2 to Essentials V3

Your Cloudflare domain, D1 database and secrets should remain unchanged. **Do not redo the three-hour setup.**

1. Check the separate **visual previews** first. They run locally and are not connected to your customers or Cloudflare database. The checkout preview returns a clearly marked **demo** booking reference only.
2. Keep a backup of your existing repository. In GitHub Desktop, choose `TM-DETAILERS` and create a new branch named `essentials-v3-review` if you want a safer preview deployment.
3. Open GitHub Desktop → **Show in Finder**. Copy the *contents* of this upgrade folder into the root of your cloned TM-DETAILERS repository, preserving folders `public`, `functions`, and `database`. Replace matching files. Do **not** remove the existing root-level `index.html` or `CNAME`.
4. GitHub Desktop should show updated `public/index.html`, `public/assets/essentials.css`, `public/assets/essentials.js`, `public/checkout/index.html`, `public/assets/checkout.js`, `public/pricing/index.html`, `public/studio/index.html`, `public/assets/defaults.js`, and `functions/api/[[path]].js`, along with other updated files.
5. Commit and push. Cloudflare Pages auto-deploys from GitHub. Your build output directory remains `public`. For a review branch, use its temporary Pages preview URL; ensure testing backends have properly configured preview bindings if needed.
6. Inspect `/`, `/pricing/`, `/checkout/`, `/business/`, `/track/` and `/studio/`. In Owner Studio, update and save one holiday greeting or price, then reload your site to verify it appears everywhere and in the booking estimate.
7. Only when you're satisfied with the review should you merge to `main`. Until then, your current production website remains unchanged.

## Important tests before taking bookings

- Test owner sign-in; `ADMIN_PASSWORD` remains in Cloudflare secrets.
- Test one **dummy** appointment on the deployed environment and confirm you receive a reference code. Look it up via `/track/`, then check it in Owner Studio. Remove/cancel the test appointment via the dashboard as appropriate.
- Confirm mobile requests require an address and have water/electricity access.
- Test the business portal with a non-customer test code and confirm a fresh page load requires signing in again.
- Confirm seasonal pricing shown at checkout matches the server's stored quote.

## Known limitations

- This is **not** a live payments checkout; no bank-card collection or automatic charge exists. Do not advertise online card payment.
- Requests to change or cancel are sent for owner review, not automatically approved.
- Photos can be edited in Owner Studio, but there isn't a full visual drag-and-drop page builder.
- The old long-form storefront is no longer the public homepage; its content markup remains inside `/studio/` to preserve compatibility with the existing owner-dashboard JavaScript, but is hidden behind the owner sign-in screen.
- Built-in browser-based visual screenshot testing was unavailable in this environment. Review the visual previews and the branch preview before deploying publicly.

No new D1 SQL migration is required. One optional new field, `themeProfiles[theme].greeting`, is stored in the same existing `site_settings` JSON column and is accepted by the updated Pages Function.
