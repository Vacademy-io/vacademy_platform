-- Fix: allow multiple provider accounts per (institute, provider), keyed by vendor_user_id.
--
-- Background — a constraint-vs-index gotcha left a zombie unique index alive:
--   V125 created `uq_institute_live_session_provider` as a table CONSTRAINT (institute_id, provider).
--   V159 dropped that CONSTRAINT and recreated `uq_institute_live_session_provider` as a plain
--        UNIQUE INDEX on (COALESCE(institute_id,'__PLATFORM__'), provider).
--   V164 meant to drop it again to make room for vendor_user_id-scoped rows, but used
--        `DROP CONSTRAINT IF EXISTS` — a no-op against an INDEX — so the V159 index survived and
--        still enforces one row per (institute, provider), ignoring vendor_user_id.
--
-- Symptom: adding a 2nd Zoom account for an institute fails with
--   duplicate key value violates unique constraint "uq_institute_live_session_provider".
--
-- This migration finishes V164's intent: drop the leftover index (as an INDEX this time) and
-- harden the institute-wide partial index so platform-wide rows (NULL institute_id, e.g. BBB)
-- keep their dedup guarantee that NULLs-are-distinct would otherwise lose.

-- 1. Drop the zombie full unique index (the actual culprit). It was created via
--    CREATE UNIQUE INDEX, so it must be removed via DROP INDEX, not DROP CONSTRAINT.
DROP INDEX IF EXISTS uq_institute_live_session_provider;

-- 2. Rebuild the institute-wide (vendor_user_id IS NULL) partial unique index with COALESCE
--    so that multiple platform-wide rows (NULL institute_id) of the same provider can't slip in
--    (a plain (institute_id, provider) unique index treats NULL institute_id values as distinct).
DROP INDEX IF EXISTS uq_ilspm_institute_provider_global;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ilspm_institute_provider_global
    ON institute_live_session_provider_mapping (COALESCE(institute_id, '__PLATFORM__'), provider)
    WHERE vendor_user_id IS NULL;

-- 3. Ensure the per-account partial index from V164 exists (idempotent safety net):
--    at most one config per (institute, provider, vendor_user_id) for vendor-scoped rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ilspm_institute_provider_vendor
    ON institute_live_session_provider_mapping (institute_id, provider, vendor_user_id)
    WHERE vendor_user_id IS NOT NULL;
