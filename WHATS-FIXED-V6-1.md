# TM Detailers V6.1 — Real website changes

- Unified regular and business booking confirmation: full-sized business confirmation, visible reference, copy with fallback, track-booking CTA, email state, another booking.
- Dedicated customer tracking page: step-by-step Request received → Confirmed → In progress → Completed; clear cancellation state; reference copy; visible address, price, date, location and customer notes; owner-customizable headline, status message, next steps and pickup estimate.
- Photo journal: customers can privately upload up to 4 before shots per booking; owners can add before AND after shots, edit photo captions and remove photos. Photos require authenticated owner or a verified customer reference+email for retrieval; no public media URLs.
- Owner Studio: new graphite pro interface in `public/studio/`, secure server login; direct "View & edit the customer tracker" action from booking records; owner-only editor on the exact customer tracking page; statuses include `in_progress`; full record updates, progress copy, photos, request decisions.
- Customer change requests: request history appears on tracker; owner reviews requests and can edit the appointment.
- Public homepage: business portal no longer competes with primary customer navigation; footer still offers business access.
- Existing V5 holiday theme capabilities, booking calendars, pricing pages and Cloudflare integration are preserved where possible.

Validation completed locally: 21 SQLite-backed API integration checks passed. Chromium rendering tests passed for customer tracking, owner's tracker mode and business confirmation, using simulated API responses. Cloudflare live deployment and real sender delivery still require verification on your own account.
