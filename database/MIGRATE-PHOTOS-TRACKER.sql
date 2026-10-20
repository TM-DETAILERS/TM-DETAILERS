-- TM Detailers Booking Tracker V6.1: run each statement ONCE on Cloudflare D1 BEFORE deploying.
-- Safe to rerun because tables use IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS booking_public_details (booking_id TEXT PRIMARY KEY, headline TEXT NOT NULL DEFAULT '', status_message TEXT NOT NULL DEFAULT '', next_step TEXT NOT NULL DEFAULT '', eta_text TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS booking_photos (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('before','after')), caption TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_booking_photos_booking ON booking_photos(booking_id,kind);
