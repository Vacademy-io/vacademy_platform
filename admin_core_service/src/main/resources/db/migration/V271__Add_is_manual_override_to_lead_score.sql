-- Ensure is_manual_override exists (V268 may have added manual_score_override instead if applied before the rename)
ALTER TABLE lead_score ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT FALSE;
ALTER TABLE lead_score DROP COLUMN IF EXISTS manual_score_override;
