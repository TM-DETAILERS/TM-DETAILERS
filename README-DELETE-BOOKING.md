# TM Detailers — Delete Booking update

This update adds an owner-only **Delete** button to each booking in Owner Studio → Bookings.

## How it works

1. In Owner Studio, open Bookings.
2. Choose Delete on the correct booking.
3. Confirm the customer and reference shown in the dialog.
4. Type the full booking reference, then choose Delete permanently.
5. The booking is removed from the active D1 `bookings` table and disappears from the dashboard. A customer can no longer look it up by reference.

The server verifies the signed owner session and requires a matching booking ID and full reference code. Other bookings are not modified. This operation cannot be undone from Owner Studio. Cloudflare may retain database backups for a limited period; plan your business record-retention requirements before deleting real customer data.

## Installation — small update (recommended when V3 already installed)

Replace only these two files in your GitHub Desktop repository:

- `public/assets/app.js`
- `functions/api/[[path]].js`

Do not copy files to the repository root. Keep the directory structure. Then in GitHub Desktop commit and push. Cloudflare Pages will redeploy automatically. No Cloudflare database, variables, DNS or domain changes are needed.

If your current website is **not** TM Detailers V3 yet, deploy the complete V3 package with this feature instead.

## Testing

Before deleting any real customer booking, create a test booking and verify the owner-only workflow end to end. Keep any booking information you need for customer service, accounting, or other record-retention obligations.
