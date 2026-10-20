CREATE TABLE IF NOT EXISTS booking_requests (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('cancel','reschedule')), message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','declined')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT, FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status,created_at);
CREATE TABLE IF NOT EXISTS fleet_departments (id TEXT PRIMARY KEY, business_account_id TEXT NOT NULL, name TEXT NOT NULL, FOREIGN KEY(business_account_id) REFERENCES business_accounts(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS fleet_vehicles (id TEXT PRIMARY KEY, business_account_id TEXT NOT NULL, department_id TEXT, vehicle TEXT NOT NULL, make TEXT NOT NULL, model TEXT NOT NULL, model_year INTEGER, label TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(business_account_id) REFERENCES business_accounts(id) ON DELETE CASCADE, FOREIGN KEY(department_id) REFERENCES fleet_departments(id) ON DELETE SET NULL);
CREATE INDEX IF NOT EXISTS idx_fleet_owner ON fleet_vehicles(business_account_id,active);
ALTER TABLE bookings ADD COLUMN fleet_vehicle_id TEXT;
ALTER TABLE bookings ADD COLUMN department_id TEXT;
