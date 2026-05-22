-- ============================================================
-- V264: Guarantee the 3 system lead statuses (New / Converted / Lost) exist for EVERY institute.
--
-- Until now these were only seeded lazily on the first GET /lead-status call, so any institute
-- that had never opened the Lead Statuses UI (and every brand-new signup) had none. This backfills
-- all EXISTING institutes; NEW institutes are now also seeded at creation
-- (UserInstituteService.saveInstitute) and still lazily on first access as a fallback.
--
-- Keys/labels/colours/order match LeadStatusService.DEFAULTS, and is_system = TRUE so they are
-- editable but not deletable. Idempotent via the (institute_id, status_key) unique index, so it is
-- safe to re-run and will not duplicate statuses an institute already has.
-- ============================================================

INSERT INTO lead_status (institute_id, status_key, label, color, display_order, is_default, is_active, is_system)
SELECT i.id, d.status_key, d.label, d.color, d.display_order, d.is_default, TRUE, TRUE
FROM institutes i
CROSS JOIN (VALUES
    ('LEAD',      'New',       '#3b82f6', 1, TRUE),
    ('CONVERTED', 'Converted', '#16a34a', 2, FALSE),
    ('LOST',      'Lost',      '#ef4444', 3, FALSE)
) AS d(status_key, label, color, display_order, is_default)
ON CONFLICT (institute_id, status_key) DO NOTHING;
