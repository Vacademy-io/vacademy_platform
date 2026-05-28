-- Allow two institutes to use the same coupon code.
-- Drops the global UNIQUE(code) constraint added in V1 and replaces it with
-- a composite UNIQUE(institute_id, code). Legacy PRODUCT_PAGE coupons get
-- their institute_id backfilled from the parent product_page row so the new
-- constraint applies cleanly.

-- 1. Backfill institute_id for existing product-page coupons. Source rows
--    were created with source_type='PRODUCT_PAGE' and source_id=<product_page.id>.
--    Any orphaned rows (deleted product page) stay null; the composite unique
--    treats two NULLs as distinct so this is safe.
UPDATE coupon_code cc
SET institute_id = pp.institute_id
FROM product_page pp
WHERE cc.source_type = 'PRODUCT_PAGE'
  AND cc.source_id = pp.id
  AND cc.institute_id IS NULL;

-- 2. Drop the global uniqueness so two institutes can share a code string.
ALTER TABLE coupon_code
    DROP CONSTRAINT IF EXISTS coupon_code_code_key;

-- 3. Add per-institute uniqueness. NULL institute_ids (orphaned legacy rows)
--    are distinct under this constraint, so they don't collide with each
--    other or with any institute's coupons.
ALTER TABLE coupon_code
    ADD CONSTRAINT uq_coupon_code_institute_code UNIQUE (institute_id, code);
