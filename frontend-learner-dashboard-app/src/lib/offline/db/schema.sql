-- Offline content DB schema (plan §B2).
--
-- Every table is keyed by user_id (first column of every PK) and every DAO
-- query filters on it, even where a secondary key would already be globally
-- unique — this is deliberate defense for the shared-device edge case (two
-- learners signing into the same tablet) so a query bug can never leak rows
-- across accounts.
--
-- This file is the single source of truth for schema DDL — applied as
-- migration batch 1 by migrations.ts. Do NOT edit statements here once they
-- have shipped; add a new forward-only migration batch instead (see
-- migrations.ts).

-- Registered device + lease state for this user on this device. One row.
CREATE TABLE IF NOT EXISTS device_state (
  user_id TEXT PRIMARY KEY,
  device_id TEXT,
  device_registration_id TEXT,
  lease_expires_at INTEGER,
  last_checkin_at INTEGER,
  last_checkin_monotonic INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0
);

-- One row per (user, package_session) manifest snapshot. tree_json drives the
-- offline navigation shell so the app can render course structure without a
-- network round-trip.
CREATE TABLE IF NOT EXISTS manifests (
  user_id TEXT NOT NULL,
  package_session_id TEXT NOT NULL,
  institute_id TEXT,
  version INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  tree_json TEXT NOT NULL,
  update_available INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, package_session_id)
);

-- One row per content-tree node (subject/module/chapter/slide) with its
-- download status. bytes_total/bytes_done drive progress UI.
CREATE TABLE IF NOT EXISTS nodes (
  user_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  package_session_id TEXT NOT NULL,
  parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'NOT_DOWNLOADED',
  bytes_total INTEGER NOT NULL DEFAULT 0,
  bytes_done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_nodes_user_package
  ON nodes (user_id, package_session_id);
CREATE INDEX IF NOT EXISTS idx_nodes_user_parent
  ON nodes (user_id, parent_id);

-- One row per downloadable asset (file). PK is (user_id, file_id, slide_id)
-- per plan — the same file_id can be shared across slides, so downloads are
-- tracked per (slide, asset) pair while the encrypted bytes on disk are
-- reference-counted by the download manager, not by this table.
CREATE TABLE IF NOT EXISTS assets (
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  slide_id TEXT NOT NULL,
  package_session_id TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  nonce TEXT,
  local_path TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, file_id, slide_id)
);
CREATE INDEX IF NOT EXISTS idx_assets_user_slide
  ON assets (user_id, slide_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_package
  ON assets (user_id, package_session_id);

-- Encrypted quiz/question/doc JSON payloads for offline slides. Encryption
-- key is the single device-local key (secure storage) — no key columns here
-- beyond the per-payload nonce; key_ref is reserved for a future server-issued
-- key (always null in v1, mirrors the manifest keyRef contract field).
CREATE TABLE IF NOT EXISTS slide_payloads (
  user_id TEXT NOT NULL,
  slide_id TEXT NOT NULL,
  manifest_version INTEGER NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  key_ref TEXT,
  PRIMARY KEY (user_id, slide_id)
);

-- Durable outbox of offline learning-activity events awaiting sync.
CREATE TABLE IF NOT EXISTS event_queue (
  client_event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  client_ts INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  context TEXT,
  payload TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_queue_user_status
  ON event_queue (user_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_event_queue_user_seq
  ON event_queue (user_id, seq);
