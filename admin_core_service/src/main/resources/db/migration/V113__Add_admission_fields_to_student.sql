-- V113: Add essential admission-specific fields to student table
-- These fields support the Manual Admission workflow (MVP only)
-- Deferred to a later migration: has_transport, student_type, class_group,
--   year_of_passing, previous_admission_no, how_did_you_know,
--   father_aadhaar/qualification/occupation, mother_aadhaar/qualification/occupation,
--   permanent_address, permanent_locality

ALTER TABLE student
    -- Core admission identity
    ADD COLUMN IF NOT EXISTS admission_no VARCHAR(50),
    ADD COLUMN IF NOT EXISTS date_of_admission DATE,
    ADD COLUMN IF NOT EXISTS admission_type VARCHAR(50),
    

    -- Demographic (required by Indian school forms)
   
    ADD COLUMN IF NOT EXISTS caste VARCHAR(50),

    -- Guardian (needed when parents unavailable)
    ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS guardian_mobile VARCHAR(20);
