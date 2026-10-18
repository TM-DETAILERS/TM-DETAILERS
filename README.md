# TM Detailers — Essentials V3

A simpler, multi-page redesign of your existing Cloudflare Pages website. This is an **upgrade**, not a replacement Cloudflare account.

## Where things are

- `/` — simplified homepage with holiday greeting, prominent booking button, three quick links and a short introduction.
- `/pricing/` — separate services and full-detail vehicle pricing page.
- `/checkout/` — four-step booking checkout: vehicle → date/location → contact → review. An estimated price is visible throughout. After successful submission, a real booking reference is returned by the existing `/api/bookings` backend.
- `/track/` — look up a booking by reference plus email, see status and request a change.
- `/business/` — existing secure business client pricing and appointment requests.
- `/studio/` — separate Owner Studio sign-in and existing management dashboard, including holiday settings.

## Seasonal design

Eid, Christmas, Halloween, Thanksgiving and New Year include distinct greetings, artwork motifs, backgrounds and colours. Owner Studio → Seasonal Studio lets you edit the greeting, campaign headline, description, highlight colours, photo and vehicle-specific seasonal prices. Saved prices are used by the **same booking backend** that generates the receipt.

Owner Studio continues to support business accounts, bookings, pricing, service descriptions and photo gallery management.

## Booking vs payment

The checkout is a **booking-request checkout**, not an online card payment checkout. It collects no card details and charges no money. Only after the server records an appointment request does it display a booking reference. Final appointment confirmation and payment are arranged directly with TM Detailers. No Stripe/Square integration has been configured.

## No new database / domain setup

Continue using your existing Cloudflare Pages project, D1 binding `DB`, secrets `ADMIN_PASSWORD` and `SESSION_SECRET`, and `tmdetailers.ca` DNS records. Do not recreate any of them.

**Read `UPGRADE-V3.md` before pushing.** Prefer a separate GitHub review branch to inspect the updated site before replacing the current live homepage.

## Privacy

Never put owner passwords, secret keys or customer information in public files or GitHub. Photos used in the homepage gallery come from your Owner Studio; the vehicle drawing is a generic illustration and **not presented as actual customer work**.
