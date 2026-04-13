-- Custom Fields Revamp:
-- Allow per-context (institute_custom_fields row) required state, instead of
-- the previous global is_mandatory on custom_fields. This lets the same
-- default field be required in one feature (e.g. Enroll Invite) and optional
-- in another (e.g. Live Session).
--
-- Backward compatibility: defaults to false. Existing rows are unaffected.
-- The previous custom_fields.is_mandatory column stays in place but is now
-- treated as the master/default value rather than the source of truth at
-- read time.

ALTER TABLE public.institute_custom_fields
    ADD COLUMN IF NOT EXISTS is_mandatory boolean DEFAULT false;
