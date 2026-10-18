# TM Detailers | Luxury Automotive Website

A redesigned Cloudflare Pages website based on the existing TM Detailers HTML file.

**What's included**

- Luxury charcoal / steel-blue storefront, mobile navigation, smooth transitions and real TM logo.
- Editable hero, about text, Instagram username/link, contact details, services, prices, promotion banner, and seasonal palette.
- Gallery: owner can upload images, add HTTPS image links, edit captions, reorder images and remove photos. Uploaded images are stored in D1 as compressed JPEGs.
- Securely signed owner sessions and server-side owner password check (password stored as Cloudflare secret, not HTML).
- Business access codes with per-company vehicle rates. Optional custom codes (e.g. TM-BIZ976112), account disable and code rotation. Codes are hashed in the database and only displayed when created/rotated.
- Public appointment requests, max bookings/day, blocked dates and slot collision checks, reference lookup, owner view/status update.
- Mobile or drop-off requests. Mobile customers must supply an address.

**IMPORTANT:** The secure features only work once you finish the setup in `SETUP.md`. Until then, the site loads as a public preview, booking is disabled, and admin/business sign-ins cannot authenticate. Do not ask customers to book through an unconfigured demo.

## Folder layout

- `public/` — ONLY these files are published directly to visitors. Build output directory MUST be `public`.
- `functions/api/[[path]].js` — Cloudflare Pages Functions API (not served as a public static file).
- `database/schema.sql` — D1 database tables (run one time).
- `SETUP.md` — Cloudflare dashboard setup instructions.

## Notes about earlier HTML site

The original single-file website kept most information locally in the browser and included an unprotected login. This replaces that with server-backed appointment requests, owner controls and business account sessions. It does **not** include actual checkout, automatic email/text notifications, a synchronized Instagram feed, customer self-service rescheduling, or a full two-package checkout workflow. Existing pricing is set as defaults and editable in Studio. The business account interface changes rates and booking context, not every visual section of the site.

Do not place passwords, access tokens, or private booking data into HTML, GitHub or this archive. Test real bookings after configuring D1.
