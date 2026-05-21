-- ============================================================
-- V263: Mark the seeded New / Converted / Lost statuses as "system" so they can be
-- renamed/recoloured but NOT deleted. Custom statuses (is_system = false) stay fully editable
-- and deletable.
-- ============================================================

ALTER TABLE lead_status ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: any already-seeded default statuses (keys aligned to conversion_status) become system.
UPDATE lead_status SET is_system = TRUE WHERE status_key IN ('LEAD', 'CONVERTED', 'LOST');
