-- ================================================================================
-- V239: Institute - currency override + structured GSTIN + state code
--
-- Adds the fields needed by the AI credit pack purchase flow:
--   - currency:    optional manual currency override (NULL = derive from country)
--   - gstin:       structured 15-char GSTIN for invoice buyer info
--                  (the existing free-text `gst_details` column from V91 is left
--                   intact for legacy data; new flow reads `gstin`)
--   - state_code:  2-char numeric Indian state code (e.g. "29" Karnataka, "27"
--                  Maharashtra) used to decide CGST+SGST vs IGST split. The
--                  existing `state` column is free-text so unsuitable for tax
--                  routing.
-- ================================================================================

ALTER TABLE institutes ADD COLUMN IF NOT EXISTS currency   VARCHAR(3);
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS gstin      VARCHAR(15);
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS state_code VARCHAR(2);
