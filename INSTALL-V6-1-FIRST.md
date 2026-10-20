# TM DETAILERS — INSTALL THIS ONE UPDATE (V6.1)

**This is the complete website source, NOT a standalone local HTML preview.** The ZIP's top level contains `public/`, `functions/`, `database/`. It includes the new real Owner Studio, customer website, business portal, Cloudflare Pages Functions API and photo-tracker migration. It does not deploy itself.

## FIRST — BACK UP

1. In GitHub Desktop, open your existing `TM-DETAILERS` repository and copy the whole repository folder to a safe backup location. Do NOT post passwords, database exports, or API secrets in GitHub.
2. Confirm your **Cloudflare D1** `tm-detailers-db` already has the V4 migration from `database/MIGRATE-V4.sql`. If it hasn't, you must run that migration once first. This update assumes V4 is working. Never repeat `ALTER TABLE` statements if the columns already exist.
3. Back up the D1 database using Cloudflare's database backup/export controls if available before changing schema.

## SECOND — RUN THREE PHOTOS/TRACKER MIGRATION STATEMENTS

Cloudflare Dashboard → Workers & Pages → D1 SQL Database → your existing TM Detailers database → Console. Run these SQL statements **one at a time**, exactly as written (or paste the contents of `database/MIGRATE-PHOTOS-TRACKER.sql` if the console supports multi-statements):

```sql
CREATE TABLE IF NOT EXISTS booking_public_details (booking_id TEXT PRIMARY KEY, headline TEXT NOT NULL DEFAULT '', status_message TEXT NOT NULL DEFAULT '', next_step TEXT NOT NULL DEFAULT '', eta_text TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE);
```

```sql
CREATE TABLE IF NOT EXISTS booking_photos (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('before','after')), caption TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE);
```

```sql
CREATE INDEX IF NOT EXISTS idx_booking_photos_booking ON booking_photos(booking_id,kind);
```

The statements above use `IF NOT EXISTS`; rerunning them will not duplicate the tables.

**Why the database step is required:** Private before/after images and customer-visible progress notes must be stored somewhere. Without these tables, new booking lookup/photo endpoints will report a server error. We have deliberately NOT invented a second D1 database, R2 bucket, or a Cloudflare secret.

## THIRD — COPY THE CODE TO THE CORRECT FOLDERS

1. Unzip `TM-Detailers-Complete-Fix-V6-1.zip`.
2. In GitHub Desktop → Repository → **Show in Finder** to open the repository folder already connected to Cloudflare Pages.
3. Drag/copy the **contents** of the unzipped folder (`public/`, `functions/`, `database/`) into the repository **root**. **Merge and replace** matching files. Do **NOT** put all of them inside an extra subfolder, and do NOT upload only an HTML preview.
4. Keep your existing domain/DNS files (`CNAME`, root custom setup) and any private files unchanged. This ZIP does NOT include API keys.
5. Commit the changes with a message like `Complete TM Detailers V6.1 booking tracker and owner update` and click **Push origin**.
6. Wait for a successful Cloudflare Pages deployment before opening the live site. Visit `https://tmdetailers.ca/version.txt` and confirm it contains `TRACKER & OWNER PHOTOS UPGRADE V6.1`.

## FOURTH — TEST ON THE LIVE DOMAIN WITH FICTIONAL TEST BOOKINGS

1. At `/studio/`, sign in with the real existing owner password from your Cloudflare `ADMIN_PASSWORD` secret (not an arbitrary demo password).
2. At `/checkout/`, submit one test regular booking. Confirm the big success screen, Copy Reference and tracking link.
3. At `/business/`, log in with an existing company access code and submit a test booking. Confirm it now gets a BIG success screen with Copy Reference and Track This Booking.
4. At `/track/`, enter the reference and booking email. Confirm progress, vehicle, date, quoted price, request history and photo journal. Add a test before photo (JPEG/PNG/WebP).
5. At `/studio/` → Bookings → Open booking → **View & edit the customer tracker**. Edit a progress headline, status, price, customer details, add an after photo. Reload the CUSTOMER `/track/` view to see the updated status/photo. Only owner sessions can upload after photos or delete photos.
6. Delete your fictional test booking via owner tools once testing is finished.

## NOT INCLUDED / LIMITATIONS

- THIS DOES NOT DEPLOY AUTOMATICALLY and does not prove your existing live repository was updated.
- Existing Cloudflare `DB`, `SESSION_SECRET`, `ADMIN_PASSWORD` bindings are still required. No extra API tokens are necessary to use private photos.
- Confirmation email requires your existing Resend setup; an 'email queued' indicator is NOT proof of delivery.
- Each booking allows 4 before and 4 after photos, up to 500KB each. Photos are stored privately as D1 binary records. This is appropriate only for a modest volume of photos. For large-scale galleries use Cloudflare R2 later with access controls.
- Customer access requires the booking reference AND email; owner access requires the valid owner session. A reference by itself is not a secret authentication system.
- Owner can edit all fields that appear on the customer tracker plus the main booking record, status, public messages, estimate, photo captions, and review change requests. It does not introduce a real generative AI assistant or new payment processing.
- The homepage keeps the V5 showroom design (business is less prominent on the public homepage). This release prioritises functional owner/customer/business issues, rather than claiming a complete new main-site visual redesign.

## ROLLBACK

Revert the Git commit if something fails, but do not blindly roll back the D1 schema or delete the photo tables after live photos are saved. Back up customer data first.
