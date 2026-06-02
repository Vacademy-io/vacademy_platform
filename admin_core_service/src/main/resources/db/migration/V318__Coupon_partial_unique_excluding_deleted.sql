-- Allow re-creating a coupon code after it's been soft-deleted.
--
-- V311 added a full UNIQUE (institute_id, code) constraint. That worked for
-- the active happy path but quietly broke a common admin workflow: create
-- coupon SAVE20, soft-delete it (sets status='DELETED' but keeps the row),
-- then try to create SAVE20 again — the DB rejects with a unique-violation
-- and the user sees "A coupon with this code already exists in this
-- institute" even though no live row uses the code.
--
-- PostgreSQL partial unique indexes solve this cleanly: the index slot is
-- only consumed by rows that pass the WHERE predicate. Soft-deleted rows
-- coexist without blocking new ones.

ALTER TABLE coupon_code
    DROP CONSTRAINT IF EXISTS uq_coupon_code_institute_code;

CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_code_institute_code_active
    ON coupon_code (institute_id, code)
    WHERE status <> 'DELETED';
