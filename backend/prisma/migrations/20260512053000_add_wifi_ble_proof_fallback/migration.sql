-- Add Wi-Fi BSSID + BLE-beacon location-proof fallbacks alongside GPS.
-- Backwards-compatible: every new column is nullable or has a default,
-- so existing rows / API clients keep working unchanged.

-- Room: optional list of Wi-Fi BSSIDs and an optional BLE beacon UUID.
ALTER TABLE "Room"
  ADD COLUMN "wifiBssids"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bleBeaconId" TEXT;

-- AttendanceRecord: which proof method actually verified the scan, plus the
-- raw evidence captured by the client (useful for forensics + at-risk weight).
ALTER TABLE "AttendanceRecord"
  ADD COLUMN "proofMethod" TEXT,
  ADD COLUMN "wifiBssid"   TEXT,
  ADD COLUMN "bleBeaconId" TEXT,
  ADD COLUMN "bleRssi"     INTEGER;
